// Acciones sobre un pedido concreto, desde el panel.
//
//   reenviar  → genera un token nuevo y vuelve a mandar el correo de entrega.
//               Resuelve el reclamo más común de una tienda digital ("no me
//               llegó", "lo borré") sin tener que armar nada a mano.
//   confirmar → marca pagada una transferencia bancaria y recién ahí dispara
//               la entrega. Es el único método que no confirma solo.
const A = require('./_lib/auth');
const { conectarBlobs } = require('./_lib/blobs');
const { requiereAdminOToken } = require('./_lib/auth-admin');
const { storePedidos } = require('./_lib/pedidos');
const { crearEntrega, storeTokens } = require('./_lib/entrega');
const { registrarPulso } = require('./_lib/completar');
const { sendDeliveryEmail } = require('./_lib/email');
const { getProduct } = require('./_lib/products');

// El pedido guarda los ítems planos; para el correo hacen falta los productos
// completos, así que se rehidratan desde la fuente del servidor.
function lineasDe(pedido) {
  return (pedido.items || [])
    .map((it) => ({ product: getProduct(it.id), qty: it.qty }))
    .filter((l) => l.product);
}

exports.handler = async (event) => {
  conectarBlobs(event);
  if (event.httpMethod !== 'POST') return A.json(405, { error: 'Método no permitido.' });

  const guard = await requiereAdminOToken(event);
  if (guard.error) return guard.error;

  try {
    const { id, accion } = JSON.parse(event.body || '{}');
    if (!id) return A.json(400, { error: 'Falta el pedido.' });

    const pedido = await storePedidos().get(String(id), { type: 'json' });
    if (!pedido) return A.json(404, { error: 'No encontramos ese pedido.' });
    if (!pedido.email) return A.json(400, { error: 'Ese pedido no tiene correo asociado.' });

    const lines = lineasDe(pedido);
    if (!lines.length) return A.json(400, { error: 'Ese pedido no tiene productos vigentes.' });

    if (accion === 'confirmar') {
      if (pedido.estado === 'pagado') return A.json(409, { error: 'Ese pedido ya estaba confirmado.' });
    } else if (accion !== 'reenviar') {
      return A.json(400, { error: 'Acción desconocida.' });
    }

    // En los dos casos el token se renueva y el anterior se borra: un enlace
    // filtrado o reenviado por error deja de servir en el acto. Es lo que dice
    // el panel antes de confirmar, así que tiene que ser cierto.
    const token = await crearEntrega({
      email: pedido.email, lines, orderRef: pedido.id, provider: pedido.provider
    });
    if (pedido.token) {
      await storeTokens().delete(pedido.token).catch((err) => {
        console.error('[YEAH] no se pudo revocar el token anterior:', err);
      });
    }

    await storePedidos().setJSON(pedido.id, {
      ...pedido,
      token,
      estado: 'pagado',
      ...(accion === 'confirmar' ? { confirmado: Date.now() } : { reenviado: Date.now() })
    });

    await sendDeliveryEmail({
      to: pedido.email, lines, total: pedido.total, orderRef: pedido.id, token
    });

    if (accion === 'confirmar') await registrarPulso(pedido.provider, 'confirmacion-manual');

    return A.json(200, { ok: true, accion, id: pedido.id });
  } catch (err) {
    console.error('[YEAH] admin-pedido error:', err);
    return A.json(500, { error: 'No se pudo completar la acción.' });
  }
};
