// Datos del usuario en sesión y sus compras. Solo lo propio: el email del que
// filtra sale de la sesión, nunca de un parámetro que mande el navegador.
const A = require('./_lib/auth');
const { listarPedidosDe } = require('./_lib/pedidos');

const { conectarBlobs } = require('./_lib/blobs');

exports.handler = async (event) => {
  conectarBlobs(event);
  const { usuario, error } = await A.requiereSesion(event);
  if (error) return error;
  try {
    const pedidos = await listarPedidosDe(usuario.email);
    return A.json(200, { usuario, pedidos });
  } catch (err) {
    console.error('[YEAH] cuenta-perfil error:', err);
    return A.json(500, { error: 'No se pudo cargar el perfil.' });
  }
};
