/* GALAX PC REPAIR — panel de administración (Supabase + RLS) */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = {
    role: null,
    tab: 'resumen',
    stats: null,
    orders: [],
    products: [],
    content: null,
    draft: null,
    versions: [],
    festive: [],
    loading: false,
    error: null,
    search: ''
  };
  const cloudReady = () => Boolean(GALAX.cloud && GALAX.cloud.configured());
  const canAdmin = () => STATE_OK() && ['admin', 'editor'].includes(state.role);
  function STATE_OK() { return Boolean(state.role); }

  function gate(html) { $('#admin-root').innerHTML = '<div class="admin-gate">' + html + '</div>'; }
  function renderGate() {
    if (!cloudReady()) {
      gate('<div class="panel"><div class="panel-head"><div><span class="eyebrow">Acceso restringido</span><h1 style="margin-top:6px">Panel del equipo</h1></div><span class="badge badge-amber">Sin configurar</span></div>' +
        '<div class="info-box warn">' + GALAX.icon('alert', 'icon-sm') + '<div><strong>Supabase no está configurado en este despliegue.</strong> No existe un modo administrador local que pueda publicar cambios reales, y no se simula acceso ni permisos. El panel se activará cuando se configuren la URL y la clave pública de Supabase, se apliquen las migraciones y se asigne un rol <code>admin</code> o <code>editor</code> a la cuenta del equipo.</div></div>' +
        '<div class="divider"></div><h2 style="font-size:.95rem">Requisitos para habilitarlo</h2><ol class="small muted" style="padding-left:18px;line-height:1.9"><li>Configurar <code>assets/js/config.js</code> con la URL y la clave <code>anon</code> (nunca la service_role).</li><li>Aplicar las migraciones de <code>supabase/migrations</code>.</li><li>Asignar el rol al perfil del administrador desde SQL, con una cuenta real.</li><li>Verificar las políticas RLS y probar el panel con esa cuenta.</li></ol>' +
        '<p class="form-note">Los detalles están en <code>docs/SUPABASE_SETUP.md</code> y <code>docs/MASTER_PROGRESS.md</code>.</p><div class="flex flex-wrap mt-3"><a class="btn btn-primary" href="index.html">Volver a la tienda</a><a class="btn btn-ghost" href="cuenta.html">Ir a mi cuenta</a></div></div>');
      return;
    }
    if (!GALAX.cloudUser) {
      gate('<div class="panel"><div class="panel-head"><div><h1>Acceso del equipo</h1><p class="small muted">Inicia sesión con una cuenta autorizada.</p></div>' + GALAX.icon('lock') + '</div>' +
        '<div class="info-box">' + GALAX.icon('shield', 'icon-sm') + '<div>El panel valida tu sesión y tu rol con Supabase. No hay contraseñas ni accesos de prueba en el código.</div></div>' +
        '<div class="flex flex-wrap mt-3"><a class="btn btn-primary" href="cuenta.html">Ingresar a mi cuenta</a><a class="btn btn-ghost" href="index.html">Volver a la tienda</a></div></div>');
      return;
    }
    gate('<div class="panel"><div class="panel-head"><div><h1>Acceso denegado</h1><p class="small muted">Tu cuenta no tiene rol de administrador o editor.</p></div><span class="badge badge-red">Sin permiso</span></div>' +
      '<div class="info-box warn">' + GALAX.icon('alert', 'icon-sm') + '<div>La sesión es válida, pero las políticas RLS bloquean las operaciones de administración. Si necesitas acceso, el responsable del proyecto debe asignarte el rol correspondiente en Supabase. No intentes eludir RLS desde el navegador.</div></div>' +
      '<div class="flex flex-wrap mt-3"><a class="btn btn-ghost" href="cuenta.html">Volver a mi cuenta</a><a class="btn btn-ghost" href="index.html">Ir a la tienda</a></div></div>');
  }

  function nav() {
    const items = [
      ['resumen', 'home', 'Resumen'], ['pedidos', 'receipt', 'Pedidos'], ['productos', 'box', 'Productos'],
      ['contenido', 'edit', 'Contenido'], ['festivos', 'sparkles', 'Efectos festivos'], ['sistema', 'database', 'Sistema']
    ];
    return '<nav class="admin-nav" aria-label="Secciones de administración">' + items.map(([id, ic, label]) => '<button type="button" data-admin-tab="' + id + '" class="' + (state.tab === id ? 'is-active' : '') + '">' + GALAX.icon(ic) + label + '</button>').join('') + '</nav>';
  }
  function shell() {
    const name = (GALAX.cloudProfile && GALAX.cloudProfile.nombre_completo) || (GALAX.cloudUser && GALAX.cloudUser.email) || 'Equipo';
    $('#admin-root').innerHTML = '<div class="admin-head"><div><span class="eyebrow">Panel del equipo</span><h1>Administración</h1><p class="small muted">Sesión: ' + GALAX.esc(name) + ' · Rol: ' + GALAX.esc(state.role) + '</p></div><div class="flex flex-wrap"><span class="badge badge-green">' + GALAX.icon('shield', 'icon-sm') + 'RLS activo</span><a class="btn btn-ghost btn-sm" href="tienda.html">Ver tienda</a></div></div>' +
      '<div class="admin-shell">' + nav() + '<div class="admin-main" id="admin-main"><div class="page-loader"><span class="spinner"></span>Cargando panel…</div></div></div>';
    document.querySelectorAll('[data-admin-tab]').forEach((btn) => btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-admin-tab');
      document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderPanel();
    }));
    renderPanel();
  }
  function statCard(label, value, note) { return '<div class="stat-card"><span>' + GALAX.esc(label) + '</span><strong>' + GALAX.esc(value) + '</strong><small>' + GALAX.esc(note || '') + '</small></div>'; }
  function renderSummary(panel) {
    const s = state.stats || {};
    panel.innerHTML = '<div class="admin-head"><div><h2 style="font-size:1.1rem">Resumen</h2><p class="small muted">Datos de Supabase; no hay cifras inventadas.</p></div><button class="btn btn-ghost btn-sm" type="button" id="refresh-stats">' + GALAX.icon('refresh', 'icon-sm') + 'Actualizar</button></div>' +
      '<div class="stat-grid">' +
        statCard('Pedidos', s.orders_total != null ? s.orders_total : '—', s.orders_pending != null ? s.orders_pending + ' pendientes' : 'Cargando datos') +
        statCard('Ventas confirmadas', s.revenue_confirmed_pen != null ? GALAX.money(s.revenue_confirmed_pen) : '—', 'Solo pedidos confirmados/pagados') +
        statCard('Productos', s.products_total != null ? s.products_total : '—', s.products_published != null ? s.products_published + ' publicados' : '') +
        statCard('Stock bajo', s.low_stock != null ? s.low_stock : '—', '≤ 3 unidades') +
      '</div>' +
      '<div class="grid grid-2">' +
        '<div class="panel"><div class="panel-head"><div><h3 style="font-size:.92rem">Accesos rápidos</h3></div></div><div class="stack"><button class="btn btn-soft btn-sm" type="button" data-admin-tab="pedidos">Revisar pedidos</button><button class="btn btn-soft btn-sm" type="button" data-admin-tab="productos">Editar stock y precios</button><button class="btn btn-soft btn-sm" type="button" data-admin-tab="contenido">Editar contenido</button></div></div>' +
        '<div class="panel"><div class="panel-head"><div><h3 style="font-size:.92rem">Buenas prácticas</h3></div></div><ul class="small muted" style="padding-left:18px;line-height:1.8"><li>No cambies un pedido a pagado sin verificar la transferencia.</li><li>Los recibos PNG son internos; no son facturas SUNAT.</li><li>No publiques datos personales de clientes.</li><li>Revisa el borrador antes de publicar contenido.</li></ul></div>' +
      '</div>';
    panel.querySelector('#refresh-stats').addEventListener('click', loadStats);
    panel.querySelectorAll('[data-admin-tab]').forEach((btn) => btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-admin-tab');
      document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderPanel();
    }));
  }
  function statusOptions(current) {
    return ['pendiente', 'confirmado', 'pagado', 'enviado', 'entregado', 'cancelado', 'rechazado'].map((s) => '<option value="' + s + '" ' + (s === current ? 'selected' : '') + '>' + s + '</option>').join('');
  }
  function renderOrders(panel) {
    panel.innerHTML = '<div class="admin-head"><div><h2 style="font-size:1.1rem">Pedidos</h2><p class="small muted">Cambiar estado no cobra dinero; solo registra la realidad operativa.</p></div><div class="flex"><button class="btn btn-ghost btn-sm" type="button" id="export-orders">' + GALAX.icon('download', 'icon-sm') + 'CSV</button><button class="btn btn-ghost btn-sm" type="button" id="refresh-orders">' + GALAX.icon('refresh', 'icon-sm') + 'Actualizar</button></div></div>' +
      '<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Código</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th>Fecha</th></tr></thead><tbody id="orders-body">' +
      (state.orders.length ? state.orders.map((o) => '<tr><td><strong style="font-family:ui-monospace,Consolas,monospace;color:var(--gx-cyan)">' + GALAX.esc(o.code) + '</strong><br><span class="tiny dim">' + (o.store_order_items || []).length + ' líneas</span></td><td>' + GALAX.esc(o.customer_name || '—') + '<br><span class="tiny dim">' + GALAX.esc(o.customer_phone || o.customer_email || '') + '</span></td><td>' + GALAX.money(o.total) + '</td><td>' + GALAX.esc(o.payment_method || '—') + '</td><td><select class="select" data-order-status="' + o.id + '" aria-label="Estado del pedido ' + GALAX.esc(o.code) + '">' + statusOptions(o.status) + '</select></td><td class="tiny dim">' + GALAX.esc(GALAX.dateShort(o.created_at)) + '</td></tr>').join('') : '<tr><td colspan="6" class="muted">No hay pedidos en la nube todavía.</td></tr>') +
      '</tbody></table></div><p class="form-note mt-2">Los pedidos hechos en modo local no llegan a este panel hasta que el cliente los coordine o Supabase esté configurado. No se inventan pedidos.</p>';
    panel.querySelector('#refresh-orders').addEventListener('click', loadOrders);
    panel.querySelector('#export-orders').addEventListener('click', exportOrders);
    panel.querySelectorAll('[data-order-status]').forEach((select) => select.addEventListener('change', async () => {
      const id = select.getAttribute('data-order-status');
      const status = select.value;
      select.disabled = true;
      try {
        await GALAX.cloud.updateOrderStatus(Number(id), status);
        GALAX.toast('Estado actualizado a ' + status + '.', 'success');
        const order = state.orders.find((o) => String(o.id) === String(id));
        if (order) order.status = status;
      } catch (error) {
        GALAX.toast('No se pudo actualizar: ' + error.message, 'error');
      } finally { select.disabled = false; }
    }));
  }
  function exportOrders() {
    if (!state.orders.length) { GALAX.toast('No hay pedidos para exportar.', 'info'); return; }
    const rows = [['codigo', 'cliente', 'telefono', 'email', 'total', 'pago', 'estado', 'fecha']].concat(state.orders.map((o) => [o.code, o.customer_name, o.customer_phone, o.customer_email, o.total, o.payment_method, o.status, o.created_at]));
    const csv = rows.map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'GALAX-pedidos-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  function renderProducts(panel) {
    const list = state.products;
    panel.innerHTML = '<div class="admin-head"><div><h2 style="font-size:1.1rem">Productos</h2><p class="small muted">Edita precio, stock y publicación. Los cambios se guardan en Supabase.</p></div><div class="flex"><form class="drawer-search" id="product-search" style="margin:0;width:230px"><span>' + GALAX.icon('search', 'icon-sm') + '</span><input type="search" placeholder="Código, nombre, marca" aria-label="Buscar producto" value="' + GALAX.esc(state.search) + '"></form><button class="btn btn-ghost btn-sm" type="button" id="refresh-products">' + GALAX.icon('refresh', 'icon-sm') + 'Actualizar</button></div></div>' +
      '<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Código</th><th>Producto</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map((p) => '<tr><td>' + GALAX.esc(p.codigo) + '</td><td class="title-cell"><strong>' + GALAX.esc(p.nombre) + '</strong><span>' + GALAX.esc(p.marca || '') + ' · ' + GALAX.esc((p.categorias && p.categorias.nombre) || '') + '</span></td><td>' + GALAX.money(p.precio_venta) + '</td><td>' + GALAX.esc(p.stock) + '</td><td><span class="badge ' + (p.publicado ? 'badge-green' : '') + '">' + (p.publicado ? 'Publicado' : 'Oculto') + '</span>' + (p.destacado ? ' <span class="badge badge-cyan">Destacado</span>' : '') + '</td><td><div class="table-actions"><button type="button" data-edit-product="' + p.id + '" aria-label="Editar ' + GALAX.esc(p.codigo) + '" title="Editar">' + GALAX.icon('edit', 'icon-sm') + '</button></div></td></tr>').join('') : '<tr><td colspan="6" class="muted">No hay productos que coincidan. Aplica la migración del catálogo para cargar los 209 productos.</td></tr>') +
      '</tbody></table></div><p class="form-note mt-2">El catálogo público combina la tabla <code>productos</code> y la RPC <code>store_catalog_page</code>. Si un producto no existe en Supabase, la tienda usa el catálogo local publicado.</p>';
    panel.querySelector('#refresh-products').addEventListener('click', loadProducts);
    const form = panel.querySelector('#product-search');
    form.addEventListener('submit', (e) => { e.preventDefault(); state.search = form.querySelector('input').value.trim(); loadProducts(); });
    let t;
    form.querySelector('input').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.search = form.querySelector('input').value.trim(); loadProducts(); }, 400); });
    panel.querySelectorAll('[data-edit-product]').forEach((btn) => btn.addEventListener('click', () => {
      const product = state.products.find((p) => String(p.id) === btn.getAttribute('data-edit-product'));
      if (product) editProduct(product);
    }));
  }
  function editProduct(p) {
    GALAX.modal({
      title: 'Editar ' + p.codigo,
      body: '<div class="form-grid"><div class="field full"><label>Nombre</label><input class="input" id="ep-name" value="' + GALAX.esc(p.nombre) + '" readonly></div>' +
        '<div class="field"><label for="ep-price">Precio de venta (S/)</label><input class="input" id="ep-price" type="number" min="0" step="0.01" value="' + Number(p.precio_venta) + '"></div>' +
        '<div class="field"><label for="ep-stock">Stock</label><input class="input" id="ep-stock" type="number" min="0" step="1" value="' + Number(p.stock) + '"></div>' +
        '<div class="field"><label for="ep-published">Publicación</label><select class="select-full" id="ep-published"><option value="1" ' + (p.publicado ? 'selected' : '') + '>Publicado</option><option value="0" ' + (!p.publicado ? 'selected' : '') + '>Oculto</option></select></div>' +
        '<div class="field"><label for="ep-featured">Destacado</label><select class="select-full" id="ep-featured"><option value="0" ' + (!p.destacado ? 'selected' : '') + '>No</option><option value="1" ' + (p.destacado ? 'selected' : '') + '>Sí</option></select></div></div>',
      okText: 'Guardar cambios',
      cancelText: 'Cancelar',
      onOk: async (modalEl) => {
        const patch = {
          precio_venta: Number(modalEl.querySelector('#ep-price').value),
          stock: Math.max(0, parseInt(modalEl.querySelector('#ep-stock').value, 10) || 0),
          publicado: Number(modalEl.querySelector('#ep-published').value),
          destacado: Number(modalEl.querySelector('#ep-featured').value)
        };
        if (!Number.isFinite(patch.precio_venta) || patch.precio_venta < 0) { GALAX.toast('Precio inválido.', 'error'); return false; }
        await GALAX.cloud.updateProduct(p.id, patch);
        GALAX.toast('Producto actualizado.', 'success');
        loadProducts();
        return true;
      }
    });
  }
  function renderContent(panel) {
    const c = state.draft || state.content || {};
    panel.innerHTML = '<div class="admin-head"><div><h2 style="font-size:1.1rem">Contenido del sitio</h2><p class="small muted">Borrador, vista previa, publicación y versiones. Solo se publica lo que guardes explícitamente.</p></div><button class="btn btn-ghost btn-sm" type="button" id="refresh-content">' + GALAX.icon('refresh', 'icon-sm') + 'Recargar</button></div>' +
      '<div class="editor-layout">' +
        '<form id="content-form" class="panel stack">' +
          '<div class="grid grid-2"><div class="field"><label for="ct-title">Título del hero</label><input class="input" id="ct-title" value="' + GALAX.esc((c.home && c.home.title) || '') + '"></div><div class="field"><label for="ct-highlight">Texto destacado</label><input class="input" id="ct-highlight" value="' + GALAX.esc((c.home && c.home.highlight) || '') + '"></div></div>' +
          '<div class="field"><label for="ct-text">Texto del hero</label><textarea class="textarea" id="ct-text" rows="3">' + GALAX.esc((c.home && c.home.text) || '') + '</textarea></div>' +
          '<div class="grid grid-2"><div class="field"><label for="ct-primary">Botón principal</label><input class="input" id="ct-primary" value="' + GALAX.esc((c.home && c.home.primaryText) || '') + '"></div><div class="field"><label for="ct-primary-url">URL principal</label><input class="input" id="ct-primary-url" value="' + GALAX.esc((c.home && c.home.primaryUrl) || '') + '"></div></div>' +
          '<div class="field"><label for="ct-about">Sobre GALAX (párrafo)</label><textarea class="textarea" id="ct-about" rows="3">' + GALAX.esc((c.about && c.about.paragraphs && c.about.paragraphs[0]) || '') + '</textarea></div>' +
          '<div class="field"><label for="ct-payments">Nota de pagos</label><textarea class="textarea" id="ct-payments" rows="2">' + GALAX.esc((c.payments && c.payments.note) || '') + '</textarea></div>' +
          '<div class="field"><label for="ct-shipping">Nota de envíos</label><textarea class="textarea" id="ct-shipping" rows="2">' + GALAX.esc((c.shipping && c.shipping.note) || '') + '</textarea></div>' +
          '<div class="field"><label for="ct-receipt">Nota de recibo</label><textarea class="textarea" id="ct-receipt" rows="2">' + GALAX.esc((c.policies && c.policies.receipt) || '') + '</textarea></div>' +
          '<div class="field"><label for="ct-privacy">Privacidad</label><textarea class="textarea" id="ct-privacy" rows="3">' + GALAX.esc((c.policies && c.policies.privacy) || '') + '</textarea></div>' +
          '<div class="field"><label for="ct-note">Nota de la versión</label><input class="input" id="ct-note" maxlength="120" placeholder="Ej. Ajuste de texto de campaña"></div>' +
          '<div class="form-message" id="content-message" role="status"></div>' +
          '<div class="flex flex-wrap"><button class="btn btn-soft" type="submit" id="save-draft">' + GALAX.icon('save', 'icon-sm') + 'Guardar borrador</button><button class="btn btn-primary" type="button" id="publish-content">' + GALAX.icon('checkCircle', 'icon-sm') + 'Publicar</button><button class="btn btn-ghost" type="button" id="reset-content">Descartar cambios</button></div>' +
        '</form>' +
        '<div class="stack"><div class="editor-preview"><div class="editor-preview-head"><span>Vista previa (borrador)</span><span class="badge">No publicada</span></div><div class="editor-preview-body" id="content-preview"></div></div>' +
        '<div class="panel"><div class="panel-head"><div><h3 style="font-size:.9rem">Historial de versiones</h3><p class="small muted">Últimas publicaciones registradas.</p></div></div><div class="version-list" id="version-list">' + (state.versions.length ? state.versions.map((v) => '<div class="version-item"><strong>v' + GALAX.esc(v.version) + '</strong><span>' + GALAX.esc(v.note || 'Sin nota') + '</span><span>' + GALAX.esc(GALAX.dateShort(v.created_at)) + '</span></div>').join('') : '<p class="small muted">Aún no hay versiones publicadas.</p>') + '</div></div></div>' +
      '</div>';
    panel.querySelector('#refresh-content').addEventListener('click', loadContent);
    panel.querySelector('#save-draft').closest('form').addEventListener('input', previewContent);
    panel.querySelector('#save-draft').closest('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const content = collectContent();
      const msg = panel.querySelector('#content-message');
      try {
        await GALAX.cloud.saveDraft(content, panel.querySelector('#ct-note').value.trim());
        msg.className = 'form-message is-ok'; msg.textContent = 'Borrador guardado. Aún no es visible en la tienda.';
        state.draft = content;
      } catch (error) { msg.className = 'form-message is-error'; msg.textContent = 'No se pudo guardar el borrador: ' + error.message; }
    });
    panel.querySelector('#publish-content').addEventListener('click', async () => {
      const content = collectContent();
      const msg = panel.querySelector('#content-message');
      const ok = await GALAX.modal({ title: '¿Publicar contenido?', body: '<p>Los cambios serán visibles en la tienda pública. Se guardará una versión en el historial.</p>', okText: 'Publicar ahora' });
      if (!ok) return;
      try {
        await GALAX.cloud.publishContent(content, panel.querySelector('#ct-note').value.trim());
        msg.className = 'form-message is-ok'; msg.textContent = 'Contenido publicado y versionado.';
        state.draft = content;
        await loadContent();
      } catch (error) { msg.className = 'form-message is-error'; msg.textContent = 'No se pudo publicar: ' + error.message; }
    });
    panel.querySelector('#reset-content').addEventListener('click', loadContent);
    previewContent();
    bindPreview();
  }
  function collectContent() {
    const base = JSON.parse(JSON.stringify(state.content || state.draft || {}));
    base.home = base.home || {};
    base.home.title = $('#ct-title').value;
    base.home.highlight = $('#ct-highlight').value;
    base.home.text = $('#ct-text').value;
    base.home.primaryText = $('#ct-primary').value;
    base.home.primaryUrl = $('#ct-primary-url').value;
    base.about = base.about || {};
    base.about.paragraphs = base.about.paragraphs || [];
    base.about.paragraphs[0] = $('#ct-about').value;
    base.payments = base.payments || {};
    base.payments.note = $('#ct-payments').value;
    base.shipping = base.shipping || {};
    base.shipping.note = $('#ct-shipping').value;
    base.policies = base.policies || {};
    base.policies.receipt = $('#ct-receipt').value;
    base.policies.privacy = $('#ct-privacy').value;
    base.version = new Date().toISOString().slice(0, 10);
    return base;
  }
  function previewContent() {
    const host = $('#content-preview');
    if (!host) return;
    const title = $('#ct-title') ? $('#ct-title').value : '';
    const highlight = $('#ct-highlight') ? $('#ct-highlight').value : '';
    const text = $('#ct-text') ? $('#ct-text').value : '';
    host.innerHTML = '<div style="border:1px solid var(--gx-line);border-radius:12px;padding:18px;background:linear-gradient(160deg,rgba(18,33,58,.9),rgba(7,13,27,.9))"><span class="eyebrow">Vista previa</span><h2 style="margin:9px 0 5px;font-size:1.5rem">' + GALAX.esc(title) + ' <span class="grad" style="background:linear-gradient(100deg,var(--gx-cyan),#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent">' + GALAX.esc(highlight) + '</span></h2><p class="small muted" style="line-height:1.65">' + GALAX.esc(text) + '</p><div class="flex flex-wrap mt-2"><span class="btn btn-primary btn-sm">' + GALAX.esc($('#ct-primary') ? $('#ct-primary').value : 'Botón') + '</span></div></div>';
  }
  function bindPreview() {
    const form = $('#content-form');
    if (!form) return;
    form.querySelectorAll('input,textarea').forEach((input) => input.addEventListener('input', previewContent));
  }
  function renderFestive(panel) {
    panel.innerHTML = '<div class="admin-head"><div><h2 style="font-size:1.1rem">Efectos festivos</h2><p class="small muted">Zona America/Lima. Los efectos son decorativos: no alteran precios, stock ni pedidos.</p></div><div class="flex"><button class="btn btn-ghost btn-sm" type="button" id="refresh-festive">' + GALAX.icon('refresh', 'icon-sm') + 'Actualizar</button><button class="btn btn-primary btn-sm" type="button" id="new-festive">' + GALAX.icon('plus', 'icon-sm') + 'Nuevo evento</button></div></div>' +
      '<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Evento</th><th>Efecto</th><th>Inicio</th><th>Fin</th><th>Prioridad</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (state.festive.length ? state.festive.map((e) => '<tr><td class="title-cell"><strong>' + GALAX.esc(e.name) + '</strong><span>' + GALAX.esc(e.theme || '') + '</span></td><td>' + GALAX.esc(e.effect) + '</td><td class="tiny">' + GALAX.esc(formatLocal(e.start || e.start_at)) + '</td><td class="tiny">' + GALAX.esc(formatLocal(e.end || e.end_at)) + '</td><td>' + GALAX.esc(e.priority || 0) + '</td><td><span class="badge ' + (e.enabled !== false ? 'badge-green' : '') + '">' + (e.enabled !== false ? 'Activo' : 'Pausado') + '</span></td><td><div class="table-actions"><button type="button" data-preview-festive="' + GALAX.esc(e.id) + '" title="Vista previa" aria-label="Vista previa de ' + GALAX.esc(e.name) + '">' + GALAX.icon('eye', 'icon-sm') + '</button><button type="button" data-edit-festive="' + GALAX.esc(e.id) + '" title="Editar" aria-label="Editar ' + GALAX.esc(e.name) + '">' + GALAX.icon('edit', 'icon-sm') + '</button><button type="button" data-delete-festive="' + GALAX.esc(e.id) + '" title="Eliminar" aria-label="Eliminar ' + GALAX.esc(e.name) + '">' + GALAX.icon('trash', 'icon-sm') + '</button></div></td></tr>').join('') : '<tr><td colspan="7" class="muted">No hay eventos en la base. Puedes crear uno o aplicar la programación local en <code>assets/data/festive.json</code>.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="info-box mt-2">' + GALAX.icon('info', 'icon-sm') + '<div>La vista previa es decorativa y se detiene al cerrar o recargar. Los eventos se activan por fecha y prioridad; si hay varios, se muestra el de mayor prioridad. Respeta la preferencia de movimiento reducido del visitante.</div></div>';
    panel.querySelector('#refresh-festive').addEventListener('click', loadFestive);
    panel.querySelector('#new-festive').addEventListener('click', () => editFestive(null));
    panel.querySelectorAll('[data-edit-festive]').forEach((btn) => btn.addEventListener('click', () => editFestive(state.festive.find((e) => String(e.id) === btn.getAttribute('data-edit-festive')))));
    panel.querySelectorAll('[data-delete-festive]').forEach((btn) => btn.addEventListener('click', async () => {
      const event = state.festive.find((e) => String(e.id) === btn.getAttribute('data-delete-festive'));
      if (!event) return;
      const ok = await GALAX.modal({ title: '¿Eliminar evento?', body: '<p>Se eliminará <strong>' + GALAX.esc(event.name) + '</strong> de Supabase. No afecta productos ni pedidos.</p>', okText: 'Eliminar' });
      if (!ok) return;
      try { await GALAX.cloud.deleteFestive(event.id); GALAX.toast('Evento eliminado.', 'success'); loadFestive(); }
      catch (error) { GALAX.toast(error.message, 'error'); }
    }));
    panel.querySelectorAll('[data-preview-festive]').forEach((btn) => btn.addEventListener('click', () => {
      const event = state.festive.find((e) => String(e.id) === btn.getAttribute('data-preview-festive'));
      if (!event) return;
      if (window.GalaxFestive) GalaxFestive.preview(normalizeFestive(event));
      GALAX.toast('Vista previa de ' + event.name + '. Se detiene en unos segundos.', 'info');
      setTimeout(() => { if (window.GalaxFestive) GalaxFestive.stopPreview(); }, 5200);
    }));
  }
  function normalizeFestive(e) {
    return {
      id: e.id, name: e.name, theme: e.theme, effect: e.effect, message: e.message,
      cta: { text: e.cta_text || e.cta && e.cta.text, url: e.cta_url || e.cta && e.cta.url },
      colors: Array.isArray(e.colors) ? e.colors : ['#22d3ee', '#8b5cf6', '#ffffff'],
      density: e.density, priority: e.priority, start: e.start_at || e.start, end: e.end_at || e.end, enabled: e.enabled
    };
  }
  function formatLocal(value) {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(value)); }
    catch { return String(value); }
  }
  function editFestive(event) {
    const e = event || { name: '', theme: '', effect: 'confetti', message: '', cta_text: '', cta_url: 'tienda.html', colors: ['#22d3ee', '#8b5cf6', '#ffffff'], density: 45, priority: 50, start_at: '', end_at: '', enabled: true };
    const toLocalInput = (v) => { if (!v) return ''; const d = new Date(v); const pad = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    GALAX.modal({
      title: event ? 'Editar evento' : 'Nuevo evento festivo',
      okText: 'Guardar evento',
      body: '<div class="form-grid"><div class="field full"><label for="fe-name">Nombre</label><input class="input" id="fe-name" maxlength="80" value="' + GALAX.esc(e.name) + '"></div>' +
        '<div class="field"><label for="fe-theme">Tema</label><input class="input" id="fe-theme" maxlength="60" value="' + GALAX.esc(e.theme || '') + '"></div>' +
        '<div class="field"><label for="fe-effect">Efecto</label><select class="select-full" id="fe-effect">' + ['confetti', 'hearts', 'petals', 'snow', 'embers', 'stars', 'spark', 'ribbons'].map((x) => '<option ' + (x === e.effect ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        '<div class="field full"><label for="fe-message">Mensaje</label><input class="input" id="fe-message" maxlength="180" value="' + GALAX.esc(e.message || '') + '"></div>' +
        '<div class="field"><label for="fe-cta-text">Texto del botón</label><input class="input" id="fe-cta-text" maxlength="40" value="' + GALAX.esc(e.cta_text || '') + '"></div>' +
        '<div class="field"><label for="fe-cta-url">URL del botón</label><input class="input" id="fe-cta-url" maxlength="160" value="' + GALAX.esc(e.cta_url || 'tienda.html') + '"></div>' +
        '<div class="field"><label for="fe-start">Inicio (America/Lima)</label><input class="input" id="fe-start" type="datetime-local" value="' + GALAX.esc(toLocalInput(e.start_at)) + '"></div>' +
        '<div class="field"><label for="fe-end">Fin (America/Lima)</label><input class="input" id="fe-end" type="datetime-local" value="' + GALAX.esc(toLocalInput(e.end_at)) + '"></div>' +
        '<div class="field"><label for="fe-density">Densidad (12–100)</label><input class="input" id="fe-density" type="number" min="12" max="100" value="' + Number(e.density || 45) + '"></div>' +
        '<div class="field"><label for="fe-priority">Prioridad (0–100)</label><input class="input" id="fe-priority" type="number" min="0" max="100" value="' + Number(e.priority || 50) + '"></div>' +
        '<div class="field"><label for="fe-colors">Colores (separados por coma)</label><input class="input" id="fe-colors" value="' + GALAX.esc((e.colors || []).join(', ')) + '"></div>' +
        '<div class="field"><label for="fe-enabled">Estado</label><select class="select-full" id="fe-enabled"><option value="1" ' + (e.enabled !== false ? 'selected' : '') + '>Activo</option><option value="0" ' + (e.enabled === false ? 'selected' : '') + '>Pausado</option></select></div></div>',
      cancelText: 'Cancelar',
      onOk: async (modalEl) => {
        const form = {
          id: event ? event.id : null,
          name: modalEl.querySelector('#fe-name').value.trim(),
          theme: modalEl.querySelector('#fe-theme').value.trim(),
          effect: modalEl.querySelector('#fe-effect').value,
          message: modalEl.querySelector('#fe-message').value.trim(),
          cta: { text: modalEl.querySelector('#fe-cta-text').value.trim(), url: modalEl.querySelector('#fe-cta-url').value.trim() || 'tienda.html' },
          colors: modalEl.querySelector('#fe-colors').value.split(',').map((x) => x.trim()).filter(Boolean),
          density: Number(modalEl.querySelector('#fe-density').value),
          priority: Number(modalEl.querySelector('#fe-priority').value),
          start: modalEl.querySelector('#fe-start').value ? new Date(modalEl.querySelector('#fe-start').value).toISOString() : null,
          end: modalEl.querySelector('#fe-end').value ? new Date(modalEl.querySelector('#fe-end').value).toISOString() : null,
          enabled: modalEl.querySelector('#fe-enabled').value === '1'
        };
        if (form.name.length < 3) { GALAX.toast('Escribe un nombre para el evento.', 'error'); return false; }
        if (!form.start || !form.end || new Date(form.end) <= new Date(form.start)) { GALAX.toast('Indica fechas válidas: el fin debe ser posterior al inicio.', 'error'); return false; }
        if (!form.colors.length) form.colors = ['#22d3ee', '#8b5cf6', '#ffffff'];
        await GALAX.cloud.saveFestive(form);
        GALAX.toast('Evento guardado en Supabase.', 'success');
        loadFestive();
        return true;
      }
    });
  }
  function renderSystem(panel) {
    const host = (GALAX.config.supabase.url || '').replace(/^https:\/\//, '').replace(/\/$/, '');
    panel.innerHTML = '<div class="admin-head"><div><h2 style="font-size:1.1rem">Sistema</h2><p class="small muted">Estado visible del despliegue. No se muestran claves privadas.</p></div></div>' +
      '<div class="grid grid-2">' +
        '<div class="panel"><h3 style="font-size:.9rem">Conexiones</h3><div class="summary-list mt-2"><div class="summary-line"><span>Supabase</span><span class="badge badge-green">Configurado</span></div><div class="summary-line"><span>Proyecto</span><span>' + GALAX.esc(host || '—') + '</span></div><div class="summary-line"><span>Sesión</span><span>' + (GALAX.cloudUser ? 'Activa' : 'Sin sesión') + '</span></div><div class="summary-line"><span>Rol</span><span>' + GALAX.esc(state.role || '—') + '</span></div><div class="summary-line"><span>Pagos tarjeta</span><span class="badge ' + (GALAX.config.culqi.publicKey ? 'badge-amber' : '') + '">' + (GALAX.config.culqi.publicKey ? 'Clave pública presente; validar servidor' : 'No habilitados') + '</span></div></div></div>' +
        '<div class="panel"><h3 style="font-size:.9rem">Verificaciones recomendadas</h3><ul class="small muted" style="padding-left:18px;line-height:1.9"><li>RLS probado con una cuenta sin rol.</li><li>Edge Functions desplegadas y secretos fuera del frontend.</li><li>Webhook de pagos con firma verificada.</li><li>Correo de confirmación de Supabase configurado.</li><li>Recibos generados solo para el dueño del pedido.</li></ul></div>' +
      '</div>' +
      '<div class="info-box warn mt-2">' + GALAX.icon('shield', 'icon-sm') + '<div><strong>Seguridad:</strong> el frontend solo usa la clave <code>anon</code>. La service_role, la clave secreta de Culqi y los tokens de Gemma deben vivir en variables de entorno de Edge Functions. Nunca los agregues a <code>config.js</code> ni a este repositorio.</div></div>' +
      '<div class="panel mt-2"><h3 style="font-size:.9rem">Documentación</h3><p class="small muted">Configuración de Supabase, migraciones, pagos y limitaciones en <code>docs/SUPABASE_SETUP.md</code>, <code>docs/PAGOS.md</code> y <code>docs/MASTER_PROGRESS.md</code>.</p></div>';
  }

  async function loadStats() {
    if (!canAdmin()) return;
    try { state.stats = await GALAX.cloud.adminStats(); renderPanel(); }
    catch (error) { state.error = error.message; GALAX.toast('No se pudieron cargar las métricas: ' + error.message, 'error'); }
  }
  async function loadOrders() {
    if (!canAdmin()) return;
    state.loading = true;
    try { state.orders = await GALAX.cloud.adminOrders(); state.error = null; }
    catch (error) { GALAX.toast('No se pudieron cargar los pedidos: ' + error.message, 'error'); }
    finally { state.loading = false; renderPanel(); }
  }
  async function loadProducts() {
    if (!canAdmin()) return;
    state.loading = true;
    try { state.products = await GALAX.cloud.adminProducts(state.search); state.error = null; }
    catch (error) { GALAX.toast('No se pudieron cargar los productos: ' + error.message, 'error'); }
    finally { state.loading = false; renderPanel(); }
  }
  async function loadContent() {
    if (!canAdmin()) return;
    try {
      const draft = await GALAX.cloud.loadDraft();
      state.content = (GALAX.content ? JSON.parse(JSON.stringify(GALAX.content)) : {});
      state.draft = draft && draft.draft ? draft.draft : null;
      state.versions = await GALAX.cloud.contentVersions();
      renderPanel();
    } catch (error) { GALAX.toast('No se pudo cargar el contenido: ' + error.message, 'error'); }
  }
  async function loadFestive() {
    if (!canAdmin()) return;
    try { const list = await GALAX.cloud.listFestive(); state.festive = list || []; renderPanel(); }
    catch (error) { GALAX.toast('No se pudieron cargar los eventos: ' + error.message, 'error'); }
  }
  function renderPanel() {
    const panel = $('#admin-main');
    if (!panel) return;
    if (state.tab === 'pedidos') renderOrders(panel);
    else if (state.tab === 'productos') renderProducts(panel);
    else if (state.tab === 'contenido') renderContent(panel);
    else if (state.tab === 'festivos') renderFestive(panel);
    else if (state.tab === 'sistema') renderSystem(panel);
    else renderSummary(panel);
  }
  async function init() {
    await GALAX.ready();
    if (!cloudReady()) { renderGate(); return; }
    try { await GALAX.refreshAuth(); } catch {}
    if (!GALAX.cloudUser) { renderGate(); return; }
    try {
      const profile = GALAX.cloudProfile || await GALAX.cloud.profile();
      state.role = profile && profile.role;
    } catch (error) { state.role = null; }
    if (!['admin', 'editor'].includes(state.role)) { renderGate(); return; }
    shell();
    await Promise.allSettled([loadStats(), loadOrders(), loadProducts(), loadContent(), loadFestive()]);
  }
  document.addEventListener('galax:auth', () => { if (cloudReady()) init(); });
  init();
})();
