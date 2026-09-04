// Puente entre las funciones estilo Lambda (exports.handler = (event) => …) y
// Netlify Blobs.
//
// En las funciones con firma Lambda, Netlify NO inyecta la variable
// NETLIFY_BLOBS_CONTEXT: manda el contexto dentro del propio evento, en
// event.blobs (JSON en base64) más las cabeceras x-nf-site-id y
// x-nf-deploy-id. Sin traducirlo, getStore() lanza
// MissingBlobsEnvironmentError y falla TODO lo que usa Blobs.
//
// La traducción se hace acá a mano y no con el connectLambda() del paquete,
// por una razón concreta: connectLambda solo lee `url` y `token` del evento e
// ignora `url_uncached`. Sin uncachedEdgeURL, cualquier operación con
// consistencia fuerte revienta con BlobsConsistencyError — y en esta tienda
// TODOS los almacenes la piden, porque una sesión o un token de descarga
// recién escritos tienen que poder leerse en la petición siguiente.
const { setEnvironmentContext } = require('@netlify/blobs');

let avisado = false;

function conectarBlobs(event) {
  // En `netlify dev` y en las pruebas locales el contexto llega por variable
  // de entorno y no hay event.blobs: ahí no hay nada que traducir.
  if (!event || !event.blobs) {
    if (!process.env.NETLIFY_BLOBS_CONTEXT && !avisado) {
      avisado = true;
      console.warn('[YEAH] sin contexto de Blobs: ni event.blobs ni NETLIFY_BLOBS_CONTEXT');
    }
    return false;
  }

  try {
    const datos = JSON.parse(Buffer.from(event.blobs, 'base64').toString('utf8'));
    const cabeceras = event.headers || {};

    // Si el runtime no manda la URL sin caché, se usa la normal: leer algo
    // quizá desactualizado es mucho mejor que tumbar la tienda entera.
    if (!datos.url_uncached && !avisado) {
      avisado = true;
      console.warn('[YEAH] el evento no trae url_uncached: la consistencia fuerte será solo nominal');
    }

    setEnvironmentContext({
      deployID: cabeceras['x-nf-deploy-id'],
      siteID: cabeceras['x-nf-site-id'],
      edgeURL: datos.url,
      uncachedEdgeURL: datos.url_uncached || datos.url,
      primaryRegion: datos.primary_region,
      token: datos.token
    });
    return true;
  } catch (err) {
    console.error('[YEAH] no se pudo conectar Blobs desde el evento:', err);
    return false;
  }
}

module.exports = { conectarBlobs };
