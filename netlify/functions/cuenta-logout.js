const A = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return A.json(405, { error: 'Método no permitido.' });
  await A.revocarSesion(A.leerCookie(event, 'yeah_sesion'));
  return A.json(200, { ok: true }, { 'Set-Cookie': A.cookieBorrada() });
};
