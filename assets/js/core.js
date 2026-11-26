/* =====================================================================
   GALAX PC REPAIR — núcleo de la tienda estática.
   Catálogo local (JSON real) + Supabase opcional. Sin frameworks.
   ===================================================================== */
(function () {
  'use strict';

  const CFG = window.GALAX_CONFIG || {};
  const LS = {
    cart: 'galax_cart_v2',
    favorites: 'galax_favorites_v2',
    profile: 'galax_local_profile_v1',
    orders: 'galax_local_orders_v1',
    settings: 'galax_settings_v1',
    campaignDismissed: 'galax_campaign_dismissed_v1'
  };
  const DATA_URLS = {
    catalog: 'assets/data/catalog.json',
    content: 'assets/data/content.json',
    festive: 'assets/data/festive.json'
  };
  const CLOUD = window.GalaxCloud || null;
  const DEFAULT_PROFILE = { name: '', email: '', phone: '', address: '', document: '' };
  const DEFAULT_SETTINGS = { effects: true, motion: true };
  const state = {
    catalog: null,
    content: null,
    festive: null,
    cloudUser: null,
    cloudProfile: null,
    cloudFavorites: false,
    loading: true,
    loadError: null,
    profile: readJSON(LS.profile, DEFAULT_PROFILE),
    settings: Object.assign({}, DEFAULT_SETTINGS, readJSON(LS.settings, {})),
    cart: [],
    favorites: [],
    orders: readJSON(LS.orders, [])
  };
  const listeners = new Map();
  const ui = { lastFocus: null, openOverlays: [] };
  let initPromise;

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn('[GALAX] No se pudo guardar en este dispositivo:', error.message); }
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function attr(value) { return esc(value); }
  function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Consultar';
    const decimals = Math.abs(n % 1) > 0.001 ? 2 : 0;
    return 'S/ ' + new Intl.NumberFormat('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: 2 }).format(n);
  }
  function dateLong(value) {
    try {
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(value));
    } catch { return String(value); }
  }
  function dateShort(value) {
    try {
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' }).format(new Date(value));
    } catch { return String(value); }
  }
  function slug(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent('galax:' + name, { detail: detail || {} }));
    const set = listeners.get(name);
    if (set) set.forEach((fn) => { try { fn(detail || {}); } catch (e) { console.error(e); } });
  }
  function on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => listeners.get(name) && listeners.get(name).delete(fn);
  }
  function once(name, fn) {
    const off = on(name, (detail) => { off(); fn(detail); });
  }
  function qs(selector, root) { return (root || document).querySelector(selector); }
  function qsa(selector, root) { return Array.from((root || document).querySelectorAll(selector)); }
  function whatsappUrl(text) {
    return 'https://wa.me/' + String((state.content && state.content.brand && state.content.brand.whatsapp) || CFG.whatsapp || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text || 'Hola GALAX PC REPAIR, quiero información.');
  }
  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function debounce(fn, wait) {
    let t;
    return function debounced() {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /* ------------------------------------------------------------------ */
  /* Iconos SVG (inline, sin dependencia de CDN)                         */
  /* ------------------------------------------------------------------ */
  const ICONS = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 3h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
    arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    arrowLeft: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    mapPin: '<path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    truck: '<path d="M1 4h14v12H1zM15 9h4l3 4v3h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="4"/>',
    mic: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    sparkles: '<path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    receipt: '<path d="M5 3v18l3-2 4 2 4-2 3 2V3H5Z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M3 21v-5h5M21 3v5h-5"/>',
    external: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z" fill="currentColor" stroke="none"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1"/><path d="M2 19h20l-2-3H4l-2 3Z"/>',
    desktop: '<rect x="2" y="3" width="20" height="13" rx="2"/><path d="M8 21h8M12 16v5"/>',
    monitor: '<rect x="2" y="3" width="20" height="13" rx="2"/><path d="M8 21h8M12 16v5"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
    wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>',
    headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4ZM3 19a2 2 0 0 0 2 2h1v-6H3v4Z"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3 18l3 3 6.4-6.4a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.1-.4-.4-2.1 2.5-2.5Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    package: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/><path d="M7.5 5.5 16.5 10.4"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5a8.4 8.4 0 1 1 16.1-4.5Z"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
    volumeOff: '<path d="M11 5 6 9H2v6h4l5 4V5ZM22 9l-6 6M16 9l6 6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z"/>',
    store: '<path d="M3 9 4 3h16l1 6M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9M3 9h18M9 21v-7h6v7"/>',
    tag: '<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/><path d="M12 21a3 3 0 0 1 0-6h2a2 2 0 0 0 2-2"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2V4ZM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7V4Z"/>',
    play: '<path d="M6 3l15 9-15 9V3Z" fill="currentColor" stroke="none"/>',
    map: '<path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1M10 21v-3h4v3"/>',
    whatsapp: '<path d="M12.04 2a9.9 9.9 0 0 0-8.4 15.1L2 22l5.1-1.6A9.9 9.9 0 1 0 12.04 2Zm5.8 14.1c-.2.7-1.2 1.3-1.9 1.4-.5.1-1.1.2-3.6-.8-3-1.2-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1.1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4-.1.7.5l.9 2.1c.1.2.1.4 0 .6l-.4.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.8 2.1 1.2 1.1 2.2 1.4 2.5 1.6.3.1.5.1.7-.1l1-1.2c.2-.2.4-.2.6-.1l2.1 1c.3.1.5.2.6.4.1.1.1.8-.1 1.4Z" fill="currentColor" stroke="none"/>'
  };
  function icon(name, cls, title) {
    const body = ICONS[name] || ICONS.info;
    const label = title ? 'role="img" aria-label="' + esc(title) + '"' : 'aria-hidden="true"';
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' + label + '>' + body + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Carga de datos                                                     */
  /* ------------------------------------------------------------------ */
  async function fetchJSON(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error('No se pudo cargar ' + url + ' (' + response.status + ')');
    return response.json();
  }
  async function loadData() {
    const [catalogRes, contentRes, festiveRes] = await Promise.allSettled([
      fetchJSON(DATA_URLS.catalog),
      fetchJSON(DATA_URLS.content),
      fetchJSON(DATA_URLS.festive)
    ]);
    if (catalogRes.status === 'rejected') {
      state.loadError = catalogRes.reason;
      console.error('[GALAX]', catalogRes.reason);
      state.catalog = { meta: { productCount: 0, priceMin: 0, priceMax: 0 }, categories: [], brands: [], products: [], services: [], showcase: [], gallery: [], config: { whatsapp: CFG.whatsapp, shippingCost: 12 } };
    } else {
      state.catalog = catalogRes.value;
    }
    state.content = contentRes.status === 'fulfilled' ? contentRes.value : null;
    state.festive = festiveRes.status === 'fulfilled' ? festiveRes.value : { timezone: 'America/Lima', events: [] };
    if (!state.content) {
      state.content = {
        brand: { name: 'GALAX PC REPAIR', whatsapp: '51986260738', whatsappDisplay: '+51 986 260 738', location: 'Lima, Perú', logo: 'assets/img/logo.jpeg' },
        home: { title: 'Tecnología que', highlight: 'sí funciona', text: 'Venta de equipos, componentes y servicio técnico.', primaryText: 'Explorar catálogo', primaryUrl: 'tienda.html' },
        services: [], faq: []
      };
    }
    normalizeStoredState();
    // Si Supabase está configurado, el catálogo y el contenido publicados son la fuente de verdad.
    if (CLOUD && CLOUD.configured()) {
      try {
        const [cloudProducts, cloudContent] = await Promise.allSettled([CLOUD.allProducts(), CLOUD.loadContent()]);
        if (cloudProducts.status === 'fulfilled' && Array.isArray(cloudProducts.value) && cloudProducts.value.length) {
          state.catalog.products = cloudProducts.value;
          state.catalog.meta.productCount = cloudProducts.value.length;
          state.catalog.meta.priceMin = Math.min.apply(null, cloudProducts.value.map((p) => p.price));
          state.catalog.meta.priceMax = Math.max.apply(null, cloudProducts.value.map((p) => p.price));
        }
        if (cloudContent.status === 'fulfilled' && cloudContent.value && cloudContent.value.content) {
          state.content = Object.assign({}, state.content, cloudContent.value.content);
        }
      } catch (error) {
        console.warn('[GALAX] Se mantiene el catálogo local porque Supabase no respondió:', error.message);
      }
    }
  }
  function normalizeStoredState() {
    const byCode = new Map((state.catalog.products || []).map((p) => [p.code, p]));
    let cart = readJSON(LS.cart, []);
    if (!Array.isArray(cart)) cart = [];
    state.cart = cart.map((item) => {
      const p = byCode.get(item.code);
      if (!p || !p.published || p.stock <= 0) return null;
      return { code: item.code, qty: Math.max(1, Math.min(Number(item.qty) || 1, p.stock, CFG.commerce.maxQtyPerLine || 10)) };
    }).filter(Boolean);
    let favs = readJSON(LS.favorites, []);
    if (!Array.isArray(favs)) favs = [];
    state.favorites = favs.filter((code) => byCode.has(code) && byCode.get(code).published);
    state.orders = Array.isArray(state.orders) ? state.orders : [];
    saveCart(); saveFavorites();
  }

  /* ------------------------------------------------------------------ */
  /* Ajustes                                                            */
  /* ------------------------------------------------------------------ */
  function applySettings() {
    document.body.classList.toggle('reduced-fx', !state.settings.motion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
    saveSettings();
    qsa('[data-setting="effects"]').forEach((el) => el.setAttribute('aria-pressed', String(Boolean(state.settings.effects))));
    qsa('[data-setting="motion"]').forEach((el) => el.setAttribute('aria-pressed', String(Boolean(state.settings.motion))));
    emit('settings', state.settings);
  }
  function saveSettings() { writeJSON(LS.settings, state.settings); }
  function setSetting(key, value) {
    state.settings[key] = Boolean(value);
    applySettings();
  }

  /* ------------------------------------------------------------------ */
  /* Carrito / favoritos / perfil / pedidos                              */
  /* ------------------------------------------------------------------ */
  let syncingCart = false;
  function saveCart() { writeJSON(LS.cart, state.cart); }
  function saveFavorites() { writeJSON(LS.favorites, state.favorites); }
  // Envía el carrito local a la nube sin duplicar; falla silenciosamente (no rompe la compra local).
  async function pushCartToCloud() {
    if (!state.cloudUser || !CLOUD || !CLOUD.configured() || syncingCart) return;
    try { await CLOUD.pushCart(state.cart); } catch (error) { console.warn('[GALAX] Carrito en la nube:', error.message); }
  }
  // Combina carrito local + nube. Cantidad = máxima disponible, no suma duplicada; valida stock con catálogo.
  async function mergeCloudCart() {
    if (!CLOUD || !CLOUD.configured()) return;
    try {
      const remote = await CLOUD.listCart();
      if (!remote || !remote.length) { await CLOUD.pushCart(state.cart); return; }
      const byCode = new Map();
      state.cart.forEach((i) => byCode.set(i.code, Math.max(byCode.get(i.code) || 0, Number(i.qty) || 1)));
      remote.forEach((i) => byCode.set(i.code, Math.max(byCode.get(i.code) || 0, Number(i.qty) || 1)));
      const products = state.catalog.products || [];
      const merged = [];
      byCode.forEach((qty, code) => {
        const p = products.find((x) => String(x.code) === String(code));
        if (!p || !p.published || p.stock <= 0) return;
        merged.push({ code, qty: Math.max(1, Math.min(qty, p.stock, CFG.commerce.maxQtyPerLine || 10)) });
      });
      syncingCart = true;
      state.cart = merged;
      saveCart(); updateBadges(); renderCartDrawer();
      syncingCart = false;
      await CLOUD.pushCart(state.cart);
      emit('cart', {});
    } catch (error) { syncingCart = false; console.warn('[GALAX] Carrito en la nube:', error.message); }
  }
  function getProduct(code) {
    if (!state.catalog) return null;
    return (state.catalog.products || []).find((p) => String(p.code) === String(code)) || null;
  }
  function productImage(p) {
    if (!p) return 'assets/img/placeholders/laptop.svg';
    if (p.code === 'PC-001') return 'assets/img/optimized/laptop-hp.jpg';
    if (p.code === 'PC-041') return 'assets/img/optimized/laptop-lenovo.jpg';
    if (p.image && /\.(jpg|jpeg|png|webp)$/i.test(p.image)) return p.image;
    if (p.image && /\.svg$/i.test(p.image) && p.source === '002_seed_postgres.sql') return p.image;
    const map = {
      laptops: 'laptop', computadoras: 'desktop', monitores: 'monitor',
      componentes: 'components', perifericos: 'peripherals', redes: 'network', accesorios: 'accessories'
    };
    return 'assets/img/placeholders/' + (map[p.category] || 'laptop') + '.svg';
  }
  function productUrl(p) { return 'producto.html?code=' + encodeURIComponent(p.code); }
  function productSpecs(p) {
    const labels = ['cpu', 'ram', 'storage', 'gpu', 'screen'];
    return labels.map((key) => p.specs && p.specs[key]).filter(Boolean).slice(0, 3);
  }
  function stockInfo(p) {
    if (!p || p.stock <= 0) return { text: 'Agotado', cls: 'out' };
    if (p.stock <= 3) return { text: 'Últimas ' + p.stock + ' unidades', cls: 'warn' };
    return { text: 'Stock disponible: ' + p.stock, cls: '' };
  }
  function productCard(p, options) {
    if (!p) return '';
    const stock = stockInfo(p);
    const active = isFavorite(p.code);
    const img = productImage(p);
    const specs = productSpecs(p);
    const compare = p.compareAt && p.compareAt > p.price ? '<del>' + money(p.compareAt) + '</del>' : '';
    const availability = p.stock > 0
      ? '<button class="add-btn add-btn-text" type="button" data-add-to-cart="' + esc(p.code) + '" aria-label="Añadir al carrito ' + esc(p.name) + '" title="Añadir al carrito">' + icon('cart', 'icon-sm') + '<span class="add-label">Añadir al carrito</span></button>'
      : '<a class="btn btn-ghost btn-sm" href="' + esc(whatsappUrl('Hola, consulto disponibilidad del producto ' + p.code + ' — ' + p.name)) + '" target="_blank" rel="noopener">Consultar</a>';
    return '<article class="product-card' + (options && options.compact ? ' is-compact' : '') + '" data-code="' + esc(p.code) + '">' +
      '<a class="product-media" href="' + productUrl(p) + '" aria-label="Ver ' + esc(p.name) + '">' +
        '<img src="' + esc(img) + '" alt="' + esc(p.name) + '" loading="lazy" width="600" height="500">' +
        '<span class="product-flags"><span class="badge ' + (p.imageKind === 'foto' ? 'badge-green' : 'badge') + '">' + (p.imageKind === 'foto' ? 'Foto real' : 'Referencial') + '</span>' + (p.isNew ? '<span class="badge badge-cyan">Nuevo</span>' : '') + '</span>' +
        '<span class="product-code">' + esc(p.code) + '</span>' +
        '<button class="product-fav' + (active ? ' is-active' : '') + '" type="button" data-fav="' + esc(p.code) + '" aria-label="' + (active ? 'Quitar de favoritos' : 'Agregar a favoritos') + '" aria-pressed="' + active + '" title="Favorito">' + icon('heart', 'icon-sm') + '</button>' +
      '</a>' +
      '<div class="product-body">' +
        '<div class="product-brand"><span>' + esc(p.brand || 'GALAX') + '</span><span>' + esc(p.categoryName || '') + '</span></div>' +
        '<h3 class="product-title"><a href="' + productUrl(p) + '">' + esc(p.name) + '</a></h3>' +
        '<div class="product-specs">' + specs.map((s) => '<span>' + esc(s) + '</span>').join('') + '</div>' +
        '<div class="product-stock ' + stock.cls + '"><span class="dot"></span>' + esc(stock.text) + '</div>' +
        '<div class="product-buy"><div class="price"><small>Precio</small><strong>' + money(p.price) + '</strong>' + compare + '</div>' + availability + '</div>' +
      '</div></article>';
  }
  function cartCount() { return state.cart.reduce((n, item) => n + item.qty, 0); }
  function cartLines() {
    return state.cart.map((item) => {
      const p = getProduct(item.code);
      return p ? { product: p, qty: item.qty, subtotal: p.price * item.qty } : null;
    }).filter(Boolean);
  }
  function cartSubtotal() { return cartLines().reduce((n, line) => n + line.subtotal, 0); }
  function addToCart(code, qty) {
    const p = getProduct(code);
    if (!p) { toast('Producto no encontrado en el catálogo.', 'error'); return false; }
    if (!p.published || p.stock <= 0) { toast('Este producto está agotado. Consulta disponibilidad por WhatsApp.', 'error'); return false; }
    const existing = state.cart.find((x) => x.code === code);
    const nextQty = (existing ? existing.qty : 0) + (Number(qty) || 1);
    if (nextQty > p.stock) { toast('Solo hay ' + p.stock + ' unidades disponibles de este producto.', 'error'); return false; }
    if (nextQty > (CFG.commerce.maxQtyPerLine || 10)) { toast('Puedes agregar hasta ' + (CFG.commerce.maxQtyPerLine || 10) + ' unidades por producto.', 'error'); return false; }
    if (existing) existing.qty = nextQty; else state.cart.push({ code, qty: Number(qty) || 1 });
    saveCart(); updateBadges(); renderCartDrawer(); emit('cart', { code, qty: nextQty }); pushCartToCloud();
    toast(p.name.split(' — ')[0] + ' se agregó al carrito.', 'success');
    return true;
  }
  function setCartQty(code, qty) {
    const p = getProduct(code);
    const item = state.cart.find((x) => x.code === code);
    if (!p || !item) return;
    const next = Math.max(0, Math.min(Number(qty) || 0, p.stock, CFG.commerce.maxQtyPerLine || 10));
    if (next === 0) state.cart = state.cart.filter((x) => x.code !== code);
    else item.qty = next;
    saveCart(); updateBadges(); renderCartDrawer(); emit('cart', { code, qty: next }); pushCartToCloud();
  }
  function removeFromCart(code) {
    state.cart = state.cart.filter((x) => x.code !== code);
    saveCart(); updateBadges(); renderCartDrawer(); emit('cart', { code, qty: 0 });
    pushCartToCloud();
    toast('Producto retirado del carrito.', 'info');
  }
  function clearCart() {
    state.cart = [];
    saveCart(); updateBadges(); renderCartDrawer(); emit('cart', {});
    if (state.cloudUser && CLOUD && CLOUD.configured()) { try { CLOUD.clearCloudCart(); } catch {} }
  }
  function isFavorite(code) { return state.favorites.includes(code); }
  async function toggleFavorite(code) {
    const p = getProduct(code);
    if (!p) return;
    const adding = !isFavorite(code);
    if (adding) state.favorites.unshift(code);
    else state.favorites = state.favorites.filter((x) => x !== code);
    saveFavorites(); updateBadges(); emit('favorites', { code, adding });
    if (state.cloudUser && CLOUD && CLOUD.configured() && CFG.flags.cloudFavorites) {
      try {
        if (adding) await CLOUD.addFavorite(code); else await CLOUD.removeFavorite(code);
        state.cloudFavorites = true;
        toast(adding ? 'Guardado en tus favoritos de la nube.' : 'Retirado de tus favoritos.', 'success');
      } catch (error) {
        toast('Se guardó en este dispositivo. Inicia sesión para sincronizarlo.', 'info');
        console.warn(error.message);
      }
    } else {
      toast(adding ? 'Guardado en favoritos de este dispositivo.' : 'Retirado de favoritos.', 'success');
    }
    renderFavoriteButtons();
  }
  function renderFavoriteButtons() {
    qsa('[data-fav]').forEach((btn) => {
      const code = btn.getAttribute('data-fav');
      const active = isFavorite(code);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.setAttribute('aria-label', active ? 'Quitar de favoritos' : 'Agregar a favoritos');
      const svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', active ? 'currentColor' : 'none');
    });
  }
  function addLocalOrder(order) {
    state.orders.unshift(order);
    writeJSON(LS.orders, state.orders);
    emit('orders', { order });
    return order;
  }
  function localProfile() { return state.profile || DEFAULT_PROFILE; }
  function saveLocalProfile(patch) {
    state.profile = Object.assign({}, DEFAULT_PROFILE, state.profile, patch);
    writeJSON(LS.profile, state.profile);
    updateAccountLabel();
    emit('profile', state.profile);
    return state.profile;
  }
  function accountName() {
    if (state.cloudProfile && state.cloudProfile.nombre_completo) return state.cloudProfile.nombre_completo;
    if (state.cloudUser && state.cloudUser.email) return state.cloudUser.email.split('@')[0];
    if (state.profile && state.profile.name) return state.profile.name;
    return 'Cuenta';
  }

  /* ------------------------------------------------------------------ */
  /* Autenticación (Supabase)                                            */
  /* ------------------------------------------------------------------ */
  async function refreshAuth() {
    if (!CLOUD || !CLOUD.configured()) {
      updateAccountLabel();
      emit('auth', { user: null, configured: false });
      return null;
    }
    try {
      const user = await CLOUD.user();
      state.cloudUser = user;
      if (user) {
        state.cloudProfile = await CLOUD.profile();
        if (CFG.flags.cloudFavorites) {
          try {
            await CLOUD.syncFavorites(state.favorites);
            const remote = await CLOUD.listFavorites();
            const merged = Array.from(new Set([].concat(remote, state.favorites)));
            state.favorites = merged.filter((code) => getProduct(code));
            saveFavorites(); state.cloudFavorites = true;
          } catch (error) { console.warn('[GALAX] Favoritos en la nube:', error.message); }
        }
        // Carrito temporal -> cuenta. Evita duplicados y valida stock.
        try { await mergeCloudCart(); } catch (error) { console.warn('[GALAX] Carrito en la nube:', error.message); }
      } else {
        state.cloudProfile = null;
        state.cloudFavorites = false;
      }
      updateAccountLabel(); updateBadges(); renderFavoriteButtons();
      emit('auth', { user: state.cloudUser, profile: state.cloudProfile, configured: true });
      return user;
    } catch (error) {
      console.warn('[GALAX] Auth:', error.message);
      updateAccountLabel();
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Cabecera y pie                                                     */
  /* ------------------------------------------------------------------ */
  function navItems() {
    const page = document.body.getAttribute('data-page') || '';
    const current = (name) => page === name ? ' is-active' : '';
    return [
      ['tienda.html', 'Catálogo', current('tienda')],
      ['servicios.html', 'Servicios', current('servicios')],
      ['nosotros.html', 'Nosotros', current('nosotros')],
      ['contacto.html', 'Contacto', current('contacto')]
    ].map(([url, label, active]) => '<a class="' + active.trim() + '" href="' + url + '">' + label + '</a>').join('');
  }
  function topbar() {
    return '<div class="topbar"><div class="container topbar-inner">' +
      '<div class="topbar-group"><span>Venta y servicio técnico en Perú</span><span class="flex"><span class="dot"></span>Catálogo con stock real</span></div>' +
      '<div class="topbar-group"><a href="' + esc(whatsappUrl('Hola GALAX PC REPAIR, quiero hacer una consulta.')) + '" target="_blank" rel="noopener">' + icon('whatsapp', 'icon-sm') + 'WhatsApp ' + esc((state.content.brand && state.content.brand.whatsappDisplay) || '+51 986 260 738') + '</a><a href="servicios.html#solicitud">' + icon('wrench', 'icon-sm') + 'Servicio técnico</a></div>' +
      '</div></div>';
  }
  function headerHTML() {
    const c = state.catalog || { categories: [] };
    const count = cartCount();
    const favs = state.favorites.length;
    return topbar() +
      '<header class="site-header" id="galax-header">' +
      '<div class="container header-main">' +
        '<button class="icon-btn menu-toggle" type="button" data-menu-open aria-label="Abrir menú de 3 líneas" aria-controls="menu-drawer" aria-expanded="false">' + icon('menu') + '</button>' +
        '<a class="brand" href="index.html" aria-label="GALAX PC REPAIR, inicio">' +
          '<img class="brand-logo" src="' + esc((state.content.brand && state.content.brand.logo) || 'assets/img/logo.jpeg') + '" alt="Logo GALAX PC REPAIR" width="44" height="44">' +
          '<span class="brand-word"><strong>GALAX</strong><span>PC REPAIR</span></span>' +
        '</a>' +
        '<form class="header-search" role="search" data-header-search>' +
          icon('search') +
          '<input type="search" name="q" placeholder="Buscar laptop, marca, código…" aria-label="Buscar en el catálogo" autocomplete="off">' +
          '<kbd>Enter</kbd>' +
        '</form>' +
        '<div class="header-actions">' +
          '<a class="icon-btn" href="favoritos.html" aria-label="Favoritos" title="Favoritos">' + icon('heart') + (favs ? '<span class="count-bubble" data-fav-count>' + favs + '</span>' : '<span class="count-bubble" data-fav-count hidden>0</span>') + '</a>' +
          '<a class="icon-btn" href="cuenta.html" aria-label="Mi cuenta" title="Mi cuenta">' + icon('user') + '<span class="account-label sr-only" data-account-label>Cuenta</span></a>' +
          '<button class="icon-btn" type="button" data-cart-open aria-label="Abrir carrito" title="Carrito">' + icon('cart') + (count ? '<span class="count-bubble" data-cart-count>' + count + '</span>' : '<span class="count-bubble" data-cart-count hidden>0</span>') + '</button>' +
        '</div>' +
      '</div>' +
      '<nav class="header-nav" aria-label="Navegación principal"><div class="container header-nav-inner">' +
        '<a href="tienda.html" class="' + (document.body.getAttribute('data-page') === 'tienda' ? 'is-active' : '') + '">Todo el catálogo</a>' +
        (c.categories || []).slice(0, 5).map((cat) => '<a href="tienda.html?categoria=' + encodeURIComponent(cat.slug) + '">' + esc(cat.name) + '</a>').join('') +
        '<a href="servicios.html" class="' + (document.body.getAttribute('data-page') === 'servicios' ? 'is-active' : '') + '">Servicios</a>' +
        '<a href="nosotros.html" class="' + (document.body.getAttribute('data-page') === 'nosotros' ? 'is-active' : '') + '">Nosotros</a>' +
        '<a href="contacto.html" class="' + (document.body.getAttribute('data-page') === 'contacto' ? 'is-active' : '') + '">Contacto</a>' +
        '<a href="#" class="nav-highlight" data-open-airi>Airi · asistente IA</a>' +
      '</div></nav></header>';
  }
  function menuHTML() {
    const c = state.catalog || { categories: [], services: [] };
    const brand = (state.content && state.content.brand) || {};
    return '<div class="backdrop" data-close-overlays></div>' +
      '<aside class="drawer" id="menu-drawer" aria-label="Menú principal" aria-hidden="true">' +
      '<div class="drawer-head"><a class="brand" href="index.html"><img class="brand-logo" src="' + esc(brand.logo || 'assets/img/logo.jpeg') + '" alt="" width="38" height="38"><span class="brand-word"><strong>GALAX</strong><span>PC REPAIR</span></span></a><button class="icon-btn" type="button" data-close-overlays aria-label="Cerrar menú">' + icon('close') + '</button></div>' +
      '<div class="drawer-body">' +
        '<form class="drawer-search" role="search" data-header-search><span>' + icon('search') + '</span><input type="search" name="q" placeholder="Buscar en el catálogo…" aria-label="Buscar en el catálogo"></form>' +
        '<div class="menu-section"><h3>Catálogo</h3>' +
          '<a class="menu-link" href="tienda.html">' + icon('grid') + 'Todos los productos<span class="menu-count">' + ((c.meta && c.meta.productCount) || 0) + '</span></a>' +
          (c.categories || []).map((cat) => '<a class="menu-link" href="tienda.html?categoria=' + encodeURIComponent(cat.slug) + '">' + icon(categoryIcon(cat.slug)) + esc(cat.name) + '<span class="menu-count">' + cat.count + '</span></a>').join('') +
        '</div>' +
        '<div class="menu-section"><h3>Tienda y servicio</h3>' +
          '<a class="menu-link" href="servicios.html">' + icon('wrench') + 'Servicios técnicos</a>' +
          '<a class="menu-link" href="servicios.html#solicitud">' + icon('message') + 'Solicitar diagnóstico</a>' +
          '<a class="menu-link" href="nosotros.html">' + icon('store') + 'Sobre GALAX</a>' +
          '<a class="menu-link" href="contacto.html">' + icon('phone') + 'Contacto y WhatsApp</a>' +
          '<a class="menu-link" href="#" data-open-airi>' + icon('sparkles') + 'Hablar con Airi</a>' +
        '</div>' +
        '<div class="menu-section"><h3>Tu cuenta</h3>' +
          '<a class="menu-link" href="cuenta.html">' + icon('user') + 'Mi cuenta / ingresar</a>' +
          '<a class="menu-link" href="favoritos.html">' + icon('heart') + 'Favoritos<span class="menu-count">' + state.favorites.length + '</span></a>' +
          '<a class="menu-link" href="carrito.html">' + icon('cart') + 'Carrito<span class="menu-count">' + cartCount() + '</span></a>' +
          '<a class="menu-link" href="cuenta.html#pedidos">' + icon('receipt') + 'Mis pedidos</a>' +
          '<a class="menu-link" href="admin.html">' + icon('lock') + 'Acceso de equipo</a>' +
        '</div>' +
        '<div class="menu-section"><h3>Configuración</h3><div class="menu-settings">' +
          '<div class="setting-row"><span>Efectos festivos</span><button class="switch" type="button" data-setting="effects" aria-pressed="' + Boolean(state.settings.effects) + '" aria-label="Activar o desactivar efectos festivos"></button></div>' +
          '<div class="setting-row"><span>Reducir movimiento</span><button class="switch" type="button" data-setting="motion" aria-pressed="' + Boolean(state.settings.motion) + '" aria-label="Activar o desactivar animaciones"></button></div>' +
          '<a class="menu-link" href="configuracion.html">' + icon('settings') + 'Todas las preferencias</a>' +
        '</div></div>' +
        '<div class="menu-contact"><strong>¿Necesitas ayuda ahora?</strong><p>Escríbenos por WhatsApp y coordinamos tu compra o servicio técnico.</p><a class="btn btn-soft btn-sm" href="' + esc(whatsappUrl('Hola GALAX PC REPAIR, necesito ayuda con un producto o servicio.')) + '" target="_blank" rel="noopener">' + icon('whatsapp', 'icon-sm') + 'Escribir por WhatsApp</a></div>' +
      '</div></aside>';
  }
  function categoryIcon(slug) {
    const map = { laptops: 'laptop', computadoras: 'desktop', monitores: 'monitor', componentes: 'cpu', perifericos: 'keyboard', redes: 'wifi', accesorios: 'headphones' };
    return map[slug] || 'box';
  }
  function footerHTML() {
    const c = state.catalog || { categories: [] };
    const brand = (state.content && state.content.brand) || {};
    return '<footer class="site-footer"><div class="container">' +
      '<div class="footer-top">' +
        '<div class="footer-brand"><a class="brand" href="index.html"><img class="brand-logo" src="' + esc(brand.logo || 'assets/img/logo.jpeg') + '" alt="" width="44" height="44"><span class="brand-word"><strong>GALAX</strong><span>PC REPAIR</span></span></a><p>Venta de computadoras, laptops y componentes; reparación y soporte técnico. La tienda conserva el catálogo real y la identidad del proyecto original.</p><div class="flex" style="margin-top:12px"><span class="badge badge-cyan">Lima, Perú</span><span class="badge">Atención online</span></div></div>' +
        '<div class="footer-col"><h3>Catálogo</h3>' + (c.categories || []).map((cat) => '<a href="tienda.html?categoria=' + encodeURIComponent(cat.slug) + '">' + esc(cat.name) + '</a>').join('<br>') + '<br><a href="tienda.html">Ver todo</a></div>' +
        '<div class="footer-col"><h3>GALAX</h3><a href="nosotros.html">Sobre nosotros</a><br><a href="servicios.html">Servicios técnicos</a><br><a href="contacto.html">Contacto</a><br><a href="cuenta.html">Mi cuenta</a><br><a href="favoritos.html">Favoritos</a><br><a href="admin.html">Acceso de equipo</a></div>' +
        '<div class="footer-col"><h3>Atención</h3><div class="footer-contact"><a href="' + esc(whatsappUrl('Hola GALAX PC REPAIR, quiero información.')) + '" target="_blank" rel="noopener">' + icon('whatsapp') + 'WhatsApp ' + esc(brand.whatsappDisplay || '+51 986 260 738') + '</a><a href="servicios.html#solicitud">' + icon('wrench') + 'Diagnóstico y reparación</a><span class="flex">' + icon('clock') + 'Coordinación de citas por WhatsApp</span><span class="flex">' + icon('mapPin') + 'Lima, Perú · envíos coordinados</span></div><div class="payment-row" style="margin-top:12px"><span class="payment-chip">Yape</span><span class="payment-chip">Plin</span><span class="payment-chip">Transferencia</span><span class="payment-chip">Tarjeta*</span></div><p class="receipt-note" style="margin-top:8px">*Tarjeta sujeta a habilitación de la pasarela oficial. El recibo PNG es un comprobante interno, no una factura SUNAT.</p></div>' +
      '</div>' +
      '<div class="footer-bottom"><p>© ' + new Date().getFullYear() + ' GALAX PC REPAIR. Precios en soles peruanos (PEN). Imágenes referenciales señaladas como tales.</p><div class="footer-legal"><a href="aviso-legal.html">Aviso legal</a><a href="privacidad.html">Privacidad</a><a href="reclamaciones.html">Libro de reclamaciones</a><a href="configuracion.html">Configuración</a></div></div>' +
      '</div></footer>';
  }

  /* ------------------------------------------------------------------ */
  /* Carrito lateral, menú y búsqueda                                   */
  /* ------------------------------------------------------------------ */
  function cartDrawerHTML() {
    const lines = cartLines();
    const subtotal = cartSubtotal();
    const body = lines.length ? lines.map((line) => {
      const p = line.product;
      const stock = stockInfo(p);
      return '<div class="cart-line"><a class="cart-line-media" href="' + productUrl(p) + '"><img src="' + esc(productImage(p)) + '" alt="' + esc(p.name) + '" loading="lazy"></a>' +
        '<div><a class="cart-line-title" href="' + productUrl(p) + '">' + esc(p.name) + '</a><div class="cart-line-meta">' + esc(p.code) + ' · ' + esc(p.brand) + '</div><div class="cart-line-actions"><div class="qty"><button type="button" data-cart-dec="' + esc(p.code) + '" aria-label="Quitar una unidad">' + icon('minus', 'icon-sm') + '</button><span>' + line.qty + '</span><button type="button" data-cart-inc="' + esc(p.code) + '" aria-label="Agregar una unidad">' + icon('plus', 'icon-sm') + '</button></div><button type="button" class="cart-remove" data-cart-remove="' + esc(p.code) + '">' + icon('trash', 'icon-sm') + 'Quitar</button></div>' + (line.qty >= p.stock ? '<div class="stock-warning">' + icon('alert', 'icon-sm') + 'Máximo disponible: ' + p.stock + '</div>' : '') + '</div>' +
        '<div class="cart-line-price">' + money(line.subtotal) + '</div></div>';
    }).join('') : '<div class="cart-empty">' + icon('cart') + '<strong>Tu carrito está vacío</strong><p>Explora el catálogo con stock real y agrega el equipo que buscas.</p><a class="btn btn-primary btn-sm" href="tienda.html">Ver catálogo</a></div>';
    return '<div class="backdrop" data-close-overlays></div><aside class="drawer drawer-right" id="cart-drawer" aria-label="Carrito de compras" aria-hidden="true">' +
      '<div class="drawer-head"><h2>Tu carrito <span class="badge badge-cyan">' + cartCount() + '</span></h2><button class="icon-btn" type="button" data-close-overlays aria-label="Cerrar carrito">' + icon('close') + '</button></div>' +
      '<div class="drawer-body">' + body + '</div>' +
      (lines.length ? '<div class="drawer-foot"><div class="cart-totals"><div class="cart-total-row"><span>Subtotal</span><strong>' + money(subtotal) + '</strong></div><div class="cart-total-row"><span>Envío</span><span>Se calcula en el checkout</span></div><div class="cart-total-row total"><span>Total referencial</span><strong>' + money(subtotal) + '</strong></div></div><a class="btn btn-primary btn-block" href="checkout.html">Continuar con el pedido ' + icon('arrowRight', 'icon-sm') + '</a><a class="btn btn-ghost btn-block btn-sm" href="carrito.html" style="margin-top:7px">Ver carrito completo</a><p class="form-note" style="margin-top:8px">Precios y stock se validan nuevamente al crear el pedido. No se procesa ningún pago automáticamente.</p></div>' : '') +
      '</aside>';
  }
  function renderCartDrawer() {
    const host = qs('#cart-drawer-host');
    if (host) host.innerHTML = cartDrawerHTML();
  }
  function searchHTML() {
    return '<div class="search-modal" id="search-modal" aria-label="Buscador" role="dialog" aria-modal="true"><div class="search-modal-card"><div class="search-input-row">' + icon('search') + '<input type="search" id="search-overlay-input" placeholder="Busca por nombre, marca, procesador o código…" aria-label="Buscar productos" autocomplete="off"><button class="icon-btn" type="button" data-close-search aria-label="Cerrar buscador">' + icon('close') + '</button></div><div class="search-results" id="search-results"><div class="search-empty">Escribe para ver resultados del catálogo real.</div></div><div style="padding:9px 14px;border-top:1px solid var(--gx-line)"><a href="tienda.html" style="color:var(--gx-cyan);font-size:.75rem;font-weight:700">Ver catálogo completo ' + icon('arrowRight', 'icon-sm') + '</a></div></div></div>';
  }
  function searchProducts(query, limit) {
    const q = normalizeText(query).trim();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return (state.catalog.products || []).filter((p) => {
      if (!p.published) return false;
      const hay = p.search || normalizeText([p.name, p.brand, p.model, p.code, p.description, p.categoryName, p.specs && Object.values(p.specs).join(' ')].join(' '));
      return tokens.every((token) => hay.includes(token));
    }).sort((a, b) => {
      const ac = normalizeText(a.code) === q || normalizeText(a.name).includes(q) ? 2 : 1;
      const bc = normalizeText(b.code) === q || normalizeText(b.name).includes(q) ? 2 : 1;
      if (ac !== bc) return bc - ac;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.price - b.price;
    }).slice(0, limit || 8);
  }
  function renderSearchResults(query) {
    const host = qs('#search-results');
    if (!host) return;
    const results = searchProducts(query, 8);
    if (!query.trim()) { host.innerHTML = '<div class="search-empty">Escribe para ver resultados del catálogo real.</div>'; return; }
    if (!results.length) {
      host.innerHTML = '<div class="search-empty">No encontramos coincidencias exactas. Prueba con otra marca o código, o <a href="' + esc(whatsappUrl('Hola, busco un producto que no encuentro en la tienda: ' + query)) + '" target="_blank" rel="noopener" style="color:var(--gx-cyan)">consúltanos por WhatsApp</a>.</div>';
      return;
    }
    host.innerHTML = results.map((p) => '<a class="search-result" href="' + productUrl(p) + '"><img src="' + esc(productImage(p)) + '" alt="" loading="lazy"><div><strong>' + esc(p.name) + '</strong><span>' + esc(p.brand) + ' · ' + esc(p.code) + ' · ' + esc(stockInfo(p).text) + '</span></div><div class="price"><strong>' + money(p.price) + '</strong></div></a>').join('') +
      '<a class="search-result" href="tienda.html?q=' + encodeURIComponent(query) + '"><div><strong>Ver todos los resultados para “' + esc(query) + '”</strong><span>Abrir catálogo con búsqueda y filtros</span></div><span style="margin-left:auto;color:var(--gx-cyan)">' + icon('arrowRight') + '</span></a>';
  }
  function openSearch(initial) {
    let modal = qs('#search-modal');
    if (!modal) { document.body.insertAdjacentHTML('beforeend', searchHTML()); modal = qs('#search-modal'); }
    modal.hidden = false;
    const input = qs('#search-overlay-input');
    if (input) { input.value = initial || ''; setTimeout(() => input.focus(), 30); }
    renderSearchResults(initial || '');
    ui.lastFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const onInput = debounce((e) => renderSearchResults(e.target.value), 120);
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); const first = qs('.search-result', modal); if (first) first.focus(); }
      if (e.key === 'Enter' && input.value.trim()) { location.href = 'tienda.html?q=' + encodeURIComponent(input.value.trim()); }
    });
  }
  function closeSearch() {
    const modal = qs('#search-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  function openOverlay(selector) {
    closeAllOverlays(true);
    const el = qs(selector);
    if (!el) return;
    ui.lastFocus = document.activeElement;
    const backdrop = qs('.backdrop', el.parentElement);
    if (backdrop) backdrop.classList.add('is-open');
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const toggle = qs('[data-menu-open]');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    const focusable = qs('button, a[href], input, select, textarea', el);
    if (focusable) setTimeout(() => focusable.focus(), 60);
    if (!ui.openOverlays.includes(el)) ui.openOverlays.push(el);
  }
  function closeAllOverlays(silent) {
    ui.openOverlays.forEach((el) => {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      const backdrop = qs('.backdrop', el.parentElement);
      if (backdrop) backdrop.classList.remove('is-open');
    });
    ui.openOverlays = [];
    document.body.style.overflow = '';
    const toggle = qs('[data-menu-open]');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (!silent && ui.lastFocus && typeof ui.lastFocus.focus === 'function') ui.lastFocus.focus();
  }
  function openCart() { openOverlay('#cart-drawer'); }
  function openMenu() { openOverlay('#menu-drawer'); }

  /* ------------------------------------------------------------------ */
  /* Toasts / modal                                                     */
  /* ------------------------------------------------------------------ */
  function toast(message, type) {
    let stack = qs('.toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'checkCircle') + '<span>' + esc(message) + '</span>';
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; setTimeout(() => el.remove(), 250); }, 3600);
  }
  function modal(options) {
    return new Promise((resolve) => {
      const id = 'galax-modal-' + Date.now();
      const html = '<div class="modal" id="' + id + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '-title"><div class="backdrop is-open" data-modal-close></div><div class="modal-card"><button class="icon-btn modal-close" type="button" data-modal-close aria-label="Cerrar">' + icon('close') + '</button><h2 id="' + id + '-title">' + esc(options.title || 'GALAX') + '</h2><div>' + (options.body || '') + '</div><div class="flex" style="margin-top:18px;justify-content:flex-end;flex-wrap:wrap">' +
        (options.cancelText !== null ? '<button class="btn btn-ghost btn-sm" type="button" data-modal-cancel>' + esc(options.cancelText || 'Cancelar') + '</button>' : '') +
        '<button class="btn btn-primary btn-sm" type="button" data-modal-ok>' + esc(options.okText || 'Aceptar') + '</button></div></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      const el = document.getElementById(id);
      const close = (value) => { el.remove(); document.body.style.overflow = ''; resolve(value); };
      qsa('[data-modal-close]', el).forEach((b) => b.addEventListener('click', () => close(false)));
      qs('[data-modal-cancel]', el).addEventListener('click', () => close(false));
      const ok = qs('[data-modal-ok]', el);
      if (ok) ok.addEventListener('click', async () => {
        if (typeof options.onOk !== 'function') { close(true); return; }
        ok.disabled = true;
        try {
          const result = await options.onOk(el);
          if (result === false) { ok.disabled = false; return; }
          close(result === undefined ? true : result);
        } catch (error) {
          console.error('[GALAX] modal onOk:', error);
          toast(error.message || 'No se pudo completar la acción.', 'error');
          ok.disabled = false;
        }
      });
      document.body.style.overflow = 'hidden';
      if (ok) ok.focus();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Interfaz                                                           */
  /* ------------------------------------------------------------------ */
  function updateBadges() {
    const count = cartCount();
    qsa('[data-cart-count]').forEach((el) => { el.textContent = count; el.hidden = count === 0; });
    qsa('[data-fav-count]').forEach((el) => { el.textContent = state.favorites.length; el.hidden = state.favorites.length === 0; });
    qsa('[data-cart-total]').forEach((el) => { el.textContent = money(cartSubtotal()); });
    qsa('[data-cart-count-text]').forEach((el) => { el.textContent = count + (count === 1 ? ' producto' : ' productos'); });
    updateAccountLabel();
  }
  function updateAccountLabel() {
    qsa('[data-account-label]').forEach((el) => { el.textContent = accountName(); });
  }
  function renderShell() {
    const header = qs('#site-header');
    const footer = qs('#site-footer');
    if (header) header.innerHTML = headerHTML();
    if (footer) footer.innerHTML = footerHTML();
    if (!qs('#menu-drawer')) document.body.insertAdjacentHTML('beforeend', menuHTML());
    let cartHost = qs('#cart-drawer-host');
    if (!cartHost) { cartHost = document.createElement('div'); cartHost.id = 'cart-drawer-host'; document.body.appendChild(cartHost); }
    renderCartDrawer();
    if (!qs('#search-modal')) document.body.insertAdjacentHTML('beforeend', searchHTML());
    if (!qs('.whatsapp-fab')) {
      document.body.insertAdjacentHTML('beforeend', '<a class="whatsapp-fab" href="' + esc(whatsappUrl('Hola GALAX PC REPAIR, quiero información sobre un producto o servicio.')) + '" target="_blank" rel="noopener" aria-label="Escribir a GALAX por WhatsApp" title="WhatsApp GALAX">' + icon('whatsapp') + '</a>');
    }
    const page = document.body.getAttribute('data-page');
    if (page) document.body.setAttribute('data-page', page);
    if (state.loadError) {
      const main = qs('#main');
      if (main && !qs('.global-alert--data')) main.insertAdjacentHTML('afterbegin', '<div class="global-alert global-alert--data" role="alert">' + icon('alert') + '<div><strong>El catálogo local no se pudo leer.</strong> Abre la tienda desde GitHub Pages o un servidor HTTP local (no desde <code>file://</code>). La interfaz sigue disponible, pero faltan productos.</div></div>');
    }
    applySettings();
    updateBadges();
    renderFavoriteButtons();
  }

  /* ------------------------------------------------------------------ */
  /* Eventos globales                                                   */
  /* ------------------------------------------------------------------ */
  function bindGlobalEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      const add = target.closest('[data-add-to-cart]');
      if (add) { event.preventDefault(); addToCart(add.getAttribute('data-add-to-cart'), Number(add.getAttribute('data-qty') || 1)); return; }
      const fav = target.closest('[data-fav]');
      if (fav) { event.preventDefault(); toggleFavorite(fav.getAttribute('data-fav')); return; }
      if (target.closest('[data-menu-open]')) { event.preventDefault(); openMenu(); return; }
      if (target.closest('[data-cart-open]')) { event.preventDefault(); openCart(); return; }
      if (target.closest('[data-open-airi]')) { event.preventDefault(); closeAllOverlays(true); emit('open-airi', {}); return; }
      if (target.closest('[data-search-open]')) { event.preventDefault(); openSearch(''); return; }
      if (target.closest('[data-close-search]')) { event.preventDefault(); closeSearch(); return; }
      if (target.closest('[data-close-overlays]')) { event.preventDefault(); closeAllOverlays(); return; }
      const closeMenuLink = target.closest('#menu-drawer a[href]');
      if (closeMenuLink) { if (ui.openOverlays.length) closeAllOverlays(true); }
      const setting = target.closest('[data-setting]');
      if (setting) { event.preventDefault(); const key = setting.getAttribute('data-setting'); setSetting(key, !state.settings[key]); toast(key === 'effects' ? (state.settings.effects ? 'Efectos festivos activados.' : 'Efectos festivos desactivados.') : (state.settings.motion ? 'Animaciones activadas.' : 'Movimiento reducido.'), 'info'); return; }
      const inc = target.closest('[data-cart-inc]');
      if (inc) { const code = inc.getAttribute('data-cart-inc'); const line = state.cart.find((x) => x.code === code); if (line) setCartQty(code, line.qty + 1); return; }
      const dec = target.closest('[data-cart-dec]');
      if (dec) { const code = dec.getAttribute('data-cart-dec'); const line = state.cart.find((x) => x.code === code); if (line) setCartQty(code, line.qty - 1); return; }
      const rem = target.closest('[data-cart-remove]');
      if (rem) { removeFromCart(rem.getAttribute('data-cart-remove')); return; }
      const clear = target.closest('[data-clear-cart]');
      if (clear) { event.preventDefault(); if (state.cart.length) modal({ title: '¿Vaciar el carrito?', body: '<p>Se quitarán todos los productos guardados en este dispositivo.</p>', okText: 'Sí, vaciar' }).then((yes) => { if (yes) { clearCart(); toast('Carrito vacío.', 'info'); } }); return; }
    });
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (form.matches('[data-header-search]')) {
        event.preventDefault();
        const q = new FormData(form).get('q');
        location.href = 'tienda.html' + (q && String(q).trim() ? '?q=' + encodeURIComponent(String(q).trim()) : '');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (qs('#search-modal') && !qs('#search-modal').hidden) closeSearch();
        if (ui.openOverlays.length) closeAllOverlays();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); openSearch('');
      }
      if (event.key === '/' && !/input|textarea|select/i.test((event.target.tagName || ''))) {
        event.preventDefault(); openSearch('');
      }
      if (event.key === 'Tab' && ui.openOverlays.length) {
        const container = ui.openOverlays[ui.openOverlays.length - 1];
        const focusables = qsa('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', container).filter((el) => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('scroll', () => {
      const h = qs('#galax-header');
      if (h) h.classList.toggle('is-scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Inicialización                                                     */
  /* ------------------------------------------------------------------ */
  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      bindGlobalEvents();
      await loadData();
      state.loading = false;
      renderShell();
      try { await refreshAuth(); } catch (error) { console.warn(error); }
      if (CLOUD && CLOUD.configured()) {
        try {
          CLOUD.onAuthChange(() => { refreshAuth(); });
        } catch (error) { console.warn(error); }
      }
      emit('ready', { catalog: state.catalog, content: state.content, festive: state.festive });
    })();
    return initPromise;
  }

  /* ------------------------------------------------------------------ */
  /* API pública                                                        */
  /* ------------------------------------------------------------------ */
  window.GALAX = {
    ready: init,
    init,
    get state() { return state; },
    get catalog() { return state.catalog; },
    get content() { return state.content; },
    get settings() { return state.settings; },
    get cloudUser() { return state.cloudUser; },
    get cloudProfile() { return state.cloudProfile; },
    config: CFG,
    paths: { data: DATA_URLS },
    icon, money, esc, dateLong, dateShort, slug, debounce, normalizeText,
    whatsappUrl, getProduct, productImage, productUrl, productSpecs, stockInfo, productCard,
    searchProducts, cartLines, cartCount, cartSubtotal, addToCart, setCartQty, removeFromCart, clearCart, addLocalOrder,
    isFavorite, toggleFavorite, renderFavoriteButtons, updateBadges,
    localProfile, saveLocalProfile, accountName,
    toast, modal, openSearch, closeSearch, openCart, openMenu, closeAllOverlays,
    refreshAuth, setSetting, applySettings,
    on, once, emit,
    cloud: CLOUD,
    reload: async () => { initPromise = null; state.loading = true; await init(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
