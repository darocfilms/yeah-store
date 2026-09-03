// Sube (o reemplaza) el archivo de un producto en el store privado de Blobs.
// Protegido con ADMIN_TOKEN — es la puerta de entrada a los archivos que se venden.
//
//   curl -X POST "https://TU-SITIO.netlify.app/.netlify/functions/admin-subir-producto?f=filter-lab-fx.zip" \
//        -H "x-admin-token: $ADMIN_TOKEN" \
//        --data-binary @filter-lab-fx.zip
const { storeProductos } = require('./_lib/entrega');
const { requiereAdminOToken } = require('./_lib/auth-admin');

const { conectarBlobs } = require('./_lib/blobs');

exports.handler = async (event) => {
  conectarBlobs(event);
  // Dos vías de acceso: sesión de admin (el panel) o ADMIN_TOKEN (scripts y
  // curl). Cualquiera de las dos, nunca ninguna.
  const guard = await requiereAdminOToken(event);
  if (guard.error) return guard.error;

  const archivo = (event.queryStringParameters || {}).f;
  if (!archivo || !/^[a-zA-Z0-9._-]+$/.test(archivo)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Parámetro f inválido (nombre de archivo).' }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const { blobs } = await storeProductos().list();
      return { statusCode: 200, body: JSON.stringify({ archivos: blobs.map((b) => b.key) }) };
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
    if (!event.body) return { statusCode: 400, body: JSON.stringify({ error: 'Cuerpo vacío.' }) };

    const datos = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
    await storeProductos().set(archivo, datos);
    return { statusCode: 200, body: JSON.stringify({ ok: true, archivo, bytes: datos.length }) };
  } catch (err) {
    console.error('[YEAH] admin-subir-producto error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo guardar el archivo.' }) };
  }
};
