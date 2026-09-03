// Puente entre las funciones estilo Lambda (exports.handler = (event) => …) y
// Netlify Blobs.
//
// ESTE ERA EL BUG. En las funciones con firma Lambda, Netlify NO inyecta la
// variable NETLIFY_BLOBS_CONTEXT: manda el contexto dentro del propio evento,
// en event.blobs (JSON en base64) más las cabeceras x-nf-site-id y
// x-nf-deploy-id. Si no se traduce, getStore() lanza
// MissingBlobsEnvironmentError y toda operación de Blobs falla — registro de
// cuentas, sesiones, pedidos, cupones y entregas incluidos.
//
// connectLambda() hace esa traducción. Hay que llamarlo al principio de cada
// handler que toque Blobs, antes del primer getStore().
const { connectLambda } = require('@netlify/blobs');

let avisado = false;

function conectarBlobs(event) {
  // En `netlify dev` y en las pruebas locales el contexto sí llega por
  // variable de entorno y no hay event.blobs: ahí no hay nada que traducir.
  if (!event || !event.blobs) {
    if (!process.env.NETLIFY_BLOBS_CONTEXT && !avisado) {
      avisado = true;
      console.warn('[YEAH] sin contexto de Blobs: ni event.blobs ni NETLIFY_BLOBS_CONTEXT');
    }
    return false;
  }
  try {
    connectLambda(event);
    return true;
  } catch (err) {
    console.error('[YEAH] no se pudo conectar Blobs desde el evento:', err);
    return false;
  }
}

module.exports = { conectarBlobs };
