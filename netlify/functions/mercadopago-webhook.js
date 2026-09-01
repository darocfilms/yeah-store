const { getProduct, computeTotal } = require('./_lib/products');
const { sendDeliveryEmail, sendStoreNotification } = require('./_lib/email');

exports.handler = async (event) => {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[YEAH] mercadopago-webhook: falta MP_ACCESS_TOKEN');
    return { statusCode: 500, body: 'Not configured' };
  }

  try {
    const params = event.queryStringParameters || {};
    let body = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) { body = {}; }

    const type = params.type || body.type || params.topic;
    const paymentId = params['data.id'] || body?.data?.id || params.id;

    if (type && type !== 'payment') {
      return { statusCode: 200, body: 'ignored (not a payment event)' };
    }
    if (!paymentId) {
      return { statusCode: 200, body: 'no payment id' };
    }

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`MercadoPago payment lookup error ${res.status}`);
    const payment = await res.json();

    if (payment.status !== 'approved') {
      return { statusCode: 200, body: `payment status: ${payment.status}` };
    }

    const items = JSON.parse(payment.metadata?.order_items || '[]');
    const lines = items.map((it) => ({ product: getProduct(it.id), qty: it.qty })).filter((l) => l.product);
    const total = computeTotal(lines);
    const customerEmail = payment.payer?.email;

    if (customerEmail && lines.length) {
      await sendDeliveryEmail({ to: customerEmail, lines, total, orderRef: String(payment.id) });
    }
    await sendStoreNotification({
      subject: 'Nueva venta (MercadoPago) en YEAH!',
      lines,
      total,
      orderRef: String(payment.id),
      customerEmail
    });

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('[YEAH] mercadopago-webhook error:', err);
    // Devolvemos 200 igual: MercadoPago reintenta agresivamente ante cualquier
    // error, y el cobro ya se hizo — un fallo de email no debe generar reintentos.
    return { statusCode: 200, body: 'logged error' };
  }
};
