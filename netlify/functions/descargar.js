// Entrega el archivo al comprador. Valida el token, cuenta la descarga y
// devuelve el binario directo desde Blobs — sin redirecciones intermedias,
// para que el primer clic ya empiece a bajar.
const { storeProductos, validarEntrega, registrarDescarga } = require('./_lib/entrega');

const MENSAJES = {
  faltan_datos: 'Enlace incompleto.',
  no_existe: 'Este enlace de descarga no es válido.',
  vencido: 'Este enlace venció. Escríbenos por WhatsApp y te generamos uno nuevo.',
  agotado: 'Este enlace alcanzó el máximo de descargas. Escríbenos por WhatsApp.',
  archivo_no_incluido: 'Ese archivo no corresponde a esta compra.'
};

function paginaError(mensaje) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Descarga — YEAH!</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#EDEBE4;color:#0B0B0A;
font-family:Archivo,Helvetica,sans-serif;padding:24px}div{max-width:420px}h1{font-size:22px;margin:0 0 12px}
p{font-size:15px;line-height:1.6;color:#5F5C53}a{color:#0B0B0A}</style></head>
<body><div><h1>No pudimos entregar tu descarga</h1><p>${mensaje}</p>
<p><a href="https://wa.me/56943801816">Escribinos por WhatsApp</a></p></div></body></html>`;
}

exports.handler = async (event) => {
  const { t: token, f: archivo } = event.queryStringParameters || {};

  try {
    const check = await validarEntrega(token, archivo);
    if (!check.ok) {
      return {
        statusCode: check.motivo === 'no_existe' ? 404 : 410,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        body: paginaError(MENSAJES[check.motivo] || 'Enlace no válido.')
      };
    }

    const datos = await storeProductos().get(archivo, { type: 'arrayBuffer' });
    if (!datos) {
      console.error('[YEAH] descargar: el archivo no está en el store de productos:', archivo);
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        body: paginaError('El archivo no está disponible en este momento. Escríbenos y lo resolvemos enseguida.')
      };
    }

    // Se cuenta después de tener el archivo en mano: si la lectura falla, el
    // comprador no pierde una descarga de su cupo.
    await registrarDescarga(token, check.registro);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archivo}"`,
        'Cache-Control': 'no-store'
      },
      body: Buffer.from(datos).toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    console.error('[YEAH] descargar error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: paginaError('Hubo un problema al preparar tu descarga.')
    };
  }
};
