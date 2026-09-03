// Autenticación: contraseñas con scrypt, sesiones opacas en Blobs y guardas de
// acceso. Nada de esto viaja al navegador salvo la cookie de sesión.
const crypto = require('crypto');
const { promisify } = require('util');
const { getStore } = require('@netlify/blobs');

const scrypt = promisify(crypto.scrypt);
const LARGO_CLAVE = 64;
const DIAS_SESION = 30;
const MAX_INTENTOS = 8;              // por email, en la ventana de abajo
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'darocfilms@gmail.com').toLowerCase();

// Consistencia fuerte en todo lo que se escribe y se lee de inmediato:
// una sesión recién creada tiene que ser válida en la petición siguiente.
const store = (nombre) => getStore({ name: nombre, consistency: 'strong' });
const storeUsuarios = () => store('usuarios');
const storeSesiones = () => store('sesiones');
const storeIntentos = () => store('intentos-login');

const normalizarEmail = (email) => String(email || '').trim().toLowerCase();
const esAdmin = (email) => normalizarEmail(email) === ADMIN_EMAIL;

// ---------- contraseñas ----------
async function hashearClave(clave) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(clave, salt, LARGO_CLAVE)).toString('hex');
  return { salt, hash };
}

async function verificarClave(clave, salt, hash) {
  if (!salt || !hash) return false;
  const prueba = await scrypt(clave, salt, LARGO_CLAVE);
  const guardado = Buffer.from(hash, 'hex');
  // timingSafeEqual explota si los largos difieren; comparamos antes.
  if (guardado.length !== prueba.length) return false;
  return crypto.timingSafeEqual(guardado, prueba);
}

// ---------- validaciones ----------
function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(email));
}
function validarClave(clave) {
  if (typeof clave !== 'string' || clave.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (clave.length > 200) return 'La contraseña es demasiado larga.';
  return null;
}
function validarNacimiento(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return 'Fecha de nacimiento inválida.';
  const d = new Date(fecha + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return 'Fecha de nacimiento inválida.';
  const edad = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (edad < 13) return 'Debes tener al menos 13 años para crear una cuenta.';
  if (edad > 120) return 'Fecha de nacimiento inválida.';
  return null;
}

// ---------- límite de intentos ----------
async function intentosFallidos(email) {
  const r = await storeIntentos().get(normalizarEmail(email), { type: 'json' });
  if (!r || Date.now() - r.desde > VENTANA_INTENTOS_MS) return 0;
  return r.n;
}
async function registrarFallo(email) {
  const key = normalizarEmail(email);
  const r = await storeIntentos().get(key, { type: 'json' });
  const vigente = r && Date.now() - r.desde <= VENTANA_INTENTOS_MS;
  await storeIntentos().setJSON(key, { n: vigente ? r.n + 1 : 1, desde: vigente ? r.desde : Date.now() });
}
async function limpiarIntentos(email) {
  await storeIntentos().delete(normalizarEmail(email));
}

// ---------- sesiones ----------
async function crearSesion(email) {
  const token = crypto.randomBytes(32).toString('base64url');
  await storeSesiones().setJSON(token, {
    email: normalizarEmail(email),
    creado: Date.now(),
    vence: Date.now() + DIAS_SESION * 24 * 3600 * 1000
  });
  return token;
}
async function revocarSesion(token) {
  if (token) await storeSesiones().delete(token);
}

function cookieSesion(token) {
  const maxAge = DIAS_SESION * 24 * 3600;
  return `yeah_sesion=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function cookieBorrada() {
  return 'yeah_sesion=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

function leerCookie(event, nombre) {
  const raw = event.headers.cookie || event.headers.Cookie || '';
  for (const parte of raw.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Devuelve el usuario de la petición, o null. NUNCA incluye salt ni hash.
async function usuarioActual(event) {
  const token = leerCookie(event, 'yeah_sesion');
  if (!token) return null;
  const sesion = await storeSesiones().get(token, { type: 'json' });
  if (!sesion || Date.now() > sesion.vence) {
    if (sesion) await revocarSesion(token);
    return null;
  }
  const usuario = await storeUsuarios().get(sesion.email, { type: 'json' });
  if (!usuario) return null;
  return { ...publico(usuario), token };
}

// Proyección segura: lo único que puede salir del servidor.
function publico(usuario) {
  return {
    email: usuario.email,
    nombre: usuario.nombre,
    nacimiento: usuario.nacimiento,
    creado: usuario.creado,
    rol: esAdmin(usuario.email) ? 'admin' : 'cliente'
  };
}

const json = (statusCode, body, headers) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(headers || {}) },
  body: JSON.stringify(body)
});

// Guardas. Devuelven { error } listo para retornar, o { usuario }.
async function requiereSesion(event) {
  const usuario = await usuarioActual(event);
  if (!usuario) return { error: json(401, { error: 'Necesitas iniciar sesión.' }) };
  return { usuario };
}
async function requiereAdmin(event) {
  const { usuario, error } = await requiereSesion(event);
  if (error) return { error };
  if (usuario.rol !== 'admin') return { error: json(403, { error: 'No autorizado.' }) };
  return { usuario };
}

module.exports = {
  storeUsuarios, storeSesiones, store,
  hashearClave, verificarClave,
  validarEmail, validarClave, validarNacimiento,
  intentosFallidos, registrarFallo, limpiarIntentos, MAX_INTENTOS,
  crearSesion, revocarSesion, cookieSesion, cookieBorrada, leerCookie,
  usuarioActual, publico, esAdmin, normalizarEmail,
  requiereSesion, requiereAdmin, json
};
