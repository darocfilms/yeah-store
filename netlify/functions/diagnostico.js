// Diagnóstico de la infraestructura, para no volver a adivinar por qué algo
// falla en producción. Devuelve el estado real de Blobs, del correo y de las
// pasarelas — nombres de variables y resultados, NUNCA valores de secretos.
//
//   curl -H "x-admin-token: $ADMIN_TOKEN" \
//     https://TU-SITIO.netlify.app/.netlify/functions/diagnostico
const { conectarBlobs } = require('./_lib/blobs');
const { requiereAdminOToken } = require('./_lib/auth-admin');
const { getStore } = require('@netlify/blobs');

const presente = (nombre) => Boolean(process.env[nombre]);

exports.handler = async (event) => {
  const conectado = conectarBlobs(event);

  const guard = await requiereAdminOToken(event).catch((err) => ({
    error: {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      // Si la guarda misma explota es porque Blobs no responde: decirlo.
      body: JSON.stringify({ error: 'La verificación de acceso falló.', detalle: String(err && err.name) })
    }
  }));
  if (guard.error) return guard.error;

  // Ida y vuelta real contra Blobs: escribir, leer y borrar.
  const blobs = { conectado, contextoEnEvento: Boolean(event && event.blobs), variableDeEntorno: presente('NETLIFY_BLOBS_CONTEXT') };
  try {
    const store = getStore({ name: 'diagnostico', consistency: 'strong' });
    const clave = 'ping-' + Date.now();
    await store.setJSON(clave, { ok: true, cuando: Date.now() });
    const leido = await store.get(clave, { type: 'json' });
    await store.delete(clave);
    blobs.escrituraYLectura = Boolean(leido && leido.ok);
  } catch (err) {
    blobs.escrituraYLectura = false;
    blobs.error = String((err && err.name) || err);
    blobs.mensaje = String((err && err.message) || '').slice(0, 300);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      node: process.version,
      blobs,
      // Solo si están definidas: nunca el contenido.
      configuracion: {
        SITE_URL: presente('SITE_URL'),
        ADMIN_TOKEN: presente('ADMIN_TOKEN'),
        ADMIN_INITIAL_PASSWORD: presente('ADMIN_INITIAL_PASSWORD'),
        RESEND_API_KEY: presente('RESEND_API_KEY'),
        EMAIL_FROM: presente('EMAIL_FROM'),
        STRIPE_SECRET_KEY: presente('STRIPE_SECRET_KEY'),
        STRIPE_WEBHOOK_SECRET: presente('STRIPE_WEBHOOK_SECRET'),
        MP_ACCESS_TOKEN: presente('MP_ACCESS_TOKEN'),
        PAYPAL_CLIENT_ID: presente('PAYPAL_CLIENT_ID'),
        PAYPAL_CLIENT_SECRET: presente('PAYPAL_CLIENT_SECRET'),
        USD_CLP_RATE: presente('USD_CLP_RATE')
      }
    })
  };
};
