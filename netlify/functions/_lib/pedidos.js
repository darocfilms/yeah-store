// Registro de compras confirmadas. Alimenta el historial del cliente y las
// estadísticas del panel.
const { store } = require('./auth');

const storePedidos = () => store('pedidos');

async function guardarPedido({ orderRef, email, lines, total, provider, cupon, descuento }) {
  const id = String(orderRef || Date.now());
  const pedido = {
    id,
    email: (email || '').toLowerCase() || null,
    items: lines.map(({ product, qty }) => ({ id: product.id, sku: product.sku, nombre: product.name, precio: product.price, qty })),
    subtotal: lines.reduce((s, l) => s + l.product.price * l.qty, 0),
    descuento: descuento || 0,
    total,
    cupon: cupon || null,
    provider: provider || null,
    fecha: Date.now()
  };
  await storePedidos().setJSON(id, pedido);
  return pedido;
}

async function listarPedidos() {
  const { blobs } = await storePedidos().list();
  const pedidos = await Promise.all(
    blobs.map((b) => storePedidos().get(b.key, { type: 'json' }).catch(() => null))
  );
  return pedidos.filter(Boolean).sort((a, b) => b.fecha - a.fecha);
}

async function listarPedidosDe(email) {
  const objetivo = (email || '').toLowerCase();
  return (await listarPedidos()).filter((p) => p.email === objetivo);
}

module.exports = { storePedidos, guardarPedido, listarPedidos, listarPedidosDe };
