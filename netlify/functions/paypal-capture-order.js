const { PAYPAL_API, getAccessToken } = require('./_lib/paypal');
const { getProduct, computeTotal } = require('./_lib/products');
const { sendDeliveryEmail, sendStoreNotification } = require('./_lib/email');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { orderID } = JSON.parse(event.body || '{}');
    if (!orderID) return { statusCode: 400, body: JSON.stringify({ error: 'Falta orderID.' }) };

    const token = await getAccessToken();
    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const capture = await res.json();

    if (!res.ok || capture.status !== 'COMPLETED') {
      console.error('[YEAH] paypal capture failed:', capture);
      return { statusCode: 200, body: JSON.stringify({ status: capture.status || 'FAILED' }) };
    }

    const purchaseUnit = capture.purchase_units?.[0];
    let orderItems = [];
    try { orderItems = JSON.parse(purchaseUnit?.custom_id || '[]'); } catch (e) { orderItems = []; }

    const lines = orderItems.map((it) => ({ product: getProduct(it.id), qty: it.qty })).filter((l) => l.product);
    const total = computeTotal(lines);
    const customerEmail = capture.payer?.email_address;

    if (customerEmail && lines.length) {
      await sendDeliveryEmail({ to: customerEmail, lines, total, orderRef: orderID });
    }
    await sendStoreNotification({
      subject: 'Nueva venta (PayPal) en YEAH!',
      lines,
      total,
      orderRef: orderID,
      customerEmail
    });

    return { statusCode: 200, body: JSON.stringify({ status: 'COMPLETED' }) };
  } catch (err) {
    console.error('[YEAH] paypal-capture-order error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo capturar el pago de PayPal.' }) };
  }
};
