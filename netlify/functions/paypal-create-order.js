const { PAYPAL_API, getAccessToken } = require('./_lib/paypal');
const { priceLineItems, computeTotal, clpToUsd } = require('./_lib/products');
const { evaluarCupon } = require('./_lib/cupones');

const { conectarBlobs } = require('./_lib/blobs');

exports.handler = async (event) => {
  conectarBlobs(event);
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    const lines = priceLineItems(body.items);
    if (lines.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrito vacío o inválido.' }) };
    }

    const subtotal = computeTotal(lines);
    const cupon = await evaluarCupon(body.cupon, subtotal);
    const totalClp = cupon.valido ? subtotal - cupon.descuento : subtotal;
    // PayPal no acepta CLP: cobramos el equivalente en USD (ver clpToUsd).
    const totalUsd = clpToUsd(totalClp);
    const token = await getAccessToken();

    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { currency_code: 'USD', value: totalUsd },
            custom_id: JSON.stringify({
              i: lines.map(({ product, qty }) => ({ id: product.id, qty })),
              c: cupon.valido ? cupon.cupon.codigo : '',
              d: cupon.valido ? cupon.descuento : 0
            })
          }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PayPal create order error ${res.status}: ${text}`);
    }

    const order = await res.json();
    return { statusCode: 200, body: JSON.stringify({ id: order.id }) };
  } catch (err) {
    console.error('[YEAH] paypal-create-order error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo crear la orden de PayPal.' }) };
  }
};
