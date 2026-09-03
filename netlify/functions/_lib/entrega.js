// Entrega de productos digitales: los archivos viven en Netlify Blobs (privados,
// no accesibles por URL pública) y cada compra genera un enlace con token de un
// solo comprador, con vencimiento y tope de descargas.
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const DIAS_VALIDEZ = 30;
const MAX_DESCARGAS = 10;

// CRÍTICO: consistencia fuerte. El token lo escribe el webhook y el comprador
// puede hacer clic segundos después; con consistencia eventual (hasta 60s de
// propagación) el enlace daría "token inválido" justo al recién comprar.
function storeTokens() {
  return getStore({ name: 'entregas', consistency: 'strong' });
}
function storeProductos() {
  return getStore({ name: 'productos', consistency: 'strong' });
}

function nuevoToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Crea el token de descarga para una compra ya confirmada.
async function crearEntrega({ email, lines, orderRef, provider }) {
  const token = nuevoToken();
  const ahora = Date.now();
  await storeTokens().setJSON(token, {
    email: email || null,
    orderRef: orderRef || null,
    provider: provider || null,
    archivos: lines.map(({ product }) => product.downloadFile).filter(Boolean),
    creado: ahora,
    vence: ahora + DIAS_VALIDEZ * 24 * 60 * 60 * 1000,
    descargas: 0,
    maxDescargas: MAX_DESCARGAS
  });
  return token;
}

// Valida el token contra un archivo concreto. Devuelve { ok, motivo, registro }.
async function validarEntrega(token, archivo) {
  if (!token || !archivo) return { ok: false, motivo: 'faltan_datos' };
  const registro = await storeTokens().get(token, { type: 'json' });
  if (!registro) return { ok: false, motivo: 'no_existe' };
  if (Date.now() > registro.vence) return { ok: false, motivo: 'vencido', registro };
  if (registro.descargas >= registro.maxDescargas) return { ok: false, motivo: 'agotado', registro };
  if (!registro.archivos.includes(archivo)) return { ok: false, motivo: 'archivo_no_incluido', registro };
  return { ok: true, registro };
}

async function registrarDescarga(token, registro) {
  await storeTokens().setJSON(token, { ...registro, descargas: registro.descargas + 1, ultima: Date.now() });
}

function urlDescarga(siteUrl, token, archivo) {
  return `${siteUrl}/.netlify/functions/descargar?t=${encodeURIComponent(token)}&f=${encodeURIComponent(archivo)}`;
}

module.exports = {
  storeTokens, storeProductos, crearEntrega, validarEntrega,
  registrarDescarga, urlDescarga, DIAS_VALIDEZ, MAX_DESCARGAS
};
