// Fuente única de verdad de precios/productos para las funciones serverless.
// Nunca confiar en precios enviados por el cliente — siempre recalcular desde aquí.
const products = require('../../../public/products.json');

function getProduct(id) {
  return products.find((p) => p.id === Number(id));
}

// items: [{id, qty}] — payload del cliente, no confiable. Devuelve líneas con
// precios y productos reales tomados del servidor.
function priceLineItems(items) {
  const lines = [];
  for (const it of Array.isArray(items) ? items : []) {
    const p = getProduct(it && it.id);
    if (!p) continue;
    const qty = Math.max(1, Math.min(50, parseInt(it.qty, 10) || 1));
    lines.push({ product: p, qty });
  }
  return lines;
}

function computeTotal(lines) {
  return lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
}

// La tienda cobra en CLP, pero PayPal no acepta CLP como moneda de transacción,
// así que ese método cobra el equivalente en USD. La tasa es fija y se define en
// USD_CLP_RATE — revísala periódicamente: si el dólar se mueve mucho y no la
// actualizas, cobrarás de más o de menos por PayPal.
const DEFAULT_USD_CLP_RATE = 936;

function usdClpRate() {
  const raw = parseFloat(process.env.USD_CLP_RATE);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_USD_CLP_RATE;
}

// Devuelve un string con 2 decimales, que es lo que espera la API de PayPal.
function clpToUsd(amountClp) {
  return (amountClp / usdClpRate()).toFixed(2);
}

module.exports = { products, getProduct, priceLineItems, computeTotal, clpToUsd, usdClpRate };
