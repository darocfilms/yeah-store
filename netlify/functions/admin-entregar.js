// Libera manualmente la entrega de un pedido. Es el cierre del flujo de
// transferencia bancaria: cuando verificás el comprobante, corrés esto y el
// comprador recibe su enlace en segundos.
//
//   curl -X POST "https://TU-SITIO.netlify.app/.netlify/functions/admin-entregar" \
//        -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
//        -d '{"email":"cliente@correo.com","items":[{"id":5,"qty":1}],"orderRef":"YEAH-XXXX"}'
const { priceLineItems, computeTotal } = require('./_lib/products');
const { sendDeliveryEmail } = require('./_lib/email');
const { crearEntrega } = require('./_lib/entrega');
const { guardarPedido } = require('./_lib/pedidos');
const { requiereAdminOToken } = require('./_lib/auth-admin');

exports.handler = async (event) => {
  // Dos vías de acceso: sesión de admin (el panel) o ADMIN_TOKEN (scripts y
  // curl). Cualquiera de las dos, nunca ninguna.
  const guard = await requiereAdminOToken(event);
  if (guard.error) return guard.error;
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    const email = String(body.email || '').trim();
    if (!email || email.indexOf('@') === -1) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email inválido.' }) };
    }
    const lines = priceLineItems(body.items);
    if (!lines.length) return { statusCode: 400, body: JSON.stringify({ error: 'items inválido.' }) };

    const orderRef = String(body.orderRef || '').slice(0, 60) || null;
    const total = computeTotal(lines);
    await guardarPedido({ orderRef, email, lines, total, provider: 'transferencia' });
    const token = await crearEntrega({ email, lines, orderRef, provider: 'transferencia' });
    await sendDeliveryEmail({ to: email, lines, total, orderRef, token });

    return { statusCode: 200, body: JSON.stringify({ ok: true, email, orderRef, archivos: lines.map((l) => l.product.downloadFile) }) };
  } catch (err) {
    console.error('[YEAH] admin-entregar error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo generar la entrega.' }) };
  }
};
