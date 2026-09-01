const Stripe = require('stripe');
const { getProduct, computeTotal } = require('./_lib/products');
const { sendDeliveryEmail, sendStoreNotification } = require('./_lib/email');

exports.handler = async (event) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    console.error('[YEAH] stripe-webhook: faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET');
    return { statusCode: 500, body: 'Not configured' };
  }

  const stripe = Stripe(secretKey);
  let evt;
  try {
    const sig = event.headers['stripe-signature'];
    const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    evt = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[YEAH] stripe-webhook signature error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (evt.type === 'checkout.session.completed') {
    const session = evt.data.object;
    try {
      const items = JSON.parse(session.metadata?.order_items || '[]');
      const lines = items.map((it) => ({ product: getProduct(it.id), qty: it.qty })).filter((l) => l.product);
      const total = computeTotal(lines);
      const customerEmail = session.customer_details?.email || session.customer_email;

      if (customerEmail && lines.length) {
        await sendDeliveryEmail({ to: customerEmail, lines, total, orderRef: session.id });
      }
      await sendStoreNotification({
        subject: 'Nueva venta (Stripe) en YEAH!',
        lines,
        total,
        orderRef: session.id,
        customerEmail
      });
    } catch (err) {
      console.error('[YEAH] stripe-webhook fulfillment error:', err);
      // No devolvemos error a Stripe: el cobro ya se hizo, no queremos que reintente
      // indefinidamente por un fallo en el envío del email. El log queda para revisión manual.
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
