const A = require('./_lib/auth');

const { conectarBlobs } = require('./_lib/blobs');

exports.handler = async (event) => {
  conectarBlobs(event);
  if (event.httpMethod !== 'POST') return A.json(405, { error: 'Método no permitido.' });
  try {
    const b = JSON.parse(event.body || '{}');
    const email = A.normalizarEmail(b.email);
    if (!email || !b.clave) return A.json(400, { error: 'Ingresa correo y contraseña.' });

    if (await A.intentosFallidos(email) >= A.MAX_INTENTOS) {
      return A.json(429, { error: 'Demasiados intentos fallidos. Espera unos minutos.' });
    }

    // Si es el correo de administración y todavía no existe, se crea acá con
    // ADMIN_INITIAL_PASSWORD. Devuelve null en cualquier otro caso.
    const usuario = (await A.storeUsuarios().get(email, { type: 'json' }))
      || (await A.asegurarAdmin(email, b.clave));
    // Mismo mensaje exista o no la cuenta: no revelamos qué correos están registrados.
    const ok = usuario && await A.verificarClave(b.clave, usuario.salt, usuario.hash);
    if (!ok) {
      await A.registrarFallo(email);
      return A.json(401, { error: 'Correo o contraseña incorrectos.' });
    }

    await A.limpiarIntentos(email);
    const token = await A.crearSesion(email);
    return A.json(200, { usuario: A.publico(usuario) }, { 'Set-Cookie': A.cookieSesion(token) });
  } catch (err) {
    console.error('[YEAH] cuenta-login error:', err);
    return A.json(500, {
      error: 'No se pudo iniciar sesión.',
      codigo: String((err && err.name) || 'error_desconocido')
    });
  }
};
