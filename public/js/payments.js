(function () {
  'use strict';

  var METHODS = [
    { key: 'mercadopago', name: 'MercadoPago', note: 'CL · LATAM' },
    { key: 'stripe', name: 'Tarjeta de crédito o débito', note: 'STRIPE' },
    { key: 'paypal', name: 'PayPal', note: 'GLOBAL' },
    { key: 'transferencia', name: 'Transferencia bancaria', note: 'CL' }
  ];

  // TODO: reemplaza estos datos por los datos bancarios reales de la tienda.
  // No son datos reales — no los muestres a clientes hasta completarlos.
  var BANK_INFO = {
    bank: 'PENDIENTE — completar en js/payments.js',
    accountType: 'PENDIENTE',
    accountNumber: 'PENDIENTE',
    rut: 'PENDIENTE',
    holder: 'PENDIENTE',
    email: 'PENDIENTE'
  };

  var methodEl, panelEl, confirmBtn, statusText;
  var selectedMethod = 'mercadopago';
  var paypalSdkPromise = null;
  var paypalButtonsInstance = null;
  var orderRef = null;

  function Y() { return window.YEAH; }

  function $(id) { return document.getElementById(id); }

  function genRef() {
    return 'YEAH-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function cartItemsPayload() {
    return Y().state.cart.map(function (c) { return { id: c.id, qty: c.qty }; });
  }

  function setStatus(msg, isError) {
    if (!statusText) return;
    statusText.textContent = msg || '';
    statusText.classList.toggle('error', !!isError);
  }

  function setBusy(busy, label) {
    confirmBtn.disabled = busy;
    confirmBtn.textContent = label || (busy ? 'Procesando…' : 'Confirmar pago');
  }

  function renderMethods() {
    methodEl.innerHTML = METHODS.map(function (m) {
      var active = m.key === selectedMethod ? ' active' : '';
      return (
        '<button type="button" class="pay-method' + active + '" data-method="' + m.key + '">' +
          '<span class="pay-method-radio"><i></i></span>' +
          '<span class="pay-method-name">' + m.name + '</span>' +
          '<span class="pay-method-note">' + m.note + '</span>' +
        '</button>'
      );
    }).join('');
  }

  function renderPanel() {
    setStatus('');
    if (selectedMethod === 'mercadopago') {
      panelEl.innerHTML = '<div class="method-panel"><p>Al confirmar te llevamos al checkout seguro de MercadoPago para pagar con tarjeta, saldo en cuenta o efectivo.</p></div>';
      confirmBtn.hidden = false;
      setBusy(false);
    } else if (selectedMethod === 'stripe') {
      panelEl.innerHTML = '<div class="method-panel"><p>Al confirmar te llevamos al checkout seguro de Stripe para pagar con tarjeta de crédito o débito.</p></div>';
      confirmBtn.hidden = false;
      setBusy(false);
    } else if (selectedMethod === 'paypal') {
      panelEl.innerHTML = '<div id="paypal-buttons-container"></div><p class="pay-status" id="paypalStatus"></p>';
      confirmBtn.hidden = true;
      mountPaypalButtons();
    } else if (selectedMethod === 'transferencia') {
      orderRef = orderRef || genRef();
      panelEl.innerHTML =
        '<div class="method-panel">' +
          '<h4>Datos para transferir</h4>' +
          '<div class="bank-row"><span>Banco</span><span>' + BANK_INFO.bank + '</span></div>' +
          '<div class="bank-row"><span>Tipo de cuenta</span><span>' + BANK_INFO.accountType + '</span></div>' +
          '<div class="bank-row"><span>N° de cuenta</span><span>' + BANK_INFO.accountNumber + '</span></div>' +
          '<div class="bank-row"><span>RUT</span><span>' + BANK_INFO.rut + '</span></div>' +
          '<div class="bank-row"><span>Titular</span><span>' + BANK_INFO.holder + '</span></div>' +
          '<div class="bank-row"><span>Email para comprobante</span><span>' + BANK_INFO.email + '</span></div>' +
          '<div class="bank-row"><span>Referencia de tu pedido</span><span class="ref-code">' + orderRef + '</span></div>' +
        '</div>' +
        '<div class="method-panel">' +
          '<h4>Tu email</h4>' +
          '<input type="email" id="transferEmail" placeholder="tu@email.com" required style="width:100%;border:1.3px solid rgba(11,11,10,.3);border-radius:8px;padding:10px 12px;font-size:13px;">' +
        '</div>';
      confirmBtn.hidden = false;
      setBusy(false, 'Ya transferí, notificar pedido');
    }
  }

  function selectMethod(key) {
    selectedMethod = key;
    renderMethods();
    renderPanel();
  }

  // ---------- Stripe / MercadoPago (redirect checkout) ----------
  function startRedirectCheckout(endpoint) {
    setBusy(true, 'Redirigiendo…');
    setStatus('');
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cartItemsPayload() })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.url) throw new Error('Respuesta sin URL de pago');
        window.location.href = data.url;
      })
      .catch(function (err) {
        console.error('[YEAH] checkout error:', err);
        setBusy(false);
        setStatus('No se pudo iniciar el pago (¿faltan credenciales configuradas en Netlify?). Escríbenos por WhatsApp si el problema persiste.', true);
      });
  }

  // ---------- PayPal (inline buttons) ----------
  function loadPaypalSdk() {
    if (paypalSdkPromise) return paypalSdkPromise;
    paypalSdkPromise = fetch('/.netlify/functions/paypal-config')
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (!cfg || !cfg.clientId) throw new Error('PayPal no está configurado (falta PAYPAL_CLIENT_ID en Netlify)');
        return new Promise(function (resolve, reject) {
          if (window.paypal) return resolve(window.paypal);
          var s = document.createElement('script');
          s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(cfg.clientId) + '&currency=USD&intent=capture';
          s.onload = function () { resolve(window.paypal); };
          s.onerror = function () { reject(new Error('No se pudo cargar el SDK de PayPal')); };
          document.head.appendChild(s);
        });
      });
    return paypalSdkPromise;
  }

  function mountPaypalButtons() {
    var container = $('paypal-buttons-container');
    var status = $('paypalStatus');
    loadPaypalSdk()
      .then(function (paypal) {
        if (selectedMethod !== 'paypal') return; // user switched method while loading
        paypalButtonsInstance = paypal.Buttons({
          createOrder: function () {
            return fetch('/.netlify/functions/paypal-create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: cartItemsPayload() })
            })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (!data || !data.id) throw new Error('No se pudo crear la orden de PayPal');
                return data.id;
              });
          },
          onApprove: function (data) {
            status.textContent = 'Confirmando pago…';
            return fetch('/.netlify/functions/paypal-capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderID: data.orderID })
            })
              .then(function (r) { return r.json(); })
              .then(function (result) {
                if (!result || result.status !== 'COMPLETED') throw new Error('El pago no se pudo completar');
                Y().finishOrder();
                Y().showDone({});
              })
              .catch(function (err) {
                console.error('[YEAH] paypal capture error:', err);
                status.textContent = 'Hubo un problema confirmando el pago. Escríbenos por WhatsApp con tu comprobante.';
              });
          },
          onError: function (err) {
            console.error('[YEAH] paypal buttons error:', err);
            status.textContent = 'PayPal no está disponible en este momento.';
          }
        });
        container.innerHTML = '';
        paypalButtonsInstance.render(container);
      })
      .catch(function (err) {
        console.error('[YEAH] paypal load error:', err);
        container.innerHTML = '<p class="pay-status error">' + err.message + '</p>';
      });
  }

  // ---------- Transferencia (manual, pending confirmation) ----------
  function submitBankTransfer() {
    var emailInput = $('transferEmail');
    var email = emailInput ? emailInput.value.trim() : '';
    if (!email || email.indexOf('@') === -1) {
      setStatus('Ingresa un email válido para enviarte la confirmación.', true);
      if (emailInput) emailInput.focus();
      return;
    }
    setBusy(true, 'Enviando…');
    fetch('/.netlify/functions/notify-bank-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cartItemsPayload(), email: email, reference: orderRef })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function () {
        Y().finishOrder();
        orderRef = null;
        Y().showDone({
          title: 'Pedido<br>recibido',
          message: 'Registramos tu pedido pendiente de verificación. Envíanos el comprobante de transferencia por WhatsApp y te confirmamos el enlace de descarga y la licencia por correo.'
        });
      })
      .catch(function (err) {
        console.error('[YEAH] bank transfer notify error:', err);
        setBusy(false);
        setStatus('No se pudo registrar el pedido. Escríbenos por WhatsApp con tu comprobante.', true);
      });
  }

  function onConfirmPay() {
    if (Y().state.cart.length === 0) return;
    if (selectedMethod === 'mercadopago') startRedirectCheckout('/.netlify/functions/create-mp-preference');
    else if (selectedMethod === 'stripe') startRedirectCheckout('/.netlify/functions/create-stripe-session');
    else if (selectedMethod === 'transferencia') submitBankTransfer();
  }

  function init() {
    methodEl = $('payMethods');
    panelEl = $('payMethodPanel');
    confirmBtn = $('confirmPayBtn');
    statusText = document.createElement('p');
    statusText.className = 'pay-status';
    confirmBtn.insertAdjacentElement('afterend', statusText);

    methodEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-method]');
      if (!btn) return;
      selectMethod(btn.getAttribute('data-method'));
    });
    confirmBtn.addEventListener('click', onConfirmPay);

    renderMethods();
    renderPanel();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.YEAHPayments = {
    onEnterPay: function () {
      setBusy(false);
      setStatus('');
      renderPanel();
    }
  };
})();
