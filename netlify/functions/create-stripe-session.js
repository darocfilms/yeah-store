const Stripe = require('stripe');
const { priceLineItems, computeTotal } = require('./_lib/products');
const { evaluarCupon } = require('./_lib/cupones');

const { conectarBlobs } = require('./_lib/blobs');

exports.handler = async (event) => {
  conectarBlobs(event);
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

    // El descuento se recalcula acá: del cliente solo llega el código.
    // Se aplica prorrateado sobre el precio unitario, igual que en MercadoPago
    // y PayPal — un solo criterio para las tres pasarelas, sin crear objetos
    // de cupón en Stripe por cada compra.
    const subtotal = computeTotal(lines);
    const cupon = await evaluarCupon(body.cupon, subtotal);
    const factor = cupon.valido ? (subtotal - cupon.descuento) / subtotal : 1;

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
          unit_amount: Math.max(1, Math.round(product.price * factor)),
          product_data: { name: product.name, description: product.sku }
        }
      })),
      metadata: {
        order_items: JSON.stringify(lines.map(({ product, qty }) => ({ id: product.id, qty }))),
        cupon: cupon.valido ? cupon.cupon.codigo : '',
        descuento: cupon.valido ? String(cupon.descuento) : '0'
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
