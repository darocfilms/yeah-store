(function () {
  'use strict';

  var usuario = null;
  var vista = 'login';   // 'login' | 'registro' | 'perfil'

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var fmt = function (n) { return '$' + new Intl.NumberFormat('es-CL').format(n) + ' CLP'; };

  function api(ruta, opciones) {
    return fetch('/.netlify/functions/' + ruta, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    }, opciones || {})).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, datos: d }; });
    });
  }

  function pintarBotonHeader() {
    var btn = $('cuentaBtn');
    if (!btn) return;
    btn.textContent = usuario ? (usuario.nombre || '').split(' ')[0] || 'Mi cuenta' : 'Ingresar';
    btn.classList.toggle('activo', !!usuario);
  }

  function abrir(v) {
    vista = v || (usuario ? 'perfil' : 'login');
    render();
    $('cuentaScrim').hidden = false;
    $('cuentaModal').classList.add('open');
    $('cuentaModal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function cerrar() {
    $('cuentaScrim').hidden = true;
    $('cuentaModal').classList.remove('open');
    $('cuentaModal').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function campo(id, etiqueta, tipo, extra) {
    return '<label class="campo"><span>' + etiqueta + '</span>' +
      '<input type="' + tipo + '" id="' + id + '" ' + (extra || '') + '></label>';
  }

  function render() {
    var body = $('cuentaBody');
    $('cuentaKicker').textContent = vista === 'perfil' ? 'MI CUENTA' : vista === 'registro' ? 'CREAR CUENTA' : 'INGRESAR';

    if (vista === 'perfil' && usuario) {
      body.innerHTML =
        '<h2>Hola, ' + esc((usuario.nombre || '').split(' ')[0]) + '</h2>' +
        '<p class="cuenta-dato">' + esc(usuario.email) + (usuario.rol === 'admin' ? ' · <strong>ADMIN</strong>' : '') + '</p>' +
        (usuario.rol === 'admin' ? '<a href="admin.html" class="btn-primary-lime cuenta-admin-link">Ir al panel</a>' : '') +
        '<div id="misCompras"><p class="cuenta-cargando">Cargando tus compras…</p></div>' +
        '<details class="cuenta-clave"><summary>Cambiar contraseña</summary>' +
          '<form id="formClave">' +
            campo('claveActual', 'Contraseña actual', 'password', 'autocomplete="current-password" required') +
            campo('claveNueva', 'Contraseña nueva', 'password', 'autocomplete="new-password" minlength="8" required') +
            '<p class="cuenta-msg" id="claveMsg"></p>' +
            '<button type="submit" class="btn-outline btn-block">Guardar contraseña</button>' +
          '</form>' +
        '</details>' +
        '<button type="button" class="btn-outline btn-block" id="btnSalir">Cerrar sesión</button>';
      $('btnSalir').addEventListener('click', salir);
      $('formClave').addEventListener('submit', cambiarClave);
      cargarCompras();
      return;
    }

    if (vista === 'registro') {
      body.innerHTML =
        '<h2>Crear cuenta</h2>' +
        '<p class="cuenta-intro">Para llevar el registro de tus compras y volver a bajar tus archivos cuando quieras.</p>' +
        '<form id="formCuenta">' +
          campo('regNombre', 'Nombre', 'text', 'autocomplete="name" required') +
          campo('regNacimiento', 'Fecha de nacimiento', 'date', 'required') +
          campo('regEmail', 'Correo', 'email', 'autocomplete="email" required') +
          campo('regClave', 'Contraseña', 'password', 'autocomplete="new-password" minlength="8" required') +
          '<p class="cuenta-msg" id="cuentaMsg"></p>' +
          '<button type="submit" class="btn-primary-dark">Crear cuenta</button>' +
        '</form>' +
        '<p class="cuenta-alt">¿Ya tienes cuenta? <button type="button" id="irLogin">Ingresar</button></p>';
      $('irLogin').addEventListener('click', function () { vista = 'login'; render(); });
      $('formCuenta').addEventListener('submit', registrar);
      return;
    }

    body.innerHTML =
      '<h2>Ingresar</h2>' +
      '<form id="formCuenta">' +
        campo('logEmail', 'Correo', 'email', 'autocomplete="email" required') +
        campo('logClave', 'Contraseña', 'password', 'autocomplete="current-password" required') +
        '<p class="cuenta-msg" id="cuentaMsg"></p>' +
        '<button type="submit" class="btn-primary-dark">Entrar</button>' +
      '</form>' +
      '<p class="cuenta-alt">¿No tienes cuenta? <button type="button" id="irRegistro">Crear una</button></p>';
    $('irRegistro').addEventListener('click', function () { vista = 'registro'; render(); });
    $('formCuenta').addEventListener('submit', entrar);
  }

  function cambiarClave(e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type=submit]');
    var msg = $('claveMsg');
    btn.disabled = true; btn.textContent = 'Guardando…';
    msg.textContent = ''; msg.className = 'cuenta-msg';
    api('cuenta-clave', {
      method: 'POST',
      body: JSON.stringify({ actual: $('claveActual').value, nueva: $('claveNueva').value })
    }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Guardar contraseña';
      if (!r.ok) {
        msg.textContent = r.datos.error || 'No se pudo cambiar.';
        msg.className = 'cuenta-msg error';
        return;
      }
      e.target.reset();
      msg.textContent = 'Contraseña actualizada.';
      msg.className = 'cuenta-msg ok';
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Guardar contraseña';
      msg.textContent = 'No se pudo conectar.';
      msg.className = 'cuenta-msg error';
    });
  }

  // El código solo aparece cuando el servidor falló de verdad (un 500). No le
  // dice nada al comprador, pero convierte "algo salió mal" en algo que se
  // puede diagnosticar sin adivinar.
  function mostrarError(texto, codigo) {
    var m = $('cuentaMsg');
    if (m) {
      m.textContent = codigo ? texto + ' (' + codigo + ')' : texto;
      m.className = 'cuenta-msg error';
    }
  }

  function registrar(e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Creando…';
    api('cuenta-registro', {
      method: 'POST',
      body: JSON.stringify({
        nombre: $('regNombre').value, nacimiento: $('regNacimiento').value,
        email: $('regEmail').value, clave: $('regClave').value
      })
    }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Crear cuenta';
      if (!r.ok) return mostrarError(r.datos.error || 'No se pudo crear la cuenta.', r.datos.codigo);
      usuario = r.datos.usuario; pintarBotonHeader(); vista = 'perfil'; render();
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Crear cuenta';
      mostrarError('No se pudo conectar.');
    });
  }

  function entrar(e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Entrando…';
    api('cuenta-login', {
      method: 'POST',
      body: JSON.stringify({ email: $('logEmail').value, clave: $('logClave').value })
    }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Entrar';
      if (!r.ok) return mostrarError(r.datos.error || 'No se pudo iniciar sesión.', r.datos.codigo);
      usuario = r.datos.usuario; pintarBotonHeader(); vista = 'perfil'; render();
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Entrar';
      mostrarError('No se pudo conectar.');
    });
  }

  function salir() {
    api('cuenta-logout', { method: 'POST' }).then(function () {
      usuario = null; pintarBotonHeader(); cerrar();
    });
  }

  function cargarCompras() {
    api('cuenta-perfil').then(function (r) {
      var host = $('misCompras');
      if (!host) return;
      if (!r.ok) { host.innerHTML = ''; return; }
      var pedidos = r.datos.pedidos || [];
      if (!pedidos.length) {
        host.innerHTML = '<p class="cuenta-vacio">Todavía no tienes compras.</p>';
        return;
      }
      host.innerHTML = '<p class="cuenta-seccion">Tus compras</p>' + pedidos.map(function (p) {
        return '<div class="compra">' +
          '<div class="compra-fecha">' + new Date(p.fecha).toLocaleDateString('es-CL') + '</div>' +
          '<div class="compra-items">' + p.items.map(function (i) { return esc(i.nombre); }).join(', ') + '</div>' +
          '<div class="compra-total">' + fmt(p.total) + '</div>' +
        '</div>';
      }).join('');
    });
  }

  function init() {
    $('cuentaBtn').addEventListener('click', function () { abrir(usuario ? 'perfil' : 'login'); });
    $('cerrarCuenta').addEventListener('click', cerrar);
    $('cuentaScrim').addEventListener('click', cerrar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('cuentaModal').classList.contains('open')) cerrar();
    });
    // ¿Hay sesión activa? La cookie es httpOnly, así que se pregunta al servidor.
    api('cuenta-perfil').then(function (r) {
      if (r.ok) { usuario = r.datos.usuario; pintarBotonHeader(); }
    }).catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', init);
})();
