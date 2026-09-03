const A = require('./_lib/auth');

const { conectarBlobs } = require('./_lib/blobs');

exports.handler = async (event) => {
  conectarBlobs(event);
  if (event.httpMethod !== 'POST') return A.json(405, { error: 'Método no permitido.' });
  try {
    const b = JSON.parse(event.body || '{}');
    const email = A.normalizarEmail(b.email);
    const nombre = String(b.nombre || '').trim();

    if (nombre.length < 2 || nombre.length > 80) return A.json(400, { error: 'Ingresa tu nombre.' });
    if (!A.validarEmail(email)) return A.json(400, { error: 'Correo inválido.' });
    const errClave = A.validarClave(b.clave);
    if (errClave) return A.json(400, { error: errClave });
    const errFecha = A.validarNacimiento(b.nacimiento);
    if (errFecha) return A.json(400, { error: errFecha });

    // Exclusividad del administrador: su correo nunca se registra desde acá.
    if (A.esAdmin(email)) {
      return A.json(403, { error: 'Esa dirección está reservada.' });
    }

    if (await A.storeUsuarios().get(email, { type: 'json' })) {
      return A.json(409, { error: 'Ya existe una cuenta con ese correo.' });
    }

    const { salt, hash } = await A.hashearClave(b.clave);
    const usuario = { email, nombre, nacimiento: b.nacimiento, salt, hash, creado: Date.now() };
    await A.storeUsuarios().setJSON(email, usuario);

    const token = await A.crearSesion(email);
    return A.json(201, { usuario: A.publico(usuario) }, { 'Set-Cookie': A.cookieSesion(token) });
  } catch (err) {
    console.error('[YEAH] cuenta-registro error:', err);
    return A.json(500, {
      error: 'No se pudo crear la cuenta.',
      codigo: String((err && err.name) || 'error_desconocido')
    });
  }
};
