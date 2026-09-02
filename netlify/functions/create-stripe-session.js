const Stripe = require('stripe');
const { priceLineItems } = require('./_lib/products');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe no está configurado (falta STRIPE_SECRET_KEY en Netlify).' }) };
  }

  try {
    const stripe = Stripe(secretKey);
    const body = JSON.parse(event.body || '{}');
    const lines = priceLineItems(body.items);
    if (lines.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrito vacío o inválido.' }) };
    }

    const siteUrl = process.env.SITE_URL || `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lines.map(({ product, qty }) => ({
        quantity: qty,
        price_data: {
          currency: 'clp',
          // CLP es una moneda "zero-decimal" en Stripe: unit_amount se manda en
          // pesos enteros, NO en centésimos. Multiplicar por 100 aquí cobraría
          // 100 veces de más.
          unit_amount: Math.round(product.price),
          product_data: { name: product.name, description: product.sku }
        }
      })),
      metadata: {
        order_items: JSON.stringify(lines.map(({ product, qty }) => ({ id: product.id, qty })))
      },
      success_url: `${siteUrl}/gracias.html?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#tienda`
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('[YEAH] create-stripe-session error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo crear la sesión de pago.' }) };
  }
};
