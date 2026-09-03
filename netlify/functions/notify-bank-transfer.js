const { priceLineItems, computeTotal } = require('./_lib/products');
const { sendEmail, sendStoreNotification } = require('./_lib/email');
const { guardarPedido, storePedidos } = require('./_lib/pedidos');
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

    const email = String(body.email || '').trim();
    if (!email || email.indexOf('@') === -1) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email inválido.' }) };
    }
    const reference = String(body.reference || '').slice(0, 60) || 'SIN-REF';
    const subtotal = computeTotal(lines);
    // El descuento se recalcula acá, igual que en las pasarelas: el navegador
    // manda un código, nunca un monto.
    const cupon = await evaluarCupon(body.cupon, subtotal).catch(() => ({ valido: false }));
    const descuento = cupon.valido ? cupon.descuento : 0;
    const total = subtotal - descuento;

    // Queda registrado como PENDIENTE. No es una venta hasta que se vea el
    // comprobante: el panel lo muestra en la bandeja de conciliación y desde
    // ahí se confirma, lo que recién entonces dispara la entrega.
    const pedido = await guardarPedido({
      orderRef: reference, email, lines, total,
      provider: 'transferencia',
      cupon: cupon.valido ? cupon.codigo : null,
      descuento
    });
    await storePedidos().setJSON(pedido.id, { ...pedido, estado: 'pendiente' });

    // Esto NO confirma un pago real — la transferencia bancaria no se puede
    // verificar automáticamente. Solo registra el pedido como pendiente y
    // avisa al dueño de la tienda para que confirme manualmente el comprobante.
    await sendStoreNotification({
      subject: 'Pedido pendiente por transferencia — YEAH!',
      lines,
      total,
      orderRef: reference,
      customerEmail: email,
      extra: 'Queda pendiente en el panel, pestaña Pedidos. Al confirmar el comprobante ahí, la entrega sale sola.'
    });

    await sendEmail({
      to: email,
      subject: `Recibimos tu pedido ${reference} — YEAH!`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#0B0B0A;max-width:560px;margin:0 auto;">
        <h1 style="font-size:18px;">Recibimos tu pedido</h1>
        <p>Referencia: <strong>${reference}</strong></p>
        <p>Apenas confirmemos tu transferencia te enviamos el enlace de descarga y la licencia a este correo.</p>
        <p>Si tienes el comprobante a mano, envíalo por WhatsApp: +56 9 4380 1816.</p>
      </div>`
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[YEAH] notify-bank-transfer error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo registrar el pedido.' }) };
  }
};
