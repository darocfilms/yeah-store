// Cambio de contraseña desde el perfil. Exige sesión válida y, además, la
// contraseña actual: una cookie robada no alcanza para quedarse con la cuenta.
const A = require('./_lib/auth');
const { conectarBlobs } = require('./_lib/blobs');

exports.handler = async (event) => {
  conectarBlobs(event);
  if (event.httpMethod !== 'POST') return A.json(405, { error: 'Método no permitido.' });

  const { usuario, error } = await A.requiereSesion(event);
  if (error) return error;

  try {
    const b = JSON.parse(event.body || '{}');
    if (!b.actual || !b.nueva) return A.json(400, { error: 'Ingresa la contraseña actual y la nueva.' });

    const r = await A.cambiarClave(usuario.email, b.actual, b.nueva);
    if (r.error) return A.json(400, { error: r.error });
    return A.json(200, { ok: true });
  } catch (err) {
    console.error('[YEAH] cuenta-clave error:', err);
    return A.json(500, { error: 'No se pudo cambiar la contraseña.' });
  }
};
