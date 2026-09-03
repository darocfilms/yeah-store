// Todo lo que consume el panel. Una sola función con secciones, para que el
// panel cargue de una y no dispare seis peticiones en paralelo.
//
// Protegida por sesión + rol admin: sin eso devuelve 401/403 y nunca toca los
// datos. Ningún campo sensible (salt, hash) sale de acá.
const A = require('./_lib/auth');
const { listarPedidos } = require('./_lib/pedidos');
const { listarCupones } = require('./_lib/cupones');
const { storeProductos } = require('./_lib/entrega');
const productos = require('../../public/products.json');

const DIA = 24 * 3600 * 1000;

function metricas(pedidos) {
  const ahora = Date.now();
  const ventana = (dias) => pedidos.filter((p) => ahora - p.fecha <= dias * DIA);
  const suma = (arr) => arr.reduce((s, p) => s + (p.total || 0), 0);

  const mes = ventana(30);
  const mesAnterior = pedidos.filter((p) => ahora - p.fecha > 30 * DIA && ahora - p.fecha <= 60 * DIA);
  const ingresos30 = suma(mes);
  const ingresosPrevio = suma(mesAnterior);

  return {
    ingresosTotales: suma(pedidos),
    pedidosTotales: pedidos.length,
    ingresos30,
    pedidos30: mes.length,
    ingresos7: suma(ventana(7)),
    pedidos7: ventana(7).length,
    ticketPromedio: pedidos.length ? Math.round(suma(pedidos) / pedidos.length) : 0,
    variacion30: ingresosPrevio ? Math.round(((ingresos30 - ingresosPrevio) / ingresosPrevio) * 100) : null,
    descuentoTotal: pedidos.reduce((s, p) => s + (p.descuento || 0), 0)
  };
}

// Serie diaria de los últimos N días, con los días sin ventas en cero para que
// el gráfico no mienta sobre la continuidad del tiempo.
function serieDiaria(pedidos, dias = 30) {
  const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0);
  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const inicio = hoy.getTime() - i * DIA;
    const delDia = pedidos.filter((p) => p.fecha >= inicio && p.fecha < inicio + DIA);
    serie.push({
      fecha: new Date(inicio).toISOString().slice(0, 10),
      ingresos: delDia.reduce((s, p) => s + (p.total || 0), 0),
      pedidos: delDia.length
    });
  }
  return serie;
}

function porPasarela(pedidos) {
  const acc = {};
  for (const p of pedidos) {
    const k = p.provider || 'desconocido';
    acc[k] = acc[k] || { pasarela: k, pedidos: 0, ingresos: 0 };
    acc[k].pedidos++; acc[k].ingresos += p.total || 0;
  }
  return Object.values(acc).sort((a, b) => b.ingresos - a.ingresos);
}

function porProducto(pedidos) {
  const acc = {};
  for (const p of pedidos) {
    for (const it of p.items || []) {
      acc[it.id] = acc[it.id] || { id: it.id, nombre: it.nombre, unidades: 0, ingresos: 0 };
      acc[it.id].unidades += it.qty;
      acc[it.id].ingresos += it.precio * it.qty;
    }
  }
  return Object.values(acc).sort((a, b) => b.ingresos - a.ingresos);
}

exports.handler = async (event) => {
  const { error } = await A.requiereAdmin(event);
  if (error) return error;

  try {
    const pedidos = await listarPedidos();

    const [usuariosRaw, cupones, archivos] = await Promise.all([
      A.storeUsuarios().list().then(({ blobs }) =>
        Promise.all(blobs.map((b) => A.storeUsuarios().get(b.key, { type: 'json' }).catch(() => null)))
      ),
      listarCupones(),
      storeProductos().list().then(({ blobs }) => blobs.map((b) => b.key)).catch(() => [])
    ]);

    // publico() recorta salt y hash: nunca salen del servidor.
    const usuarios = usuariosRaw.filter(Boolean).map((u) => {
      const suyos = pedidos.filter((p) => p.email === u.email);
      return {
        ...A.publico(u),
        compras: suyos.length,
        gastado: suyos.reduce((s, p) => s + (p.total || 0), 0)
      };
    }).sort((a, b) => b.creado - a.creado);

    return A.json(200, {
      metricas: metricas(pedidos),
      serie: serieDiaria(pedidos, 30),
      porPasarela: porPasarela(pedidos),
      porProducto: porProducto(pedidos),
      pedidos: pedidos.slice(0, 200),
      usuarios,
      cupones,
      productos,
      archivosSubidos: archivos
    });
  } catch (err) {
    console.error('[YEAH] admin-datos error:', err);
    return A.json(500, { error: 'No se pudieron cargar los datos.' });
  }
};
