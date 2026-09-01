const { priceLineItems } = require('./_lib/products');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return { statusCode: 500, body: JSON.stringify({ error: 'MercadoPago no está configurado (falta MP_ACCESS_TOKEN en Netlify).' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const lines = priceLineItems(body.items);
    if (lines.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrito vacío o inválido.' }) };
    }

    const siteUrl = process.env.SITE_URL || `https://${event.headers.host}`;

    const preference = {
      items: lines.map(({ product, qty }) => ({
        title: product.name,
        quantity: qty,
        unit_price: product.price,
        currency_id: 'USD'
      })),
      metadata: {
        order_items: JSON.stringify(lines.map(({ product, qty }) => ({ id: product.id, qty })))
      },
      back_urls: {
        success: `${siteUrl}/gracias.html?provider=mercadopago`,
        failure: `${siteUrl}/#tienda`,
        pending: `${siteUrl}/gracias.html?provider=mercadopago&status=pending`
      },
      auto_return: 'approved',
      notification_url: `${siteUrl}/.netlify/functions/mercadopago-webhook`
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MercadoPago API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify({ url: data.init_point }) };
  } catch (err) {
    console.error('[YEAH] create-mp-preference error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo crear la preferencia de pago.' }) };
  }
};
