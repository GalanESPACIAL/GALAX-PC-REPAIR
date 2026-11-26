/* =====================================================================
   GALAX PC REPAIR — Cliente Supabase (navegador, clave anon únicamente).
   La autorización real vive en RLS + funciones SQL SECURITY DEFINER.
   ===================================================================== */
(function () {
  'use strict';

  const cfg = window.GALAX_CONFIG || {};
  const conf = cfg.supabase || {};
  let client = null;
  let loadingPromise = null;

  function configured() {
    // Solo URL pública + clave anon/publishable. NUNCA service_role ni claves secretas.
    return Boolean(conf.url && conf.anonKey && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(conf.url));
  }

  function siteBase() {
    const base = (cfg.siteUrl || location.origin + location.pathname).replace(/\/?$/, '/');
    // Asegura la ruta de proyecto de GitHub Pages (no dominio inventado).
    return base;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => window.supabase && window.supabase.createClient
        ? resolve()
        : reject(new Error('El cliente Supabase no se inicializó.'));
      s.onerror = () => reject(new Error('No se pudo cargar el cliente Supabase.'));
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (!configured()) return null;
    if (client) return client;
    if (!loadingPromise) {
      loadingPromise = loadScript('assets/vendor/supabase.js')
        .then(() => {
          client = window.supabase.createClient(conf.url.replace(/\/$/, ''), conf.anonKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              // PKCE funciona en sitio estático; las URLs de retorno incluyen la ruta /GALAX-PC-REPAIR/.
              flowType: 'pkce'
            },
            global: { headers: { 'x-client-info': 'galax-pc-repair-web' } }
          });
          return client;
        })
        .catch((error) => {
          loadingPromise = null;
          throw error;
        });
    }
    return loadingPromise;
  }

  async function maybe() {
    if (!configured()) return null;
    try { return await init(); } catch (error) { console.warn('[GALAX] Supabase no disponible:', error.message); return null; }
  }

  async function user() {
    const c = await maybe();
    if (!c) return null;
    const { data } = await c.auth.getUser();
    return data && data.user ? data.user : null;
  }

  async function session() {
    const c = await maybe();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data && data.session ? data.session : null;
  }

  async function onAuthChange(callback) {
    const c = await maybe();
    if (!c) return () => {};
    const { data } = c.auth.onAuthStateChange((event, sess) => callback(event, sess));
    return () => data.subscription.unsubscribe();
  }

  async function signIn(email, password) {
    const c = await init();
    // Supabase Auth es la autoridad. No se crean cuentas en localStorage ni se guardan contraseñas.
    const { data, error } = await c.auth.signInWithPassword({ email: String(email || '').trim().toLowerCase(), password });
    if (error) throw error;
    return data;
  }

  async function signUp(opts) {
    const c = await init();
    const email = String(opts.email || '').trim().toLowerCase();
    const nombre = String(opts.nombre || opts.name || '').trim();
    const apellidos = String(opts.apellidos || opts.surname || opts.lastName || '').trim();
    const nombreCompleto = String(opts.nombreCompleto || opts.name || [nombre, apellidos].filter(Boolean).join(' ')).trim();
    // No se envía role ni se permite auto-admin. El servidor asigna role='customer'.
    const { data, error } = await c.auth.signUp({
      email,
      password: opts.password,
      options: {
        data: {
          nombre: nombre,
          apellidos: apellidos,
          nombre_completo: nombreCompleto,
          telefono: opts.phone || opts.telefono || null
        },
        // Ruta de proyecto correcta en GitHub Pages. Supabase debe añadirla a Redirect URLs.
        emailRedirectTo: siteBase() + 'cuenta.html?confirmado=1'
      }
    });
    if (error) throw error;
    return data;
  }

  async function signOut(scope) {
    const c = await init();
    // scope: 'local' | 'global' | 'others'. global = cerrar en todos los dispositivos.
    const { error } = await c.auth.signOut({ scope: scope || 'local' });
    if (error) throw error;
  }

  async function signOutGlobal() { return signOut('global'); }
  async function signOutOthers() { return signOut('others'); }

  async function resendConfirmation(email) {
    const c = await init();
    const { error } = await c.auth.resend({ type: 'signup', email: String(email || '').trim().toLowerCase(), options: { emailRedirectTo: siteBase() + 'cuenta.html?confirmado=1' } });
    if (error) throw error;
  }

  async function updateEmail(email) {
    const c = await init();
    const { error } = await c.auth.updateUser({ email: String(email || '').trim().toLowerCase(), options: { emailRedirectTo: siteBase() + 'cuenta.html?correo=actualizado' } });
    if (error) throw error;
  }

  async function resetPassword(email) {
    const c = await init();
    const redirectTo = siteBase() + 'cuenta.html?recuperar=1';
    const { error } = await c.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), { redirectTo });
    if (error) throw error;
  }

  async function updatePassword(password) {
    const c = await init();
    const { error } = await c.auth.updateUser({ password });
    if (error) throw error;
  }

  async function refreshSession() {
    const c = await init();
    const { data, error } = await c.auth.refreshSession();
    if (error) throw error;
    return data && data.session ? data.session : null;
  }

  async function profile() {
    const c = await maybe();
    if (!c) return null;
    const u = await user();
    if (!u) return null;
    const { data, error } = await c.from('profiles').select('id,nombre_completo,nombre,apellidos,telefono,direccion,avatar,role,created_at').eq('id', u.id).maybeSingle();
    if (error) throw error;
    // role proviene del servidor; nunca se escribe desde el cliente.
    return data ? Object.assign({ email: u.email, email_confirmed_at: u.email_confirmed_at || null }, data, { role: data.role || 'customer' }) : null;
  }

  async function updateProfile(patch) {
    const c = await init();
    const u = await user();
    if (!u) throw new Error('Inicia sesión para guardar tu perfil.');
    // NO se envía role. El trigger del servidor impide auto-promoverse.
    const nombreCompleto = String(patch.nombreCompleto || patch.name || [patch.nombre, patch.apellidos].filter(Boolean).join(' ') || '').trim();
    const payload = {
      id: u.id,
      nombre_completo: nombreCompleto || (u.email ? u.email.split('@')[0] : 'Cliente'),
      nombre: patch.nombre != null ? patch.nombre : null,
      apellidos: patch.apellidos != null ? patch.apellidos : null,
      telefono: patch.phone || patch.telefono || null,
      direccion: patch.address || patch.direccion || null
    };
    const { data, error } = await c.from('profiles').upsert(payload, { onConflict: 'id' }).select().maybeSingle();
    if (error) throw error;
    return data;
  }

  function normalizeProduct(row) {
    if (!row) return null;
    // Acepta tanto claves normalizadas (code/name/price) como columnas legadas (codigo/nombre/precio_venta).
    const specsRaw = row.specs != null ? row.specs : (row.especificaciones != null ? safeSpecs(row.especificaciones) : {});
    const specs = specsRaw && typeof specsRaw === 'object' ? specsRaw : {};
    const specList = row.specList && Array.isArray(row.specList) ? row.specList : Object.entries(specs).map(([label, value]) => ({ label, value: String(value) }));
    const code = row.code != null ? row.code : row.codigo;
    const name = row.name != null ? row.name : row.nombre;
    const brand = row.brand != null ? row.brand : row.marca;
    const model = row.model != null ? row.model : row.modelo;
    const categorySlug = row.category_slug != null ? row.category_slug : (row.categorias && row.categorias.slug) || row.category || '';
    const categoryName = row.category_name != null ? row.category_name : (row.categorias && row.categorias.nombre) || row.categoryName || '';
    const priceNum = Number(row.price != null ? row.price : (row.precio_oferta != null && row.precio_oferta !== '' ? row.precio_oferta : (row.precio_venta != null ? row.precio_venta : 0)));
    const compareAtNum = row.compare_at != null ? Number(row.compare_at) : (row.compareAt != null ? Number(row.compareAt) : (row.precio_oferta != null && row.precio_oferta !== '' && row.precio_venta != null ? Number(row.precio_venta) : null));
    const stockNum = Number(row.stock != null ? row.stock : 0);
    const image = row.image != null ? row.image : row.imagen;
    const published = row.published != null ? row.published : row.publicado;
    return {
      id: row.id,
      code,
      name,
      model: model || name,
      brand: brand || '',
      category: categorySlug,
      categoryName,
      categoryId: row.category_id != null ? row.category_id : row.categoria_id,
      price: Number.isFinite(priceNum) ? priceNum : 0,
      compareAt: compareAtNum != null && Number.isFinite(compareAtNum) ? compareAtNum : null,
      purchase: null,
      stock: Number.isFinite(stockNum) ? stockNum : 0,
      stockMin: row.stock_minimo != null ? Number(row.stock_minimo) : 0,
      description: row.description != null ? row.description : (row.descripcion || ''),
      specText: row.description != null ? row.description : (row.descripcion || ''),
      specs,
      specList,
      image: image || '',
      imageKind: row.image_kind != null ? row.image_kind : (row.imageKind != null ? row.imageKind : 'referencial'),
      featured: Boolean(row.featured != null ? row.featured : row.destacado),
      isNew: Boolean(row.is_new != null ? row.is_new : row.es_nuevo),
      published: published != null ? published !== false && published !== 0 && published !== '0' : true,
      available: (Number.isFinite(stockNum) ? stockNum : 0) > 0,
      stockLabel: (Number.isFinite(stockNum) ? stockNum : 0) === 0 ? 'Agotado' : (Number.isFinite(stockNum) ? stockNum : 0) <= 3 ? 'Últimas unidades' : 'Disponible',
      images: (row.images && Array.isArray(row.images) && row.images.length) ? row.images : (image ? [image] : []),
      video: row.video || null,
      search: [name, brand, model, code, row.description || row.descripcion, categoryName].join(' ').toLowerCase(),
      source: 'supabase'
    };
  }

  async function catalogPage(params = {}) {
    const c = await init();
    const { data, error } = await c.rpc('store_catalog_page', {
      p_search: params.search || null,
      p_category: params.category || null,
      p_brands: params.brands && params.brands.length ? params.brands : null,
      p_min: params.min == null ? null : params.min,
      p_max: params.max == null ? null : params.max,
      p_in_stock: Boolean(params.inStock),
      p_sort: params.sort || 'relevance',
      p_limit: Math.max(1, Math.min(100, Number(params.limit) || 24)),
      p_offset: Math.max(0, Number(params.offset) || 0)
    });
    if (error) throw error;
    const payload = data || {};
    const items = (payload.items || []).map(normalizeProduct);
    return {
      items,
      total: Number(payload.total || 0),
      page: Number(payload.page || 1),
      limit: Number(payload.limit || params.limit || 24),
      facets: payload.facets || null
    };
  }

  async function allProducts() {
    const c = await maybe();
    if (!c) return null;
    const { data, error } = await c.from('productos')
      .select('id,codigo,nombre,descripcion,categoria_id,marca,modelo,slug,imagen,precio_venta,precio_oferta,stock,publicado,destacado,es_nuevo,especificaciones,categorias(nombre,slug)')
      .eq('publicado', 1).eq('estado', 'activo').order('destacado', { ascending: false }).limit(1000);
    if (error) throw error;
    return (data || []).map((row) => normalizeProduct({
      id: row.id,
      code: row.codigo,
      name: row.nombre,
      description: row.descripcion,
      model: row.modelo,
      brand: row.marca,
      category_id: row.categoria_id,
      category_slug: row.categorias && row.categorias.slug,
      category_name: row.categorias && row.categorias.nombre,
      price: row.precio_oferta != null ? row.precio_oferta : row.precio_venta,
      compare_at: row.precio_oferta != null ? row.precio_venta : null,
      stock: row.stock,
      image: row.imagen,
      featured: row.destacado === 1,
      is_new: row.es_nuevo === 1,
      published: row.publicado === 1,
      specs: safeSpecs(row.especificaciones)
    }));
  }

  function safeSpecs(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return { 'Especificaciones': String(value) }; }
  }

  async function listFavorites() {
    const c = await init();
    const u = await user();
    if (!u) return [];
    const { data, error } = await c.from('store_favorites').select('product_code,created_at').eq('user_id', u.id).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => r.product_code);
  }

  async function addFavorite(code) {
    const c = await init();
    const u = await user();
    if (!u) throw new Error('Inicia sesión para guardar favoritos en la nube.');
    const { error } = await c.from('store_favorites').upsert({ user_id: u.id, product_code: code }, { onConflict: 'user_id,product_code' });
    if (error) throw error;
  }

  async function removeFavorite(code) {
    const c = await init();
    const u = await user();
    if (!u) throw new Error('Inicia sesión para editar favoritos en la nube.');
    const { error } = await c.from('store_favorites').delete().eq('user_id', u.id).eq('product_code', code);
    if (error) throw error;
  }

  async function createOrder({ items, customer, shipping, payment, notes }) {
    const c = await init();
    const { data, error } = await c.rpc('store_create_order', {
      p_items: items, p_customer: customer, p_shipping: shipping, p_payment: payment, p_notes: notes || null
    });
    if (error) throw error;
    return data;
  }

  async function listOrders() {
    const c = await perhapsForData();
    if (!c) return [];
    const { data, error } = await c.from('store_orders')
      .select('id,code,status,payment_method,subtotal,shipping_cost,total,created_at,customer_name,customer_email,customer_phone,shipping_address,notes,store_order_items(product_code,product_name,quantity,unit_price,subtotal)')
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data || []).map(mapOrder);
  }

  async function getOrderByCode(code) {
    const c = await perhapsForData();
    if (!c) return null;
    const { data, error } = await c.from('store_orders')
      .select('id,code,status,payment_method,subtotal,shipping_cost,total,created_at,customer_name,customer_email,customer_phone,shipping_address,notes,store_order_items(product_code,product_name,quantity,unit_price,subtotal)')
      .eq('code', code).maybeSingle();
    if (error) throw error;
    return data ? mapOrder(data) : null;
  }

  function mapOrder(row) {
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      payment: row.payment_method,
      subtotal: Number(row.subtotal),
      shippingCost: Number(row.shipping_cost),
      total: Number(row.total),
      date: row.created_at,
      source: 'cloud',
      customer: {
        name: row.customer_name || '',
        email: row.customer_email || '',
        phone: row.customer_phone || '',
        address: row.shipping_address || ''
      },
      notes: row.notes || '',
      items: (row.store_order_items || []).map((it) => ({
        code: it.product_code,
        name: it.product_name,
        qty: it.quantity,
        price: Number(it.unit_price),
        subtotal: Number(it.subtotal)
      }))
    };
  }

  async function perhapsForData() {
    const c = await maybe();
    if (!c) return null;
    const u = await user();
    return u ? c : null;
  }

  async function isAdmin() {
    try {
      const p = await profile();
      return Boolean(p && ['admin', 'editor'].includes(p.role));
    } catch { return false; }
  }

  async function adminStats() {
    const c = await init();
    const { data, error } = await c.rpc('store_admin_stats');
    if (error) throw error;
    return data || {};
  }

  async function adminProducts(search = '') {
    const c = await init();
    let q = c.from('productos')
      .select('id,codigo,nombre,marca,precio_venta,stock,publicado,estado,destacado,categorias(nombre)')
      .order('codigo', { ascending: true }).limit(300);
    if (search) q = q.or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%,marca.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function updateProduct(id, patch) {
    const c = await init();
    const { data, error } = await c.from('productos').update(patch).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return data;
  }

  async function adminOrders() {
    const c = await init();
    const { data, error } = await c.from('store_orders')
      .select('id,code,status,payment_method,total,created_at,customer_name,customer_phone,customer_email,store_order_items(product_code,product_name,quantity,unit_price,subtotal)')
      .order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }

  async function updateOrderStatus(id, status) {
    const c = await init();
    const { data, error } = await c.rpc('store_update_order_status', { p_order_id: id, p_status: status });
    if (error) throw error;
    return data;
  }

  async function loadContent() {
    const c = await maybe();
    if (!c) return null;
    const { data, error } = await c.from('store_content').select('published,updated_at,version').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data ? { content: data.published, version: data.version, updatedAt: data.updated_at, source: 'cloud' } : null;
  }

  async function loadDraft() {
    const c = await init();
    const { data, error } = await c.from('store_content').select('draft,published,version,updated_at').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function saveDraft(content, note) {
    const c = await init();
    const { data, error } = await c.rpc('store_save_draft', { p_content: content, p_note: note || null });
    if (error) throw error;
    return data;
  }

  async function publishContent(content, note) {
    const c = await init();
    const { data, error } = await c.rpc('store_publish_content', { p_content: content, p_note: note || null });
    if (error) throw error;
    return data;
  }

  async function contentVersions() {
    const c = await init();
    const { data, error } = await c.from('store_content_versions').select('id,version,note,created_at,created_by').order('id', { ascending: false }).limit(20);
    if (error) throw error;
    return data || [];
  }

  async function listFestive() {
    const c = await maybe();
    if (!c) return null;
    const { data, error } = await c.from('store_festive_events').select('*').order('start_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function saveFestive(event) {
    const c = await init();
    const payload = {
      name: event.name,
      theme: event.theme,
      effect: event.effect,
      message: event.message,
      cta_text: event.cta && event.cta.text,
      cta_url: event.cta && event.cta.url,
      colors: event.colors,
      density: Number(event.density) || 45,
      priority: Number(event.priority) || 50,
      start_at: event.start,
      end_at: event.end,
      enabled: event.enabled !== false
    };
    const { data, error } = event.id && String(event.id).startsWith('db-')
      ? await c.from('store_festive_events').update(payload).eq('id', Number(String(event.id).slice(3))).select().maybeSingle()
      : await c.from('store_festive_events').insert(payload).select().maybeSingle();
    if (error) throw error;
    return data;
  }

  async function deleteFestive(id) {
    const c = await init();
    const { error } = await c.from('store_festive_events').delete().eq('id', Number(String(id).replace('db-', '')));
    if (error) throw error;
  }

  async function callFunction(name, body) {
    const c = await init();
    const { data, error } = await c.functions.invoke(name, { body });
    if (error) throw error;
    return data;
  }

  /* ----------------------------- Carrito en la nube ----------------------------- */
  async function listCart() {
    const c = await perhapsForData();
    if (!c) return [];
    const { data, error } = await c.from('store_cart_items').select('product_code,quantity').order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({ code: r.product_code, qty: Number(r.quantity) || 1 }));
  }

  async function pushCart(items) {
    const c = await perhapsForData();
    if (!c) return;
    // Reemplaza la fila propia; no duplica. RLS garantiza que solo el dueño toca sus líneas.
    const u = await user();
    const rows = (items || []).filter((i) => i && i.code && Number(i.qty) > 0).map((i) => ({ user_id: u.id, product_code: i.code, quantity: Math.max(1, Number(i.qty) || 1), updated_at: new Date().toISOString() }));
    const { error: delErr } = await c.from('store_cart_items').delete().eq('user_id', u.id);
    if (delErr) throw delErr;
    if (rows.length) { const { error } = await c.from('store_cart_items').insert(rows); if (error) throw error; }
  }

  async function clearCloudCart() { return pushCart([]); }

  async function syncFavorites(codes) {
    const c = await init();
    const u = await user();
    if (!u || !codes || !codes.length) return 0;
    const rows = codes.map((code) => ({ user_id: u.id, product_code: code }));
    const { error } = await c.from('store_favorites').upsert(rows, { onConflict: 'user_id,product_code' });
    if (error) throw error;
    return rows.length;
  }

  window.GalaxCloud = {
    configured, init, user, session, onAuthChange, signIn, signUp, signOut, signOutGlobal, signOutOthers,
    resendConfirmation, updateEmail, resetPassword, updatePassword, refreshSession,
    profile, updateProfile, normalizeProduct, catalogPage, allProducts,
    listFavorites, addFavorite, removeFavorite, syncFavorites,
    listCart, pushCart, clearCloudCart,
    createOrder, listOrders, getOrderByCode, mapOrder,
    isAdmin, adminStats, adminProducts, updateProduct, adminOrders, updateOrderStatus,
    loadContent, loadDraft, saveDraft, publishContent, contentVersions,
    listFestive, saveFestive, deleteFestive, callFunction
  };
})();
