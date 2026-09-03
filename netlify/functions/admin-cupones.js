// Alta, edición y baja de cupones desde el panel.
const A = require('./_lib/auth');
const { guardarCupon, listarCupones, eliminarCupon } = require('./_lib/cupones');

exports.handler = async (event) => {
  const { error } = await A.requiereAdmin(event);
  if (error) return error;

  try {
    if (event.httpMethod === 'GET') return A.json(200, { cupones: await listarCupones() });

    if (event.httpMethod === 'POST') {
      const cupon = await guardarCupon(JSON.parse(event.body || '{}'));
      return A.json(200, { ok: true, cupon });
    }

    if (event.httpMethod === 'DELETE') {
      const codigo = (event.queryStringParameters || {}).codigo;
      if (!codigo) return A.json(400, { error: 'Falta el código.' });
      await eliminarCupon(codigo);
      return A.json(200, { ok: true });
    }

    return A.json(405, { error: 'Método no permitido.' });
  } catch (err) {
    console.error('[YEAH] admin-cupones error:', err);
    return A.json(400, { error: err.message || 'No se pudo guardar el cupón.' });
  }
};
