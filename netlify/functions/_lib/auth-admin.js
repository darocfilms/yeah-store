// Los endpoints de administración aceptan dos credenciales: la sesión del panel
// o el ADMIN_TOKEN para scripts. Se exige una de las dos, nunca ninguna.
const A = require('./auth');

async function requiereAdminOToken(event) {
  const adminToken = process.env.ADMIN_TOKEN;
  const enviado = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
  if (adminToken && enviado && enviado === adminToken) return { ok: true, via: 'token' };

  const { usuario, error } = await A.requiereAdmin(event);
  if (error) return { error };
  return { ok: true, via: 'sesion', usuario };
}

module.exports = { requiereAdminOToken };
