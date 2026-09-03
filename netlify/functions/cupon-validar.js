// Valida un código y devuelve el descuento calculado, para mostrarlo en el
// checkout antes de pagar. Es informativo: el cobro real vuelve a evaluar el
// cupón en el servidor, así que manipular esta respuesta no sirve de nada.
const { priceLineItems, computeTotal } = require('./_lib/products');
const { evaluarCupon, MOTIVOS } = require('./_lib/cupones');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const lines = priceLineItems(body.items);
    if (!lines.length) return { statusCode: 400, body: JSON.stringify({ error: 'Carrito vacío.' }) };

    const subtotal = computeTotal(lines);
    const r = await evaluarCupon(body.cupon, subtotal);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(r.valido
        ? { valido: true, codigo: r.cupon.codigo, descuento: r.descuento, subtotal, total: r.total }
        : { valido: false, mensaje: MOTIVOS[r.motivo] || 'Cupón no válido.' })
    };
  } catch (err) {
    console.error('[YEAH] cupon-validar error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo validar el cupón.' }) };
  }
};
