// Recibe un paso del embudo desde el navegador. No guarda IP, ni identificador
// de visitante, ni nada que permita reconstruir a una persona: solo incrementa
// el contador del día. Con eso alcanza para saber en qué escalón se cae la
// gente, que es la pregunta que importa cuando hay un solo producto.
const { conectarBlobs } = require('./_lib/blobs');
const { sumarPaso } = require('./_lib/embudo');

exports.handler = async (event) => {
  conectarBlobs(event);
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { paso } = JSON.parse(event.body || '{}');
    await sumarPaso(paso);
  } catch (err) {
    // Una métrica jamás debe romperle la página a nadie.
    console.error('[YEAH] evento error:', err);
  }
  // 204 siempre: al navegador no le interesa la respuesta y así no se cachea.
  return { statusCode: 204, body: '' };
};
