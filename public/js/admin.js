(function () {
  'use strict';

  // Set categórico validado contra el fondo crema (#EDEBE4): banda de
  // luminosidad, piso de croma, separación bajo daltonismo y contraste.
  var SERIES = ['#2266C4', '#C25A12', '#00855C', '#A02A96'];
  var datos = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var nf = new Intl.NumberFormat('es-CL');
  function clp(n) { return '$' + nf.format(Math.round(n || 0)); }
  function fecha(ms) { return new Date(ms).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' }); }

  function api(ruta, opciones) {
    return fetch('/.netlify/functions/' + ruta, Object.assign({
      headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin'
    }, opciones || {})).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, datos: d }; });
    });
  }

  // ---------- resumen ----------
  function stat(label, valor, nota, clase) {
    return '<div class="stat"><div class="stat-label">' + label + '</div>' +
      '<div class="stat-valor">' + valor + '</div>' +
      (nota ? '<div class="stat-nota ' + (clase || '') + '">' + nota + '</div>' : '') + '</div>';
  }

  // Línea de ingresos. Serie única: sin leyenda, el título la nombra.
  function graficoLinea(serie) {
    if (!serie.some(function (d) { return d.ingresos > 0; })) {
      return '<p class="figura-vacia">Todavía no hay ventas que graficar.</p>';
    }
    var W = 720, H = 220, ML = 58, MR = 12, MT = 12, MB = 28;
    var pw = W - ML - MR, ph = H - MT - MB;
    var max = Math.max.apply(null, serie.map(function (d) { return d.ingresos; })) || 1;
    var techo = Math.ceil(max / 10000) * 10000 || 10000;
    var x = function (i) { return ML + (serie.length === 1 ? pw / 2 : (i / (serie.length - 1)) * pw); };
    var y = function (v) { return MT + ph - (v / techo) * ph; };

    var lineas = '', etiquetasY = '';
    for (var t = 0; t <= 4; t++) {
      var v = techo * t / 4, yy = y(v);
      lineas += '<line class="grid-line" x1="' + ML + '" y1="' + yy + '" x2="' + (W - MR) + '" y2="' + yy + '"/>';
      etiquetasY += '<text class="eje-txt" x="' + (ML - 8) + '" y="' + (yy + 3) + '" text-anchor="end">' + clp(v) + '</text>';
    }
    var d = serie.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.ingresos); }).join(' ');
    var area = d + ' L' + x(serie.length - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z';

    // Solo se etiquetan algunas fechas: nunca un número en cada punto. La
    // última siempre se muestra, y por eso se descarta cualquier etiqueta del
    // paso regular que caiga demasiado cerca de ella: si no, se pisan.
    var ultima = serie.length - 1;
    var etiquetasX = serie.map(function (p, i) {
      if (i !== ultima && (i % 7 !== 0 || ultima - i < 4)) return '';
      var dia = p.fecha.slice(8) + '/' + p.fecha.slice(5, 7);
      return '<text class="eje-txt" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + dia + '</text>';
    }).join('');

    // Puntos con área de hover más grande que la marca visible.
    var puntos = serie.map(function (p, i) {
      return '<g><circle class="punto" cx="' + x(i) + '" cy="' + y(p.ingresos) + '" r="3"/>' +
        '<circle cx="' + x(i) + '" cy="' + y(p.ingresos) + '" r="11" fill="transparent">' +
        '<title>' + p.fecha + ' · ' + clp(p.ingresos) + ' · ' + p.pedidos + ' pedido(s)</title></circle></g>';
    }).join('');

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ingresos diarios de los últimos 30 días">' +
      lineas + etiquetasY + etiquetasX +
      '<path class="serie-area" d="' + area + '"/><path class="serie-linea" d="' + d + '"/>' + puntos + '</svg>';
  }

  function graficoBarras(filas, campoNombre, campoValor) {
    if (!filas.length) return '<p class="figura-vacia">Sin datos todavía.</p>';
    var max = Math.max.apply(null, filas.map(function (f) { return f[campoValor]; })) || 1;
    return filas.map(function (f, i) {
      var pct = Math.max(2, (f[campoValor] / max) * 100);
      return '<div class="barra-fila">' +
        '<div class="barra-nombre">' + esc(f[campoNombre]) + '</div>' +
        '<div class="barra-pista"><div class="barra" style="width:' + pct + '%;background:' + SERIES[i % SERIES.length] + '"></div></div>' +
        '<div class="barra-valor">' + clp(f[campoValor]) + '</div>' +
      '</div>';
    }).join('');
  }

  function pintarResumen() {
    var m = datos.metricas;
    var variacion = m.variacion30 == null ? '' :
      (m.variacion30 >= 0 ? '▲ ' : '▼ ') + Math.abs(m.variacion30) + '% vs 30 días previos';
    $('tab-resumen').innerHTML =
      '<div class="stat-row">' +
        stat('Ingresos totales', clp(m.ingresosTotales), m.pedidosTotales + ' pedidos') +
        stat('Últimos 30 días', clp(m.ingresos30), variacion, m.variacion30 >= 0 ? 'sube' : 'baja') +
        stat('Últimos 7 días', clp(m.ingresos7), m.pedidos7 + ' pedidos') +
        stat('Ticket promedio', clp(m.ticketPromedio), m.descuentoTotal ? clp(m.descuentoTotal) + ' en descuentos' : '') +
      '</div>' +
      '<div class="figura"><h3>Ingresos diarios</h3><p class="sub">Últimos 30 días, en pesos</p>' +
        graficoLinea(datos.serie) + '</div>' +
      '<div class="figura"><h3>Por pasarela de pago</h3><p class="sub">Ingresos acumulados</p>' +
        graficoBarras(datos.porPasarela, 'pasarela', 'ingresos') + '</div>' +
      '<div class="figura"><h3>Por producto</h3><p class="sub">Ingresos acumulados</p>' +
        graficoBarras(datos.porProducto, 'nombre', 'ingresos') + '</div>';
  }

  // ---------- pedidos ----------
  function pintarPedidos() {
    var p = datos.pedidos;
    $('tab-pedidos').innerHTML = !p.length
      ? '<div class="tabla-wrap"><p class="vacio">Todavía no hay pedidos.</p></div>'
      : '<div class="tabla-wrap"><table class="admin-tabla"><thead><tr>' +
        '<th>Fecha</th><th>Cliente</th><th>Productos</th><th>Pasarela</th><th>Cupón</th><th style="text-align:right">Total</th>' +
        '</tr></thead><tbody>' + p.map(function (o) {
          return '<tr><td>' + fecha(o.fecha) + '</td>' +
            '<td>' + esc(o.email || '—') + '</td>' +
            '<td>' + o.items.map(function (i) { return esc(i.nombre) + (i.qty > 1 ? ' ×' + i.qty : ''); }).join(', ') + '</td>' +
            '<td><span class="pill">' + esc(o.provider || '—') + '</span></td>' +
            '<td>' + (o.cupon ? '<span class="pill lima">' + esc(o.cupon) + '</span>' : '—') + '</td>' +
            '<td class="num">' + clp(o.total) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
  }

  // ---------- usuarios ----------
  function pintarUsuarios() {
    var u = datos.usuarios;
    $('tab-usuarios').innerHTML = !u.length
      ? '<div class="tabla-wrap"><p class="vacio">Todavía no hay usuarios registrados.</p></div>'
      : '<div class="tabla-wrap"><table class="admin-tabla"><thead><tr>' +
        '<th>Nombre</th><th>Correo</th><th>Nacimiento</th><th>Alta</th><th style="text-align:right">Compras</th><th style="text-align:right">Gastado</th>' +
        '</tr></thead><tbody>' + u.map(function (x) {
          return '<tr><td>' + esc(x.nombre) + (x.rol === 'admin' ? ' <span class="pill lima">admin</span>' : '') + '</td>' +
            '<td>' + esc(x.email) + '</td><td>' + esc(x.nacimiento || '—') + '</td>' +
            '<td>' + fecha(x.creado) + '</td>' +
            '<td class="num">' + x.compras + '</td><td class="num">' + clp(x.gastado) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
  }

  // ---------- cupones ----------
  function pintarCupones() {
    var c = datos.cupones;
    $('tab-cupones').innerHTML =
      '<div class="admin-form"><h3>Nuevo cupón</h3>' +
        '<div class="form-grid">' +
          '<label><span>Código</span><input type="text" id="cCodigo" placeholder="LANZAMIENTO25"></label>' +
          '<label><span>Tipo</span><select id="cTipo"><option value="porcentaje">Porcentaje</option><option value="monto">Monto fijo</option></select></label>' +
          '<label><span>Valor</span><input type="number" id="cValor" min="1" placeholder="25"></label>' +
          '<label><span>Vence</span><input type="date" id="cHasta"></label>' +
          '<label><span>Máx. usos</span><input type="number" id="cMax" min="1" placeholder="sin límite"></label>' +
        '</div>' +
        '<div class="acciones"><button type="button" class="btn-primary-lime" id="cGuardar">Crear cupón</button>' +
        '<span class="admin-msg" id="cMsg"></span></div></div>' +
      (!c.length
        ? '<div class="tabla-wrap"><p class="vacio">Sin cupones creados.</p></div>'
        : '<div class="tabla-wrap"><table class="admin-tabla"><thead><tr>' +
          '<th>Código</th><th>Descuento</th><th>Vigencia</th><th style="text-align:right">Usos</th><th></th>' +
          '</tr></thead><tbody>' + c.map(function (x) {
            var vigente = (!x.hasta || Date.now() <= x.hasta) && x.activo && (!x.maxUsos || x.usos < x.maxUsos);
            return '<tr><td><span class="pill' + (vigente ? ' lima' : '') + '">' + esc(x.codigo) + '</span></td>' +
              '<td>' + (x.tipo === 'porcentaje' ? x.valor + '%' : clp(x.valor)) + '</td>' +
              '<td>' + (x.hasta ? 'hasta ' + fecha(x.hasta) : 'sin vencimiento') + (vigente ? '' : ' · vencido') + '</td>' +
              '<td class="num">' + x.usos + (x.maxUsos ? ' / ' + x.maxUsos : '') + '</td>' +
              '<td style="text-align:right"><button type="button" class="btn-mini" data-borrar="' + esc(x.codigo) + '">Borrar</button></td></tr>';
          }).join('') + '</tbody></table></div>');

    $('cGuardar').addEventListener('click', crearCupon);
    Array.prototype.forEach.call(document.querySelectorAll('[data-borrar]'), function (b) {
      b.addEventListener('click', function () { borrarCupon(b.getAttribute('data-borrar')); });
    });
  }

  function crearCupon() {
    var msg = $('cMsg'), btn = $('cGuardar');
    btn.disabled = true; msg.textContent = ''; msg.className = 'admin-msg';
    api('admin-cupones', {
      method: 'POST',
      body: JSON.stringify({
        codigo: $('cCodigo').value, tipo: $('cTipo').value, valor: $('cValor').value,
        hasta: $('cHasta').value || null, maxUsos: $('cMax').value || null
      })
    }).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { msg.textContent = r.datos.error || 'No se pudo crear.'; msg.className = 'admin-msg error'; return; }
      msg.textContent = 'Cupón creado.'; msg.className = 'admin-msg ok';
      cargar();
    });
  }

  function borrarCupon(codigo) {
    if (!window.confirm('¿Borrar el cupón ' + codigo + '?')) return;
    api('admin-cupones?codigo=' + encodeURIComponent(codigo), { method: 'DELETE' }).then(cargar);
  }

  // ---------- productos ----------
  function pintarProductos() {
    var subidos = datos.archivosSubidos || [];
    $('tab-productos').innerHTML =
      '<div class="admin-form"><h3>Archivos entregables</h3>' +
        '<p class="admin-msg">Estos son los .zip guardados en el almacén privado. Cada producto de la tienda entrega el archivo que declara en <code>downloadFile</code>.</p>' +
        '<div style="margin-top:16px">' + (subidos.length
          ? subidos.map(function (a) { return '<span class="pill lima" style="margin-right:8px">' + esc(a) + '</span>'; }).join('')
          : '<span class="admin-msg error">No hay ningún archivo subido todavía — las compras no se pueden entregar.</span>') +
        '</div></div>' +
      '<div class="tabla-wrap"><table class="admin-tabla"><thead><tr>' +
        '<th>Producto</th><th>SKU</th><th>Categoría</th><th>Archivo</th><th style="text-align:right">Precio</th>' +
        '</tr></thead><tbody>' + datos.productos.map(function (p) {
          var listo = subidos.indexOf(p.downloadFile) !== -1;
          return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.sku) + '</td>' +
            '<td><span class="pill">' + esc(p.cat) + '</span></td>' +
            '<td>' + esc(p.downloadFile) + (listo ? '' : ' <span class="pill" style="border-color:var(--red);color:var(--red)">falta subir</span>') + '</td>' +
            '<td class="num">' + clp(p.price) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
      '<p class="admin-msg" style="margin-top:16px">Para editar precios, textos o agregar productos, se modifica <code>public/products.json</code> en el repositorio y se despliega. Subir un .zip nuevo: ver <code>DEPLOY.md</code> §5.1.</p>';
  }

  // ---------- carga ----------
  function pintar() {
    pintarResumen(); pintarPedidos(); pintarUsuarios(); pintarCupones(); pintarProductos();
  }

  function cargar() {
    return api('admin-datos').then(function (r) {
      if (r.status === 401) { mostrarBloqueo('Necesitas iniciar sesión con la cuenta de administrador.'); return; }
      if (r.status === 403) { mostrarBloqueo('Esta cuenta no tiene acceso al panel.'); return; }
      if (!r.ok) { mostrarBloqueo('No se pudieron cargar los datos.'); return; }
      datos = r.datos;
      $('adminEstado').hidden = true;
      $('adminPanel').hidden = false;
      pintar();
    }).catch(function () { mostrarBloqueo('No se pudo conectar con el servidor.'); });
  }

  function mostrarBloqueo(texto) {
    var e = $('adminEstado');
    e.hidden = false;
    e.className = 'admin-estado error';
    e.innerHTML = esc(texto) + ' <a href="index.html" style="text-decoration:underline">Volver a la tienda</a>';
    $('adminPanel').hidden = true;
  }

  function init() {
    $('adminTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b) return;
      Array.prototype.forEach.call(document.querySelectorAll('.admin-tab'), function (t) { t.classList.remove('active'); });
      b.classList.add('active');
      Array.prototype.forEach.call(document.querySelectorAll('.admin-panel'), function (p) { p.hidden = true; });
      $('tab-' + b.getAttribute('data-tab')).hidden = false;
    });
    $('btnSalirAdmin').addEventListener('click', function () {
      api('cuenta-logout', { method: 'POST' }).then(function () { window.location.href = 'index.html'; });
    });
    api('cuenta-perfil').then(function (r) {
      if (r.ok && r.datos.usuario) $('adminEmail').textContent = r.datos.usuario.email;
    });
    cargar();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
