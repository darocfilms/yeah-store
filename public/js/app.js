(function () {
  'use strict';

  var WHATSAPP = '56943801816';
  var WA_LINK = 'https://wa.me/' + WHATSAPP;

  var state = {
    products: [],
    cart: loadCart(),
    filter: 'TODO',
    query: '',
    modalId: null,
    gallery: 0,
    step: 'cart' // 'cart' | 'pay' | 'done'
  };

  var els = {};
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- persistence ----------
  function loadCart() {
    try {
      var raw = localStorage.getItem('yeah_cart');
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function saveCart() {
    try { localStorage.setItem('yeah_cart', JSON.stringify(state.cart)); } catch (e) {}
  }

  // ---------- helpers ----------
  // CLP no usa decimales y separa miles con punto: $22.900 CLP
  var clpFormat = new Intl.NumberFormat('es-CL');
  function fmt(n, currency) { return '$' + clpFormat.format(n) + ' ' + (currency || 'CLP'); }
  function getProduct(id) { return state.products.find(function (p) { return p.id === id; }); }
  function visibleProducts() {
    var q = state.query.trim().toLowerCase();
    return state.products.filter(function (p) {
      var byCat = state.filter === 'TODO' || p.cat === state.filter;
      var byQuery = !q || p.name.toLowerCase().indexOf(q) !== -1 || p.cat.toLowerCase().indexOf(q) !== -1;
      return byCat && byQuery;
    });
  }
  function cartTotal() {
    return state.cart.reduce(function (sum, line) {
      var p = getProduct(line.id);
      return sum + (p ? p.price * line.qty : 0);
    }, 0);
  }
  function cartCount() {
    return state.cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
  }

  // ---------- toast ----------
  function showToast(text) {
    els.toast.textContent = text;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 1900);
  }

  // ---------- cart mutations ----------
  function addToCart(id, openDrawer) {
    var hit = state.cart.find(function (c) { return c.id === id; });
    if (hit) hit.qty += 1;
    else state.cart.push({ id: id, qty: 1 });
    saveCart();
    renderCartCount();
    if (openDrawer) {
      state.step = 'cart';
      openCart();
    } else {
      showToast('Agregado al carrito');
    }
    renderCartLines();
    renderTotals();
  }
  function decLine(id) {
    var line = state.cart.find(function (c) { return c.id === id; });
    if (line) line.qty = Math.max(1, line.qty - 1);
    saveCart(); renderCartLines(); renderTotals(); renderCartCount();
  }
  function incLine(id) {
    var line = state.cart.find(function (c) { return c.id === id; });
    if (line) line.qty += 1;
    saveCart(); renderCartLines(); renderTotals(); renderCartCount();
  }
  function removeLine(id) {
    state.cart = state.cart.filter(function (c) { return c.id !== id; });
    saveCart(); renderCartLines(); renderTotals(); renderCartCount();
  }

  // ---------- rendering: chips ----------
  function renderChips() {
    var counts = { TODO: state.products.length, DCTL: 0, LUTS: 0 };
    state.products.forEach(function (p) { if (counts[p.cat] !== undefined) counts[p.cat]++; });
    var cats = ['TODO', 'DCTL', 'LUTS'];
    els.chips.innerHTML = cats.map(function (k) {
      var active = state.filter === k ? ' active' : '';
      return '<button type="button" class="chip' + active + '" data-filter="' + k + '">' + k + ' (' + counts[k] + ')</button>';
    }).join('');
  }

  // ---------- rendering: product grid ----------
  function renderGrid() {
    var visible = visibleProducts();
    els.grid.innerHTML = visible.map(function (p) {
      return (
        '<article class="product-card">' +
          '<div class="product-media" data-id="' + p.id + '">' +
            '<div class="ph-main"><span>IMG 02 / HOVER</span></div>' +
            '<div class="ph-hover"><span>[ ' + escapeHtml(p.hoverLabel || p.name) + ' ]</span></div>' +
          '</div>' +
          '<div class="product-foot">' +
            '<div>' +
              '<div class="product-name">' + escapeHtml(p.name) + '</div>' +
              '<div class="product-price">' + fmt(p.price, p.currency) + '</div>' +
            '</div>' +
            '<button type="button" class="product-add" title="Agregar al carrito" data-add="' + p.id + '">+</button>' +
          '</div>' +
        '</article>'
      );
    }).join('');
    els.noResults.hidden = visible.length !== 0;
  }

  // ---------- rendering: cart drawer ----------
  function renderCartCount() { els.cartCount.textContent = String(cartCount()); }
  function renderCartLines() {
    if (state.cart.length === 0) {
      els.cartLines.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
      return;
    }
    els.cartLines.innerHTML = state.cart.map(function (line) {
      var p = getProduct(line.id);
      if (!p) return '';
      return (
        '<div class="cart-line">' +
          '<div class="cart-line-thumb"></div>' +
          '<div class="cart-line-body">' +
            '<div class="cart-line-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="cart-line-meta">' + escapeHtml(p.cat) + ' · ' + fmt(p.price, p.currency) + '</div>' +
            '<div class="qty-row">' +
              '<button type="button" class="qty-btn" data-dec="' + p.id + '">−</button>' +
              '<span class="qty-val">' + line.qty + '</span>' +
              '<button type="button" class="qty-btn" data-inc="' + p.id + '">+</button>' +
              '<div class="spacer"></div>' +
              '<button type="button" class="remove-btn" data-remove="' + p.id + '">QUITAR</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-line-total">' + fmt(p.price * line.qty, p.currency) + '</div>' +
        '</div>'
      );
    }).join('');
  }
  function renderTotals() {
    var total = fmt(cartTotal(), 'CLP');
    els.cartTotal.textContent = total;
    els.payTotal.textContent = total;
  }

  // ---------- drawer steps ----------
  function setStep(step) {
    state.step = step;
    els.stepCart.hidden = step !== 'cart';
    els.stepPay.hidden = step !== 'pay';
    els.stepDone.hidden = step !== 'done';
    els.drawerTitle.textContent = step === 'cart' ? 'Carrito' : step === 'pay' ? 'Pago' : 'Listo';
  }
  function openCart() {
    els.cartScrim.hidden = false;
    els.cartDrawer.classList.add('open');
    els.cartDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderCartLines();
    renderTotals();
  }
  function closeCart() {
    els.cartScrim.hidden = true;
    els.cartDrawer.classList.remove('open');
    els.cartDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setStep('cart');
  }
  function goPay() {
    if (state.cart.length === 0) return;
    setStep('pay');
    if (window.YEAHPayments) window.YEAHPayments.onEnterPay();
  }
  function backToCart() { setStep('cart'); }
  function showDone(opts) {
    opts = opts || {};
    els.doneCheck.textContent = opts.icon || '✓';
    els.doneTitle.innerHTML = opts.title || 'Pago<br>confirmado';
    els.doneMsg.textContent = opts.message || 'Te enviamos el enlace de descarga y la licencia por correo. Cualquier problema de instalación, escribinos por WhatsApp.';
    setStep('done');
  }
  function finishOrder() {
    state.cart = [];
    saveCart();
    renderCartCount();
    renderCartLines();
    renderTotals();
  }

  // ---------- product modal ----------
  function openModal(id) {
    state.modalId = id;
    state.gallery = 0;
    renderModal();
    els.modalScrim.hidden = false;
    els.productModal.classList.add('open');
    els.productModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    state.modalId = null;
    els.modalScrim.hidden = true;
    els.productModal.classList.remove('open');
    els.productModal.setAttribute('aria-hidden', 'true');
    if (els.cartDrawer.classList.contains('open')) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
  }
  function renderModal() {
    var p = getProduct(state.modalId);
    if (!p) return;
    $('modalSku').textContent = p.sku;
    $('modalCat').textContent = p.cat;
    $('modalName').textContent = p.name;
    $('modalPrice').textContent = fmt(p.price, p.currency);
    $('modalDesc').textContent = p.desc;
    $('modalMainLabel').textContent = '[ img 0' + (state.gallery + 1) + ' — ' + p.name.toLowerCase() + ' ]';
    $('modalThumbs').innerHTML = [0, 1, 2, 3].map(function (i) {
      var active = state.gallery === i ? ' active' : '';
      return '<button type="button" class="modal-thumb' + active + '" data-gallery="' + i + '"><span>0' + (i + 1) + '</span></button>';
    }).join('');
    $('modalSpecs').innerHTML = p.specs.map(function (row) {
      return '<div class="spec-row"><span class="spec-k">' + escapeHtml(row[0]) + '</span><span class="spec-v">' + escapeHtml(row[1]) + '</span></div>';
    }).join('');
  }

  // ---------- FAQ ----------
  function initFaq() {
    document.querySelectorAll('.faq-item').forEach(function (item) {
      var btn = item.querySelector('.faq-q');
      btn.addEventListener('click', function () {
        var wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(function (el) { el.classList.remove('open'); });
        if (!wasOpen) item.classList.add('open');
      });
    });
    // First FAQ open by default, matching the original design
    var first = document.querySelector('.faq-item[data-faq="1"]');
    if (first) first.classList.add('open');
  }

  // ---------- wiring ----------
  function cacheEls() {
    els = {
      grid: $('productGrid'), chips: $('chips'), searchInput: $('searchInput'), noResults: $('noResults'),
      cartCount: $('cartCount'), cartLines: $('cartLines'), cartTotal: $('cartTotal'), payTotal: $('payTotal'),
      cartDrawer: $('cartDrawer'), cartScrim: $('cartScrim'), drawerTitle: $('drawerTitle'),
      stepCart: $('stepCart'), stepPay: $('stepPay'), stepDone: $('stepDone'),
      doneCheck: $('doneCheck'), doneTitle: $('doneTitle'), doneMsg: $('doneMsg'),
      productModal: $('productModal'), modalScrim: $('modalScrim'),
      toast: $('toast'), productCountBadge: $('productCountBadge')
    };
  }

  function bindEvents() {
    $('openCartBtn').addEventListener('click', openCart);
    $('closeCartBtn').addEventListener('click', closeCart);
    els.cartScrim.addEventListener('click', function () {
      if (els.cartDrawer.classList.contains('open')) closeCart();
      if (els.productModal.classList.contains('open')) closeModal();
    });
    $('modalScrim').addEventListener('click', closeModal);
    $('closeModalBtn').addEventListener('click', closeModal);
    $('goPayBtn').addEventListener('click', goPay);
    $('backCartBtn').addEventListener('click', backToCart);
    $('doneCloseBtn').addEventListener('click', closeCart);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (els.productModal.classList.contains('open')) closeModal();
        else if (els.cartDrawer.classList.contains('open')) closeCart();
      }
    });

    els.chips.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;
      state.filter = btn.getAttribute('data-filter');
      renderChips();
      renderGrid();
    });
    els.searchInput.addEventListener('input', function (e) {
      state.query = e.target.value;
      renderGrid();
    });

    els.grid.addEventListener('click', function (e) {
      var addBtn = e.target.closest('[data-add]');
      if (addBtn) {
        addToCart(Number(addBtn.getAttribute('data-add')), false);
        return;
      }
      var media = e.target.closest('.product-media');
      if (media) openModal(Number(media.getAttribute('data-id')));
    });

    els.cartLines.addEventListener('click', function (e) {
      var dec = e.target.closest('[data-dec]');
      var inc = e.target.closest('[data-inc]');
      var rm = e.target.closest('[data-remove]');
      if (dec) decLine(Number(dec.getAttribute('data-dec')));
      else if (inc) incLine(Number(inc.getAttribute('data-inc')));
      else if (rm) removeLine(Number(rm.getAttribute('data-remove')));
    });

    $('modalThumbs').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-gallery]');
      if (!btn) return;
      state.gallery = Number(btn.getAttribute('data-gallery'));
      renderModal();
    });
    $('modalAddBtn').addEventListener('click', function () {
      addToCart(state.modalId, false);
      closeModal();
    });
    $('modalBuyBtn').addEventListener('click', function () {
      addToCart(state.modalId, true);
      closeModal();
      goPay();
    });

    $('newsletterForm').addEventListener('submit', function (e) {
      e.preventDefault();
      showToast('¡Gracias! Te avisamos de los próximos drops.');
      e.target.reset();
    });
  }

  function init() {
    cacheEls();
    bindEvents();
    initFaq();
    renderCartCount();
    renderTotals();

    fetch('products.json')
      .then(function (r) { return r.json(); })
      .then(function (products) {
        state.products = products;
        state.cart = state.cart.filter(function (c) { return products.some(function (p) { return p.id === c.id; }); });
        saveCart();
        els.productCountBadge.textContent = String(products.length);
        renderChips();
        renderGrid();
        renderCartCount();
        renderCartLines();
        renderTotals();
      })
      .catch(function (err) {
        console.error('[YEAH] No se pudieron cargar los productos:', err);
        els.grid.innerHTML = '<p class="no-results">No se pudieron cargar los productos. Recarga la página.</p>';
      });
  }

  document.addEventListener('DOMContentLoaded', init);

  // Public surface used by js/payments.js
  window.YEAH = {
    state: state,
    waLink: WA_LINK,
    fmt: fmt,
    getProduct: getProduct,
    cartTotal: cartTotal,
    showToast: showToast,
    showDone: showDone,
    finishOrder: finishOrder,
    backToCart: backToCart,
    els: function () { return els; }
  };
})();
