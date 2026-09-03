// Embudo de conversión sin cookies ni terceros: un contador por día y por
// paso, nada que permita reconstruir a una persona.
const { store } = require('./auth');

const PASOS = ['visita', 'producto', 'carrito', 'pago'];
const storeEmbudo = () => store('embudo');

const claveDia = (ms) => new Date(ms || Date.now()).toISOString().slice(0, 10);

async function sumarPaso(paso) {
  if (!PASOS.includes(paso)) return false;
  const clave = claveDia();
  const dia = (await storeEmbudo().get(clave, { type: 'json' })) || { fecha: clave };
  dia[paso] = (dia[paso] || 0) + 1;
  await storeEmbudo().setJSON(clave, dia);
  return true;
}

// Suma los últimos N días en un solo objeto: el embudo se lee como total,
// no día a día — con estos volúmenes un desglose diario sería ruido.
async function resumen(dias = 30) {
  const desde = Date.now() - dias * 24 * 3600 * 1000;
  const { blobs } = await storeEmbudo().list();
  const relevantes = blobs.filter((b) => b.key >= claveDia(desde));
  const dias_ = await Promise.all(
    relevantes.map((b) => storeEmbudo().get(b.key, { type: 'json' }).catch(() => null))
  );
  const total = { visita: 0, producto: 0, carrito: 0, pago: 0 };
  for (const d of dias_) {
    if (!d) continue;
    for (const p of PASOS) total[p] += d[p] || 0;
  }
  return total;
}

module.exports = { PASOS, storeEmbudo, sumarPaso, resumen };
