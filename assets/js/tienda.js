/* GALAX PC REPAIR — catálogo con búsqueda, filtros y paginación */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get('q') || '',
    category: params.get('categoria') || '',
    brands: (params.get('marca') || '').split(',').filter(Boolean),
    min: params.get('min') ? Number(params.get('min')) : null,
    max: params.get('max') ? Number(params.get('max')) : null,
    inStock: params.get('stock') === '1',
    photo: params.get('foto') === '1',
    sort: params.get('sort') || 'relevance',
    page: Math.max(1, Number(params.get('page')) || 1),
    per: Math.min(100, Math.max(1, Number(params.get('per')) || 24)),
    view: localStorage.getItem('galax_catalog_view') === 'list' ? 'list' : 'grid',
    cloudFailed: false,
    localProducts: [],
    total: 0,
    loading: true
  };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  let debounce = (fn, wait) => { let t; return function () { const args = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); }; };

  function icon(name, cls) { return GALAX.icon(name, cls); }
  function read() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category) p.set('categoria', state.category);
    if (state.brands.length) p.set('marca', state.brands.join(','));
    if (state.min != null) p.set('min', state.min);
    if (state.max != null) p.set('max', state.max);
    if (state.inStock) p.set('stock', '1');
    if (state.photo) p.set('foto', '1');
    if (state.sort !== 'relevance') p.set('sort', state.sort);
    if (state.per !== 24) p.set('per', state.per);
    if (state.page > 1) p.set('page', state.page);
    return p.toString();
  }
  function syncURL() {
    const qs = read();
    history.replaceState(null, '', 'tienda.html' + (qs ? '?' + qs : '') + '#catalogo');
  }
  function normalize(value) { return GALAX.normalizeText(value); }
  function localFiltered() {
    const query = normalize(state.q).trim();
    const tokens = query.split(/\s+/).filter(Boolean);
    let items = (GALAX.catalog.products || []).filter((p) => p.published);
    if (state.category) items = items.filter((p) => p.category === state.category);
    if (state.brands.length) items = items.filter((p) => state.brands.some((b) => normalize(b) === normalize(p.brand)));
    if (state.min != null && Number.isFinite(state.min)) items = items.filter((p) => p.price >= state.min);
    if (state.max != null && Number.isFinite(state.max)) items = items.filter((p) => p.price <= state.max);
    if (state.inStock) items = items.filter((p) => p.stock > 0);
    if (state.photo) items = items.filter((p) => p.imageKind === 'foto');
    if (tokens.length) items = items.filter((p) => {
      const hay = p.search || normalize([p.name, p.brand, p.model, p.code, p.description, p.categoryName].join(' '));
      return tokens.every((t) => hay.includes(t));
    });
    const sorted = items.slice().sort((a, b) => {
      switch (state.sort) {
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'name-asc': return a.name.localeCompare(b.name, 'es');
        case 'newest': return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.id - a.id;
        case 'stock-desc': return b.stock - a.stock;
        default:
          if (a.imageKind !== b.imageKind) return a.imageKind === 'foto' ? -1 : 1;
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          if (a.stock !== b.stock) return b.stock - a.stock;
          return a.price - b.price;
      }
    });
    return sorted;
  }

  async function load() {
    state.loading = true;
    $('#catalog-wrap').setAttribute('aria-busy', 'true');
    if (!state.loadedOnce) $('#catalog-wrap').innerHTML = '<div class="skeleton-grid" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
    const useCloud = GALAX.cloud && GALAX.cloud.configured() && GALAX.config.flags.catalogFromSupabase && !state.cloudFailed;
    if (useCloud) {
      try {
        const result = await GALAX.cloud.catalogPage({
          search: state.q, category: state.category, brands: state.brands,
          min: state.min, max: state.max, inStock: state.inStock,
          sort: state.sort, limit: state.per, offset: (state.page - 1) * state.per
        });
        state.total = result.total;
        state.localProducts = result.items;
        render(result.items, result.total, true);
        state.loadedOnce = true;
        state.loading = false;
        $('#catalog-wrap').setAttribute('aria-busy', 'false');
        return;
      } catch (error) {
        console.warn('[GALAX] Paginación en servidor no disponible; se usa el catálogo local:', error.message);
        state.cloudFailed = true;
        showAlert('El catálogo en Supabase no respondió. Se muestra el inventario local mientras se restablece la conexión.', 'warn');
      }
    }
    const all = localFiltered();
    state.total = all.length;
    const totalPages = Math.max(1, Math.ceil(all.length / state.per));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.per;
    state.localProducts = all.slice(start, start + state.per);
    render(state.localProducts, all.length, false);
    state.loadedOnce = true;
    state.loading = false;
    $('#catalog-wrap').setAttribute('aria-busy', 'false');
  }

  function showAlert(message, type) {
    const host = $('#catalog-alert');
    if (!host) return;
    if (!message) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="info-box ' + (type || '') + '" style="margin-bottom:14px">' + icon('info') + '<div>' + GALAX.esc(message) + '</div></div>';
  }

  function render(items, total, server) {
    const wrap = $('#catalog-wrap');
    const count = $('#results-count');
    const pages = Math.max(1, Math.ceil(total / state.per));
    if (state.page > pages) state.page = pages;
    if (!items.length) {
      wrap.innerHTML = '<div class="empty-state" id="catalog-empty">' + icon('search') + '<h3>Sin resultados</h3><p>No encontramos productos con esos filtros. Prueba con otra marca, presupuesto o búsqueda.</p><div class="flex center flex-wrap"><button class="btn btn-primary btn-sm" type="button" id="empty-reset">Limpiar filtros</button><a class="btn btn-ghost btn-sm" href="' + GALAX.whatsappUrl('Hola, busco un producto que no encuentro en el catálogo.') + '" target="_blank" rel="noopener">Consultar por WhatsApp</a></div></div>';
      const reset = $('#empty-reset');
      if (reset) reset.addEventListener('click', resetAll);
    } else {
      wrap.innerHTML = '<div class="product-grid catalog-grid' + (state.view === 'list' ? ' list' : '') + '">' + items.map((p) => GALAX.productCard(p)).join('') + '</div>';
      GALAX.renderFavoriteButtons();
    }
    count.innerHTML = '<strong>' + total + '</strong> producto' + (total === 1 ? '' : 's') + (state.q ? ' para “' + GALAX.esc(state.q) + '”' : '') + ' · página ' + state.page + ' de ' + pages + (server ? ' · Supabase' : '');
    renderPagination(total, pages);
    renderActiveFilters();
    syncURL();
    if (!server && state.cloudFailed === false && GALAX.cloud && GALAX.cloud.configured()) showAlert('');
  }

  function pageList(current, total) {
    const pages = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
    const list = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const p of list) {
      if (prev && p - prev > 1) out.push('…');
      out.push(p);
      prev = p;
    }
    return out;
  }
  function renderPagination(total, pages) {
    const host = $('#pagination');
    if (!host) return;
    if (total <= state.per) { host.innerHTML = ''; return; }
    const prev = state.page > 1;
    host.innerHTML = '<button class="page-btn" type="button" data-page="' + (state.page - 1) + '" ' + (!prev ? 'disabled' : '') + ' aria-label="Página anterior">' + icon('chevronLeft', 'icon-sm') + ' Anterior</button>' +
      pageList(state.page, pages).map((p) => p === '…' ? '<span class="page-info">…</span>' : '<button class="page-btn' + (p === state.page ? ' is-active' : '') + '" type="button" data-page="' + p + '" ' + (p === state.page ? 'aria-current="page"' : '') + '>' + p + '</button>').join('') +
      '<button class="page-btn" type="button" data-page="' + (state.page + 1) + '" ' + (state.page >= pages ? 'disabled' : '') + ' aria-label="Página siguiente">Siguiente ' + icon('chevronRight', 'icon-sm') + '</button>';
    $$('#pagination [data-page]').forEach((btn) => btn.addEventListener('click', () => {
      const page = Number(btn.getAttribute('data-page'));
      if (!page || page < 1 || page > pages || page === state.page) return;
      state.page = page;
      load().then(() => { const target = $('#catalogo'); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }));
  }

  function renderActiveFilters() {
    const host = $('#active-filters');
    if (!host) return;
    const chips = [];
    if (state.q) chips.push(['q', 'Búsqueda: ' + state.q]);
    if (state.category) {
      const cat = GALAX.catalog.categories.find((c) => c.slug === state.category);
      chips.push(['category', cat ? cat.name : state.category]);
    }
    state.brands.forEach((b) => chips.push(['brand:' + b, 'Marca: ' + b]));
    if (state.min != null) chips.push(['min', 'Desde S/ ' + state.min]);
    if (state.max != null) chips.push(['max', 'Hasta S/ ' + state.max]);
    if (state.inStock) chips.push(['stock', 'Con stock']);
    if (state.photo) chips.push(['photo', 'Foto real']);
    host.innerHTML = chips.length ? chips.map(([key, label]) => '<span class="chip">' + GALAX.esc(label) + '<button type="button" data-remove-filter="' + GALAX.esc(key) + '" aria-label="Quitar filtro ' + GALAX.esc(label) + '">' + icon('close', 'icon-sm') + '</button></span>').join('') + '<button class="chip" type="button" id="clear-active">Limpiar todo</button>' : '';
    $$('#active-filters [data-remove-filter]').forEach((btn) => btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-remove-filter');
      if (key === 'q') state.q = '';
      else if (key === 'category') state.category = '';
      else if (key.startsWith('brand:')) state.brands = state.brands.filter((b) => b !== key.slice(6));
      else if (key === 'min') state.min = null;
      else if (key === 'max') state.max = null;
      else if (key === 'stock') state.inStock = false;
      else if (key === 'photo') state.photo = false;
      state.page = 1;
      syncControls();
      load();
    }));
    const clear = $('#clear-active');
    if (clear) clear.addEventListener('click', resetAll);
  }

  function syncControls() {
    $('#catalog-search').value = state.q;
    const catWrap = $('#category-filters');
    catWrap.innerHTML = '<label class="check"><input type="radio" name="category" value="" ' + (!state.category ? 'checked' : '') + '> Todas<span class="count">' + (GALAX.catalog.products || []).filter((p) => p.published).length + '</span></label>' +
      (GALAX.catalog.categories || []).map((cat) => '<label class="check"><input type="radio" name="category" value="' + GALAX.esc(cat.slug) + '" ' + (state.category === cat.slug ? 'checked' : '') + '> ' + GALAX.esc(cat.name) + '<span class="count">' + cat.count + '</span></label>').join('');
    const brandWrap = $('#brand-filters');
    brandWrap.innerHTML = (GALAX.catalog.brands || []).map((brand) => '<label class="check"><input type="checkbox" value="' + GALAX.esc(brand.name) + '" ' + (state.brands.includes(brand.name) ? 'checked' : '') + '> ' + GALAX.esc(brand.name) + '<span class="count">' + brand.count + '</span></label>').join('');
    $('#price-min').value = state.min == null ? '' : state.min;
    $('#price-max').value = state.max == null ? '' : state.max;
    $('#filter-stock').checked = state.inStock;
    $('#filter-photo').checked = state.photo;
    $('#sort-select').value = state.sort;
    $('#per-page').value = String(state.per);
    catWrap.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => { state.category = input.value; state.page = 1; load(); }));
    brandWrap.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => {
      if (input.checked) state.brands.push(input.value); else state.brands = state.brands.filter((b) => b !== input.value);
      state.page = 1; load();
    }));
    $('#view-grid').classList.toggle('is-active', state.view === 'grid');
    $('#view-list').classList.toggle('is-active', state.view === 'list');
    $('#view-grid').setAttribute('aria-pressed', String(state.view === 'grid'));
    $('#view-list').setAttribute('aria-pressed', String(state.view === 'list'));
  }

  function resetAll() {
    state.q = ''; state.category = ''; state.brands = []; state.min = null; state.max = null; state.inStock = false; state.photo = false; state.sort = 'relevance'; state.page = 1;
    syncControls(); load();
  }

  function bind() {
    $('#filter-head-icon').innerHTML = icon('filter');
    $('#chev-cat').innerHTML = icon('chevronDown', 'icon-sm');
    $('#chev-brand').innerHTML = icon('chevronDown', 'icon-sm');
    $('#chev-price').innerHTML = icon('chevronDown', 'icon-sm');
    $('#chev-stock').innerHTML = icon('chevronDown', 'icon-sm');
    $('#filter-toggle-icon').innerHTML = icon('filter', 'icon-sm');
    $('#view-grid-icon').innerHTML = icon('grid', 'icon-sm');
    $('#view-list-icon').innerHTML = icon('list', 'icon-sm');
    $('#catalog-search-icon').innerHTML = icon('search');
    $('#catalog-search-btn').innerHTML = icon('arrowRight', 'icon-sm');
    $('#filter-toggle').addEventListener('click', () => {
      const aside = $('#catalog-filters');
      const open = aside.classList.toggle('is-open');
      $('#filter-toggle').setAttribute('aria-expanded', String(open));
    });
    $('#catalog-search-form').addEventListener('submit', (event) => {
      event.preventDefault();
      state.q = $('#catalog-search').value.trim(); state.page = 1; load();
    });
    $('#catalog-search').addEventListener('input', debounce((event) => { state.q = event.target.value.trim(); state.page = 1; load(); }, 280));
    $('#apply-price').addEventListener('click', () => {
      state.min = $('#price-min').value === '' ? null : Math.max(0, Number($('#price-min').value));
      state.max = $('#price-max').value === '' ? null : Math.max(0, Number($('#price-max').value));
      if (state.min != null && state.max != null && state.min > state.max) { const temp = state.min; state.min = state.max; state.max = temp; }
      state.page = 1; load();
    });
    ['price-min', 'price-max'].forEach((id) => document.getElementById(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#apply-price').click(); } }));
    $('#filter-stock').addEventListener('change', (event) => { state.inStock = event.target.checked; state.page = 1; load(); });
    $('#filter-photo').addEventListener('change', (event) => { state.photo = event.target.checked; state.page = 1; load(); });
    $('#sort-select').addEventListener('change', (event) => { state.sort = event.target.value; state.page = 1; load(); });
    $('#per-page').addEventListener('change', (event) => { state.per = Number(event.target.value); state.page = 1; load(); });
    $('#view-grid').addEventListener('click', () => { state.view = 'grid'; localStorage.setItem('galax_catalog_view', 'grid'); syncControls(); render(state.localProducts, state.total, false); });
    $('#view-list').addEventListener('click', () => { state.view = 'list'; localStorage.setItem('galax_catalog_view', 'list'); syncControls(); render(state.localProducts, state.total, false); });
    $('#reset-filters').addEventListener('click', resetAll);
  }

  GALAX.ready().then(() => {
    bind();
    syncControls();
    load();
  });
})();
