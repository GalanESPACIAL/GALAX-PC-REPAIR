/* GALAX PC REPAIR — carrito completo */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  function lineHTML(line) {
    const p = line.product;
    const stock = GALAX.stockInfo(p);
    const model = p.model && p.model !== p.name ? p.model : '';
    const unit = GALAX.money(p.price);
    return '<div class="cart-line" data-line="' + GALAX.esc(p.code) + '">' +
      '<a class="cart-line-media" href="' + GALAX.productUrl(p) + '"><img src="' + GALAX.esc(GALAX.productImage(p)) + '" alt="' + GALAX.esc(p.name) + '" loading="lazy" width="70" height="62"></a>' +
      '<div><a class="cart-line-title" href="' + GALAX.productUrl(p) + '">' + GALAX.esc(p.name) + '</a>' +
        '<div class="cart-line-meta">' + GALAX.esc(p.code) + ' · ' + GALAX.esc(p.brand) + (model ? ' · ' + GALAX.esc(model) : '') + ' · ' + (p.imageKind === 'foto' ? 'Foto real' : 'Imagen referencial') + '</div>' +
        '<div class="cart-line-meta">Precio unitario ' + unit + (p.compareAt && p.compareAt > p.price ? ' · antes ' + GALAX.money(p.compareAt) : '') + '</div>' +
        '<div class="cart-line-actions"><div class="qty"><button type="button" data-cart-dec="' + GALAX.esc(p.code) + '" aria-label="Quitar una unidad de ' + GALAX.esc(p.name) + '">' + GALAX.icon('minus', 'icon-sm') + '</button><span>' + line.qty + '</span><button type="button" data-cart-inc="' + GALAX.esc(p.code) + '" aria-label="Agregar una unidad de ' + GALAX.esc(p.name) + '">' + GALAX.icon('plus', 'icon-sm') + '</button></div>' +
        '<button type="button" class="cart-remove" data-cart-remove="' + GALAX.esc(p.code) + '" aria-label="Eliminar ' + GALAX.esc(p.name) + '">' + GALAX.icon('trash', 'icon-sm') + 'Eliminar</button></div>' +
        '<div class="product-stock ' + stock.cls + '" style="margin-top:6px"><span class="dot"></span>' + GALAX.esc(stock.text) + '</div></div>' +
      '<div class="cart-line-price">' + GALAX.money(line.subtotal) + '<div class="tiny dim" style="font-weight:400">Subtotal</div></div></div>';
  }
  function discounts() {
    return GALAX.cartLines().reduce((n, l) => n + (l.product.compareAt && l.product.compareAt > l.product.price ? (l.product.compareAt - l.product.price) * l.qty : 0), 0);
  }
  function render() {
    const lines = GALAX.cartLines();
    const host = $('#cart-lines');
    const summary = $('#cart-summary');
    const count = $('#cart-lines-count');
    const checkout = $('#go-checkout');
    if (!lines.length) {
      host.innerHTML = '<div class="empty-state">' + GALAX.icon('cart') + '<h3>Tu carrito está vacío</h3><p>Explora el catálogo con stock real y agrega el equipo que buscas.</p><a class="btn btn-primary btn-sm" href="tienda.html">Ver catálogo</a></div>';
      summary.innerHTML = '<div class="summary-line"><span>Subtotal</span><strong>S/ 0</strong></div><div class="summary-line"><span>Descuentos</span><span>S/ 0</span></div><div class="summary-line"><span>Envío</span><span>Se calcula en el checkout</span></div><div class="summary-line total"><span>Total referencial</span><span>S/ 0</span></div>';
      count.textContent = 'Sin productos por ahora';
      checkout.classList.add('disabled');
      checkout.setAttribute('aria-disabled', 'true');
      checkout.href = 'checkout.html';
      $('#cart-wa').href = GALAX.whatsappUrl('Hola, necesito ayuda para elegir un equipo del catálogo.');
      return;
    }
    host.innerHTML = lines.map(lineHTML).join('');
    const subtotal = GALAX.cartSubtotal();
    const disc = discounts();
    const countText = GALAX.cartCount();
    count.textContent = countText + (countText === 1 ? ' producto' : ' productos') + ' · ' + lines.length + (lines.length === 1 ? ' línea' : ' líneas');
    summary.innerHTML = '<div class="summary-line"><span>Subtotal (' + countText + ')</span><strong>' + GALAX.money(subtotal + disc) + '</strong></div>' +
      '<div class="summary-line"><span>Descuentos</span><span>' + (disc ? '-' + GALAX.money(disc) : GALAX.money(0)) + '</span></div>' +
      '<div class="summary-line"><span>Envío Lima</span><span>' + GALAX.money(GALAX.config.commerce.shippingLima) + '</span></div>' +
      '<div class="summary-line"><span>Recojo en taller</span><span>Sin costo de envío</span></div>' +
      '<div class="summary-line total"><span>Total referencial</span><span>' + GALAX.money(subtotal) + '</span></div>';
    checkout.classList.remove('disabled');
    checkout.removeAttribute('aria-disabled');
    $('#cart-wa').href = GALAX.whatsappUrl('Hola, quiero coordinar mi compra. Mi carrito: ' + lines.map((l) => l.product.code + ' x' + l.qty).join(', ') + '. Subtotal referencial ' + GALAX.money(subtotal) + '.');
    GALAX.updateBadges();
  }
  function onCheckoutClick(event) {
    if (GALAX.cartCount() === 0) { event.preventDefault(); GALAX.toast('Tu carrito está vacío.', 'info'); }
  }
  GALAX.ready().then(() => {
    const icons = { 'cart-clear-icon': 'trash', 'cart-back-icon': 'arrowLeft', 'summary-info-icon': 'info', 'summary-arrow': 'arrowRight', 'cart-wa-icon': 'whatsapp' };
    Object.entries(icons).forEach(([id, name]) => { const node = document.getElementById(id); if (node) node.innerHTML = GALAX.icon(name, id === 'summary-arrow' ? 'icon-sm' : ''); });
    const checkout = $('#go-checkout');
    if (checkout) {
      checkout.setAttribute('title', 'Finalizar compra');
      // Un único handler; nunca se acumulan listeners vacíos.
      checkout.addEventListener('click', onCheckoutClick);
      const label = checkout.childNodes;
      // Texto accesible claro sin romper el icono.
      const span = checkout.querySelector('#summary-arrow');
      if (span && !checkout.textContent.includes('Finalizar')) {
        // No reescribir si el HTML ya tiene texto.
      }
    }
    render();
    document.addEventListener('galax:cart', render);
    document.addEventListener('galax:orders', render);
  });
})();
