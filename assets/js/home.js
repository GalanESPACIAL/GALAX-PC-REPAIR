/* GALAX PC REPAIR — página de inicio */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }
  function setIcons() {
    const map = {
      'trust-icon-stock': 'box', 'trust-icon-service': 'wrench', 'trust-icon-pay': 'card', 'trust-icon-receipt': 'receipt',
      'arrow-cat': 'arrowRight', 'arrow-featured': 'arrowRight', 'arrow-services': 'arrowRight', 'airi-arrow': 'sparkles',
      'reco-check-1': 'check', 'reco-check-2': 'check', 'reco-check-3': 'check', 'service-info-icon': 'info'
    };
    Object.entries(map).forEach(([id, name]) => {
      const node = el(id);
      if (node) node.innerHTML = GALAX.icon(name);
    });
    document.querySelectorAll('.hero-float .icon-wrap').forEach((node) => {
      const isWhats = node.closest('.hero-float-b');
      node.innerHTML = GALAX.icon(isWhats ? 'whatsapp' : 'search');
    });
    document.querySelectorAll('.editorial-list span:first-child').forEach((node) => {
      if (!node.innerHTML.trim()) node.innerHTML = GALAX.icon('check');
    });
  }
  function categoryCard(cat) {
    return '<a class="category-card" href="tienda.html?categoria=' + encodeURIComponent(cat.slug) + '" style="--cat-color:' + GALAX.esc(cat.color) + '">' +
      '<span class="category-icon">' + GALAX.icon(categoryIcon(cat.slug)) + '</span>' +
      '<h3>' + GALAX.esc(cat.name) + '</h3><p>' + GALAX.esc(cat.blurb) + '</p>' +
      '<span class="category-count">' + cat.count + ' productos</span></a>';
  }
  function categoryIcon(slug) {
    return { laptops: 'laptop', computadoras: 'desktop', monitores: 'monitor', componentes: 'cpu', perifericos: 'keyboard', redes: 'wifi', accesorios: 'headphones' }[slug] || 'box';
  }
  function renderCategories() {
    const host = el('category-grid');
    if (!host) return;
    host.innerHTML = (GALAX.catalog.categories || []).map(categoryCard).join('');
  }
  function renderFeatured(category) {
    const host = el('featured-grid');
    if (!host) return;
    let products = (GALAX.catalog.products || []).filter((p) => p.published && p.stock > 0);
    if (category) products = products.filter((p) => p.category === category);
    products = products.sort((a, b) => {
      if (a.imageKind !== b.imageKind) return a.imageKind === 'foto' ? -1 : 1;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.price - a.price;
    }).slice(0, 8);
    host.innerHTML = products.length ? products.map((p) => GALAX.productCard(p)).join('') : '<div class="empty-state" style="grid-column:1/-1">' + GALAX.icon('box') + '<h3>Sin productos en esta categoría</h3><p>Revisa el catálogo completo.</p><a class="btn btn-primary btn-sm" href="tienda.html">Ver catálogo</a></div>';
    GALAX.renderFavoriteButtons();
  }
  function renderTabs() {
    const host = el('featured-tabs');
    if (!host) return;
    const cats = [{ slug: '', name: 'Destacados' }].concat((GALAX.catalog.categories || []).filter((c) => ['laptops', 'computadoras', 'monitores', 'componentes', 'perifericos'].includes(c.slug)));
    host.innerHTML = cats.map((c, i) => '<button class="chip' + (i === 0 ? ' is-active' : '') + '" type="button" data-featured-tab="' + GALAX.esc(c.slug) + '" role="tab" aria-selected="' + (i === 0) + '">' + GALAX.esc(c.name) + '</button>').join('');
    host.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-featured-tab]');
      if (!btn) return;
      host.querySelectorAll('[data-featured-tab]').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
      renderFeatured(btn.getAttribute('data-featured-tab') || null);
    });
  }
  function renderServices() {
    const host = el('service-grid');
    if (!host) return;
    host.innerHTML = (GALAX.content.services || []).map((s) => '<article class="service-card"><span class="service-icon">' + GALAX.icon(serviceIcon(s.icon)) + '</span><div><h3>' + GALAX.esc(s.name) + '</h3><p>' + GALAX.esc(s.description) + '</p><a class="service-meta" href="servicios.html#solicitud">' + GALAX.icon('arrowRight', 'icon-sm') + 'Solicitar evaluación</a></div></article>').join('');
  }
  function serviceIcon(icon) {
    const map = { 'fa-laptop': 'laptop', 'fa-microchip': 'cpu', 'fa-windows': 'desktop', 'fa-fan': 'refresh', 'fa-network-wired': 'wifi', 'fa-chart-simple': 'shield' };
    return map[icon] || 'wrench';
  }
  function renderFaq() {
    const host = el('faq-list');
    if (!host) return;
    host.innerHTML = (GALAX.content.faq || []).map((f) => '<details class="faq-item"><summary>' + GALAX.esc(f.q) + GALAX.icon('plus') + '</summary><p>' + GALAX.esc(f.a) + '</p></details>').join('');
  }
  function updateCopy() {
    const home = GALAX.content.home || {};
    const lead = el('hero-lead');
    if (lead && home.text) lead.textContent = home.text;
    const meta = GALAX.catalog.meta || {};
    const count = meta.productCount || (GALAX.catalog.products || []).length;
    if (el('stat-products')) el('stat-products').textContent = count;
    if (el('stat-brands')) el('stat-brands').textContent = (GALAX.catalog.brands || []).length;
    if (el('stat-categories')) el('stat-categories').textContent = (GALAX.catalog.categories || []).length;
    if (el('hero-count')) el('hero-count').textContent = count + ' equipos';
    document.querySelectorAll('h1 .grad').forEach((node) => { if (home.highlight) node.textContent = home.highlight; });
  }

  GALAX.ready().then(() => {
    setIcons();
    updateCopy();
    renderCategories();
    renderTabs();
    renderFeatured(null);
    renderServices();
    renderFaq();
    const cta = document.querySelector('.airi-band-copy h2');
    if (cta && GALAX.content?.home?.aboutTitle) cta.textContent = 'Conoce a Airi';
  });
})();
