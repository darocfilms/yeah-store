// Cupones de descuento temporales.
//
// REGLA DE ORO: el descuento se calcula SIEMPRE acá, en el servidor, a partir
// del código. El navegador manda un código, nunca un monto — si confiáramos en
// el monto, cualquiera editaría la petición y pagaría lo que quisiera.
const { store } = require('./auth');

const storeCupones = () => store('cupones');

const normalizar = (codigo) => String(codigo || '').trim().toUpperCase();

async function guardarCupon(datos) {
  const codigo = normalizar(datos.codigo);
  if (!/^[A-Z0-9_-]{3,32}$/.test(codigo)) throw new Error('Código inválido (3-32, letras, números, - y _).');
  if (datos.tipo !== 'porcentaje' && datos.tipo !== 'monto') throw new Error('Tipo inválido.');
  const valor = Number(datos.valor);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor inválido.');
  if (datos.tipo === 'porcentaje' && valor > 90) throw new Error('El descuento no puede superar el 90%.');

  const cupon = {
    codigo,
    tipo: datos.tipo,
    valor,
    desde: datos.desde ? new Date(datos.desde).getTime() : Date.now(),
    hasta: datos.hasta ? new Date(datos.hasta).getTime() : null,
    maxUsos: datos.maxUsos ? Number(datos.maxUsos) : null,
    usos: Number(datos.usos) || 0,
    activo: datos.activo !== false,
    creado: datos.creado || Date.now()
  };
  await storeCupones().setJSON(codigo, cupon);
  return cupon;
}

async function obtenerCupon(codigo) {
  return storeCupones().get(normalizar(codigo), { type: 'json' });
}

async function listarCupones() {
  const { blobs } = await storeCupones().list();
  const cupones = await Promise.all(
    blobs.map((b) => storeCupones().get(b.key, { type: 'json' }).catch(() => null))
  );
  return cupones.filter(Boolean).sort((a, b) => b.creado - a.creado);
}

async function eliminarCupon(codigo) {
  await storeCupones().delete(normalizar(codigo));
}

// Evalúa un cupón contra un subtotal. Devuelve siempre una forma estable.
async function evaluarCupon(codigo, subtotal) {
  if (!codigo) return { valido: false, motivo: 'sin_codigo', descuento: 0 };
  const c = await obtenerCupon(codigo);
  if (!c) return { valido: false, motivo: 'no_existe', descuento: 0 };
  if (!c.activo) return { valido: false, motivo: 'inactivo', descuento: 0 };
  const ahora = Date.now();
  if (c.desde && ahora < c.desde) return { valido: false, motivo: 'aun_no_vigente', descuento: 0 };
  if (c.hasta && ahora > c.hasta) return { valido: false, motivo: 'vencido', descuento: 0 };
  if (c.maxUsos && c.usos >= c.maxUsos) return { valido: false, motivo: 'agotado', descuento: 0 };

  let descuento = c.tipo === 'porcentaje' ? Math.round(subtotal * c.valor / 100) : Math.round(c.valor);
  // Nunca dejar el total en cero o negativo: las pasarelas rechazan montos así.
  descuento = Math.max(0, Math.min(descuento, subtotal - 1));
  return { valido: true, descuento, cupon: c, total: subtotal - descuento };
}

async function registrarUso(codigo) {
  const c = await obtenerCupon(codigo);
  if (c) await storeCupones().setJSON(c.codigo, { ...c, usos: (c.usos || 0) + 1 });
}

const MOTIVOS = {
  sin_codigo: 'Ingresa un código.',
  no_existe: 'Ese cupón no existe.',
  inactivo: 'Ese cupón está desactivado.',
  aun_no_vigente: 'Ese cupón todavía no está vigente.',
  vencido: 'Ese cupón ya venció.',
  agotado: 'Ese cupón alcanzó su límite de usos.'
};

module.exports = { storeCupones, guardarCupon, obtenerCupon, listarCupones, eliminarCupon, evaluarCupon, registrarUso, MOTIVOS, normalizar };
