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

module.exports = { products, getProduct, priceLineItems, computeTotal };
