// El cierre de una compra confirmada, en un solo lugar.
//
// Antes este bloque estaba copiado en los tres webhooks y en la captura de
// PayPal, con variaciones. Ahora hay un solo camino: guardar el pedido con su
// token de entrega, registrar el uso del cupón, mandar el correo y dejar el
// pulso de la pasarela. Si algo cambia, cambia una vez.
const { guardarPedido, storePedidos } = require('./pedidos');
const { crearEntrega } = require('./entrega');
const { registrarUso } = require('./cupones');
const { sendDeliveryEmail, sendStoreNotification } = require('./email');
const { store } = require('./auth');

const storePulsos = () => store('pulsos');

// Deja constancia de que una pasarela confirmó algo. Si una deja de latir
// mientras las demás siguen, el panel lo muestra: es la señal de integración
// rota que antes solo llegaba por un cliente enojado.
async function registrarPulso(provider, tipo) {
  if (!provider) return;
  try {
    const previo = (await storePulsos().get(provider, { type: 'json' })) || { confirmaciones: 0 };
    await storePulsos().setJSON(provider, {
      provider,
      ultima: Date.now(),
      ultimoTipo: tipo || 'confirmacion',
      confirmaciones: (previo.confirmaciones || 0) + 1
    });
  } catch (err) {
    console.error('[YEAH] no se pudo registrar el pulso de', provider, err);
  }
}

async function listarPulsos() {
  const { blobs } = await storePulsos().list();
  const pulsos = await Promise.all(
    blobs.map((b) => storePulsos().get(b.key, { type: 'json' }).catch(() => null))
  );
  return pulsos.filter(Boolean).sort((a, b) => b.ultima - a.ultima);
}

// Cierra la compra: entrega + registro + correo. `notificar` en false sirve
// para las transferencias, donde el aviso a la tienda ya salió al momento de
// avisar el depósito.
async function completarPedido({ orderRef, email, lines, total, provider, cupon, descuento, notificar = true }) {
  const token = (email && lines.length)
    ? await crearEntrega({ email, lines, orderRef, provider })
    : null;

  const pedido = await guardarPedido({
    orderRef, email, lines, total, provider, cupon, descuento
  });
  // El token vive en el pedido para poder reenviar la entrega y ver cuántas
  // descargas se usaron sin tener que buscar a ciegas en el store de entregas.
  if (token) {
    await storePedidos().setJSON(pedido.id, { ...pedido, token, estado: 'pagado' });
    pedido.token = token;
  }
  pedido.estado = 'pagado';

  if (cupon) {
    try { await registrarUso(cupon); } catch (err) { console.error('[YEAH] registrarUso:', err); }
  }

  if (token) {
    try {
      await sendDeliveryEmail({ to: email, lines, total, orderRef, token });
    } catch (err) {
      console.error('[YEAH] no se pudo enviar el correo de entrega:', err);
    }
  }

  if (notificar) {
    try {
      await sendStoreNotification({
        subject: `Nueva venta (${provider}) en YEAH!`,
        lines, total, orderRef, customerEmail: email
      });
    } catch (err) {
      console.error('[YEAH] no se pudo avisar a la tienda:', err);
    }
  }

  await registrarPulso(provider, 'venta');
  return pedido;
}

module.exports = { completarPedido, registrarPulso, listarPulsos, storePulsos };
