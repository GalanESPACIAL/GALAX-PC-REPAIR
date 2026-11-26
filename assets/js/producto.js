/* GALAX PC REPAIR — ficha de producto */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const code = params.get('code') || params.get('codigo') || '';
  const $ = (s) => document.querySelector(s);
  let product = null;
  let qty = 1;

  function specLabel(key) {
    const map = { cpu: 'Procesador', ram: 'Memoria', storage: 'Almacenamiento', gpu: 'Gráficos', screen: 'Pantalla', color: 'Color', os: 'Sistema', warranty: 'Garantía' };
    return map[key] || key;
  }
  function fallbackGallery(p) {
    const list = [];
    if (p.images && p.images.length) list.push.apply(list, p.images);
    if (p.image) list.unshift(p.image);
    return Array.from(new Set(list.filter(Boolean)));
  }
  function imagesFor(p) {
    if (p.code === 'PC-001') return ['assets/img/optimized/laptop-hp.jpg'];
    if (p.code === 'PC-041') return ['assets/img/optimized/laptop-lenovo.jpg'];
    const list = fallbackGallery(p);
    return list.length ? list : [GALAX.productImage(p)];
  }
  function renderBreadcrumb(p) {
    $('#crumb-category').innerHTML = '<a href="tienda.html?categoria=' + encodeURIComponent(p.category) + '">' + GALAX.esc(p.categoryName) + '</a>';
    $('#crumb-name').textContent = p.model || p.name;
    document.title = (p.model || p.name) + ' — GALAX PC REPAIR';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', p.name + '. Precio ' + GALAX.money(p.price) + ' y stock en GALAX PC REPAIR, Lima, Perú. Código ' + p.code + '.');
  }
  function renderGallery(p) {
    const images = imagesFor(p);
    const main = $('#gallery-main');
    main.innerHTML = '<span class="badge ' + (p.imageKind === 'foto' ? 'badge-green' : '') + '">' + (p.imageKind === 'foto' ? 'Foto real del producto' : 'Imagen referencial') + '</span>' +
      '<img id="gallery-image" src="' + GALAX.esc(images[0]) + '" alt="' + GALAX.esc((p.model || p.name) + (p.imageKind === 'foto' ? ', fotografía real' : ', ilustración referencial de categoría')) + '" width="900" height="760">';
    const thumbs = $('#gallery-thumbs');
    thumbs.innerHTML = images.length > 1 ? images.map((src, i) => '<button class="gallery-thumb' + (i === 0 ? ' is-active' : '') + '" type="button" data-src="' + GALAX.esc(src) + '" aria-label="Ver imagen ' + (i + 1) + '"><img src="' + GALAX.esc(src) + '" alt="" loading="lazy"></button>').join('') : '';
    thumbs.querySelectorAll('[data-src]').forEach((btn) => btn.addEventListener('click', () => {
      $('#gallery-image').src = btn.getAttribute('data-src');
      thumbs.querySelectorAll('.gallery-thumb').forEach((b) => b.classList.toggle('is-active', b === btn));
    }));
    const media = $('#gallery-extra');
    if (p.video) media.innerHTML = '<video controls preload="metadata" width="900" height="500" poster="' + GALAX.esc(images[0]) + '" style="width:100%;border-radius:12px;margin-top:10px"><source src="' + GALAX.esc(p.video) + '" type="video/mp4"></video>';
    else media.innerHTML = '';
  }
  function renderDetail(p) {
    const stock = GALAX.stockInfo(p);
    const specs = (p.specList && p.specList.length ? p.specList : Object.entries(p.specs || {}).map(([k, v]) => ({ label: specLabel(k), value: v }))).filter((s) => s && s.value);
    $('#detail-brand').textContent = p.brand || 'GALAX';
    $('#detail-category').textContent = p.categoryName || '';
    $('#detail-code').textContent = 'Código ' + p.code;
    $('#detail-title').textContent = p.model || p.name;
    $('#detail-subtitle').textContent = p.name !== (p.model || p.name) ? p.name : (p.description || '');
    $('#detail-price').innerHTML = GALAX.money(p.price) + (p.compareAt && p.compareAt > p.price ? '<del style="font-size:.85rem;color:var(--gx-dim);margin-left:8px">' + GALAX.money(p.compareAt) + '</del>' : '');
    $('#detail-stock').innerHTML = '<span class="product-stock ' + stock.cls + '" style="justify-content:flex-end"><span class="dot"></span>' + GALAX.esc(stock.text) + '</span><span class="tiny dim">Se valida al crear el pedido</span>';
    const shortNode = document.getElementById('detail-subtitle');
    if (shortNode && !shortNode.textContent.trim()) shortNode.textContent = p.description || 'Producto del catálogo GALAX PC REPAIR. Revisa las especificaciones registradas y consulta cualquier detalle por WhatsApp.';
    $('#detail-specs').innerHTML = specs.map((s) => '<div class="spec-row"><span>' + GALAX.esc(s.label) + '</span><strong>' + GALAX.esc(s.value) + '</strong></div>').join('') || '<div class="spec-row"><span>Información</span><strong>Consultar ficha</strong></div>';
    const actions = $('#detail-actions');
    if (p.stock > 0) {
      actions.innerHTML = '<div class="qty" style="height:48px"><button type="button" data-qty-dec aria-label="Quitar una unidad">' + GALAX.icon('minus', 'icon-sm') + '</button><span id="detail-qty" style="min-width:34px;text-align:center;font-weight:800">1</span><button type="button" data-qty-inc aria-label="Agregar una unidad">' + GALAX.icon('plus', 'icon-sm') + '</button></div>' +
        '<button class="btn btn-primary btn-lg" type="button" data-detail-add data-code="' + GALAX.esc(p.code) + '">' + GALAX.icon('cart') + 'Agregar al carrito</button>' +
        '<button class="btn btn-violet btn-lg" type="button" data-detail-buy>Comprar ahora</button>' +
        '<button class="icon-btn" type="button" data-fav="' + GALAX.esc(p.code) + '" style="width:48px;height:48px" aria-label="Agregar a favoritos">' + GALAX.icon('heart') + '</button>';
      actions.querySelector('[data-qty-inc]').addEventListener('click', () => { qty = Math.min(qty + 1, Math.min(p.stock, GALAX.config.commerce.maxQtyPerLine || 10)); $('#detail-qty').textContent = qty; });
      actions.querySelector('[data-qty-dec]').addEventListener('click', () => { qty = Math.max(1, qty - 1); $('#detail-qty').textContent = qty; });
      actions.querySelector('[data-detail-add]').addEventListener('click', () => { if (GALAX.addToCart(p.code, qty)) qty = 1, $('#detail-qty').textContent = 1; });
      actions.querySelector('[data-detail-buy]').addEventListener('click', () => { if (GALAX.addToCart(p.code, qty)) location.href = 'checkout.html'; });
    } else {
      actions.innerHTML = '<a class="btn btn-primary btn-lg" href="' + GALAX.whatsappUrl('Hola, consulto disponibilidad del producto ' + p.code + ' — ' + p.name) + '" target="_blank" rel="noopener">' + GALAX.icon('whatsapp') + 'Consultar disponibilidad</a><button class="icon-btn" type="button" data-fav="' + GALAX.esc(p.code) + '" style="width:48px;height:48px" aria-label="Agregar a favoritos">' + GALAX.icon('heart') + '</button>';
    }
    GALAX.renderFavoriteButtons();
    $('#detail-description').innerHTML = '<p>' + GALAX.esc(p.description || '') + '</p>' +
      '<p>Las especificaciones mostradas provienen de la ficha registrada del producto. No se agregan datos técnicos no verificados. Si necesitas confirmar compatibilidad, garantía o estado exacto del equipo, consulta con el equipo por WhatsApp indicando el código <strong>' + GALAX.esc(p.code) + '</strong>.</p>';
    $('#detail-trust').innerHTML = ['Garantía según fabricante', 'Stock validado al pedido', 'Atención por WhatsApp', p.imageKind === 'foto' ? 'Foto real' : 'Imagen referencial'].map((t) => '<span class="badge">' + GALAX.esc(t) + '</span>').join('');
    const wa = $('#detail-wa');
    if (wa) wa.href = GALAX.whatsappUrl('Hola, quiero consultar por ' + p.code + ' — ' + p.name + ' (' + GALAX.money(p.price) + ')');
    const related = (GALAX.catalog.products || []).filter((x) => x.published && x.code !== p.code && x.category === p.category && x.stock > 0).sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price)).slice(0, 4);
    $('#related-grid').innerHTML = related.map((x) => GALAX.productCard(x)).join('') || '<p class="muted">No hay productos relacionados publicados en este momento.</p>';
    GALAX.renderFavoriteButtons();
  }
  function notFound() {
    $('#product-view').innerHTML = '<div class="error-state"><h1>404</h1><h2>Producto no encontrado</h2><p>El código no existe en el catálogo publicado o el producto ya no está disponible.</p><div class="flex center flex-wrap"><a class="btn btn-primary" href="tienda.html">Ver catálogo</a></div></div>';
  }

  GALAX.ready().then(() => {
    const icons = { 'perk-truck': 'truck', 'perk-shield': 'shield', 'perk-wa': 'whatsapp', 'detail-wa-icon': 'whatsapp', 'detail-info-icon': 'info', 'desc-caret': 'chevronDown', 'pay-caret': 'chevronDown', 'ship-caret': 'chevronDown' };
    Object.entries(icons).forEach(([id, name]) => { const node = document.getElementById(id); if (node) node.innerHTML = GALAX.icon(name, 'icon-sm'); });
    product = GALAX.getProduct(code);
    if (!product || !product.published) { notFound(); return; }
    renderBreadcrumb(product);
    renderGallery(product);
    renderDetail(product);
  });
  document.addEventListener('galax:cart', () => { if (product) GALAX.updateBadges(); });
})();
