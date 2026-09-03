// Exporta pedidos o usuarios a CSV, para el contador y para el SII.
// Mismo rigor que el resto: la proyección de usuarios pasa por publico(), así
// que la sal y el hash no salen ni siquiera acá.
const A = require('./_lib/auth');
const { conectarBlobs } = require('./_lib/blobs');
const { requiereAdminOToken } = require('./_lib/auth-admin');
const { listarPedidos } = require('./_lib/pedidos');

// Excel en español abre CSV con punto y coma; con coma mete todo en una celda.
const SEP = ';';

function campo(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /["\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function aCsv(cabeceras, filas) {
  // BOM para que Excel reconozca los acentos.
  return '﻿' + [cabeceras, ...filas].map((f) => f.map(campo).join(SEP)).join('\r\n');
}
const fecha = (ms) => (ms ? new Date(ms).toISOString().slice(0, 19).replace('T', ' ') : '');

exports.handler = async (event) => {
  conectarBlobs(event);
  if (event.httpMethod !== 'GET') return A.json(405, { error: 'Método no permitido.' });

  const guard = await requiereAdminOToken(event);
  if (guard.error) return guard.error;

  const tipo = (event.queryStringParameters || {}).tipo === 'usuarios' ? 'usuarios' : 'pedidos';

  try {
    let csv;
    if (tipo === 'pedidos') {
      const pedidos = await listarPedidos();
      csv = aCsv(
        ['Fecha', 'Referencia', 'Estado', 'Cliente', 'Pasarela', 'Productos', 'Subtotal', 'Cupon', 'Descuento', 'Total'],
        pedidos.map((p) => [
          fecha(p.fecha), p.id, p.estado || 'pagado', p.email, p.provider,
          (p.items || []).map((i) => `${i.nombre} x${i.qty}`).join(' | '),
          p.subtotal, p.cupon || '', p.descuento || 0, p.total
        ])
      );
    } else {
      const pedidos = await listarPedidos();
      const { blobs } = await A.storeUsuarios().list();
      const usuarios = (await Promise.all(
        blobs.map((b) => A.storeUsuarios().get(b.key, { type: 'json' }).catch(() => null))
      )).filter(Boolean);

      csv = aCsv(
        ['Alta', 'Nombre', 'Correo', 'Nacimiento', 'Rol', 'Compras', 'Gastado'],
        usuarios.map((u) => {
          const pub = A.publico(u);
          const suyos = pedidos.filter((p) => p.email === pub.email);
          return [
            fecha(pub.creado), pub.nombre, pub.email, pub.nacimiento || '', pub.rol,
            suyos.length, suyos.reduce((s, p) => s + (p.total || 0), 0)
          ];
        })
      );
    }

    const nombre = `yeah-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Cache-Control': 'no-store'
      },
      body: csv
    };
  } catch (err) {
    console.error('[YEAH] admin-exportar error:', err);
    return A.json(500, { error: 'No se pudo generar el archivo.' });
  }
};
