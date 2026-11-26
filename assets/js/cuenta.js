/* GALAX PC REPAIR — cuenta, autenticación Supabase y pedidos */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = {
    tab: location.hash === '#pedidos' ? 'pedidos' : location.hash === '#seguridad' ? 'seguridad' : 'perfil',
    authTab: new URLSearchParams(location.search).get('modo') === 'registro' ? 'registro' : 'login',
    cloudOrders: [],
    ordersLoading: false,
    ordersError: null,
    busy: false,
    recovery: new URLSearchParams(location.search).get('recuperar') === '1'
  };
  const cloudReady = () => Boolean(GALAX.cloud && GALAX.cloud.configured());

  function badgeForStatus(status) {
    const s = String(status || 'pendiente').toLowerCase();
    const map = { pendiente: 'badge-amber', pagado: 'badge-green', confirmado: 'badge-green', enviado: 'badge-cyan', entregado: 'badge-green', cancelado: 'badge-red', rechazado: 'badge-red' };
    return '<span class="badge ' + (map[s] || '') + '">' + GALAX.esc(s) + '</span>';
  }
  function mergeOrders() {
    const map = new Map();
    (GALAX.state.orders || []).forEach((o) => map.set(o.code, o));
    (state.cloudOrders || []).forEach((o) => map.set(o.code, Object.assign({}, map.get(o.code) || {}, o, { source: 'cloud' })));
    return Array.from(map.values()).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));
  }
  function orderCard(order) {
    const items = order.items || [];
    const customer = order.customer || {};
    const payment = order.paymentLabel || ({ yape: 'Yape', plin: 'Plin', transfer: 'Transferencia', card: 'Tarjeta' }[order.payment] || order.payment || 'Por coordinar');
    return '<article class="order-card" data-order="' + GALAX.esc(order.code) + '">' +
      '<div class="order-card-head"><strong>' + GALAX.esc(order.code) + '</strong>' + badgeForStatus(order.status) + '</div>' +
      '<div class="order-card-meta"><span>' + GALAX.esc(GALAX.dateShort(order.date || order.created_at)) + '</span><span>' + items.reduce((n, i) => n + Number(i.qty || 1), 0) + ' productos</span><span>Pago: ' + GALAX.esc(payment) + '</span><span>' + GALAX.esc(order.source === 'cloud' ? 'Supabase' : 'Este dispositivo') + '</span></div>' +
      '<div class="order-card-meta"><span>Total referencial: <strong style="color:var(--gx-text)">' + GALAX.money(order.total) + '</strong></span>' + (customer.name ? '<span>Cliente: ' + GALAX.esc(customer.name) + '</span>' : '') + '</div>' +
      '<div class="order-card-actions">' +
        '<button class="btn btn-soft btn-sm" type="button" data-receipt="' + GALAX.esc(order.code) + '">' + GALAX.icon('download', 'icon-sm') + 'Recibo PNG</button>' +
        '<a class="btn btn-ghost btn-sm" href="' + GALAX.esc(GALAX.whatsappUrl('Hola, quiero coordinar el pedido ' + order.code + ' por ' + GALAX.money(order.total) + '.')) + '" target="_blank" rel="noopener">' + GALAX.icon('whatsapp', 'icon-sm') + 'Coordinar</a>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-order-toggle="' + GALAX.esc(order.code) + '" aria-expanded="false">Ver detalle</button>' +
      '</div>' +
      '<div id="order-detail-' + GALAX.esc(order.code) + '" hidden style="margin-top:9px;border-top:1px solid var(--gx-line);padding-top:8px">' +
        items.map((i) => '<div class="summary-line"><span>' + GALAX.esc(i.name || i.product_name) + ' × ' + i.qty + '</span><span>' + GALAX.money(i.subtotal != null ? i.subtotal : i.price * i.qty) + '</span></div>').join('') +
        '<div class="summary-line"><span>Envío</span><span>' + GALAX.money(order.shippingCost != null ? order.shippingCost : order.shipping_cost) + '</span></div>' +
        '<div class="summary-line total"><span>Total</span><span>' + GALAX.money(order.total) + '</span></div>' +
        (order.notes ? '<p class="form-note" style="margin-top:6px">Notas: ' + GALAX.esc(order.notes) + '</p>' : '') +
        (order.cloudError ? '<p class="form-note" style="margin-top:6px;color:var(--gx-amber)">' + GALAX.esc(order.cloudError) + '</p>' : '') +
      '</div></article>';
  }
  function ordersHTML() {
    const orders = mergeOrders();
    if (state.ordersLoading) return '<div class="page-loader"><span class="spinner"></span>Cargando pedidos…</div>';
    if (!orders.length) return '<div class="empty-state">' + GALAX.icon('receipt') + '<h3>Aún no hay pedidos</h3><p>Cuando completes un pedido, aparecerá aquí con su recibo descargable.</p><a class="btn btn-primary btn-sm" href="tienda.html">Ver catálogo</a></div>';
    return '<div class="orders-list">' + orders.map(orderCard).join('') + '</div>' +
      '<p class="form-note mt-2">Los pedidos locales se guardan en este navegador. Los pedidos con Supabase solo se muestran a la cuenta dueña. El recibo PNG es un comprobante interno, no una factura SUNAT.</p>';
  }
  function bindOrderActions(scope) {
    scope.querySelectorAll('[data-order-toggle]').forEach((btn) => btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-order-toggle');
      const detail = document.getElementById('order-detail-' + code);
      if (!detail) return;
      const open = detail.hidden;
      detail.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Ocultar detalle' : 'Ver detalle';
    }));
    scope.querySelectorAll('[data-receipt]').forEach((btn) => btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-receipt');
      const order = mergeOrders().find((o) => o.code === code);
      if (!order) return;
      btn.disabled = true;
      try { await GalaxReceipt.download(order); } catch (error) { GALAX.toast(error.message, 'error'); } finally { btn.disabled = false; }
    }));
  }
  function localProfileForm() {
    const p = GALAX.localProfile();
    const u = GALAX.cloudUser;
    return '<form id="profile-form" class="form-grid">' +
      '<div class="field"><label for="pf-name">Nombre y apellidos</label><input class="input" id="pf-name" name="name" autocomplete="name" maxlength="90" value="' + GALAX.esc(p.name || '') + '"></div>' +
      '<div class="field"><label for="pf-phone">WhatsApp / teléfono</label><input class="input" id="pf-phone" name="phone" type="tel" autocomplete="tel" maxlength="24" value="' + GALAX.esc(p.phone || '') + '"></div>' +
      '<div class="field"><label for="pf-email">Correo</label><input class="input" id="pf-email" name="email" type="email" autocomplete="email" maxlength="120" value="' + GALAX.esc((u && u.email) || p.email || '') + '" ' + (u ? 'readonly' : '') + '><p class="hint">' + (u ? 'El correo se administra desde tu cuenta Supabase.' : 'Solo se guarda en este dispositivo.') + '</p></div>' +
      '<div class="field"><label for="pf-address">Dirección de entrega</label><input class="input" id="pf-address" name="address" autocomplete="street-address" maxlength="160" value="' + GALAX.esc(p.address || '') + '"></div>' +
      '<div class="full form-message" id="profile-message" role="status"></div>' +
      '<div class="full flex flex-wrap"><button class="btn btn-primary" type="submit" id="profile-save">' + GALAX.icon('save', 'icon-sm') + 'Guardar datos</button>' + (u ? '<span class="badge badge-green">Cuenta Supabase conectada</span>' : '<span class="badge">Perfil de este dispositivo</span>') + '</div>' +
      '</form>';
  }
  function bindProfileForm(scope) {
    const form = scope.querySelector('#profile-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const msg = $('#profile-message');
      msg.className = 'full form-message';
      const data = {
        name: $('#pf-name').value.trim(),
        phone: $('#pf-phone').value.trim(),
        address: $('#pf-address').value.trim(),
        email: $('#pf-email').value.trim()
      };
      if (data.name.length < 2 && (data.phone || data.address)) { msg.className = 'full form-message is-error'; msg.textContent = 'Escribe tu nombre para guardar los datos.'; return; }
      try {
        GALAX.saveLocalProfile(data);
        if (cloudReady() && GALAX.cloudUser) {
          await GALAX.cloud.updateProfile({ name: data.name, phone: data.phone, address: data.address });
          await GALAX.refreshAuth();
          msg.className = 'full form-message is-ok';
          msg.textContent = 'Perfil actualizado en tu cuenta y en este dispositivo.';
        } else {
          msg.className = 'full form-message is-ok';
          msg.textContent = 'Datos guardados en este dispositivo.';
        }
      } catch (error) {
        msg.className = 'full form-message is-error';
        msg.textContent = 'No se pudo guardar en la nube: ' + error.message + '. Los datos quedaron guardados en este dispositivo.';
      }
    });
  }
  function renderLocalDashboard(showAuthNotice) {
    const nav = [
      ['perfil', 'user', 'Mis datos'],
      ['pedidos', 'receipt', 'Mis pedidos'],
      ['favoritos', 'heart', 'Favoritos'],
      ['seguridad', 'settings', 'Privacidad']
    ];
    const root = $('#account-root');
    root.innerHTML = (showAuthNotice ? '<div class="info-box warn" style="margin-bottom:16px">' + GALAX.icon('alert', 'icon-sm') + '<div><strong>Cuentas en la nube no configuradas.</strong> Este despliegue funciona con datos locales porque faltan las credenciales públicas de Supabase. El perfil y los pedidos se guardan solo en este navegador. No se simula un inicio de sesión.</div></div>' : '') +
      '<div class="account-grid" style="padding-bottom:50px">' +
        '<nav class="account-nav" aria-label="Secciones de la cuenta">' + nav.map(([id, ic, label]) => '<button type="button" data-account-tab="' + id + '" class="' + (state.tab === id ? 'is-active' : '') + '">' + GALAX.icon(ic) + label + '</button>').join('') + '</nav>' +
        '<section class="panel account-panel" id="account-panel"></section>' +
      '</div>';
    bindTabs();
    renderLocalPanel();
  }
  function renderLocalPanel() {
    const panel = $('#account-panel');
    if (!panel) return;
    if (state.tab === 'pedidos') {
      panel.innerHTML = '<div class="panel-head"><div><h2 style="font-size:1.05rem">Mis pedidos</h2><p class="small muted">Pedidos guardados en este dispositivo.</p></div><button class="btn btn-ghost btn-sm" type="button" id="reload-orders" ' + (cloudReady() ? '' : 'hidden') + '>' + GALAX.icon('refresh', 'icon-sm') + 'Actualizar</button></div>' + ordersHTML();
      bindOrderActions(panel);
      const reload = panel.querySelector('#reload-orders');
      if (reload) reload.addEventListener('click', loadCloudOrders);
    } else if (state.tab === 'favoritos') {
      panel.innerHTML = '<div class="panel-head"><div><h2 style="font-size:1.05rem">Favoritos</h2><p class="small muted">Equipos que guardaste para revisar después.</p></div><a class="btn btn-soft btn-sm" href="favoritos.html">Ver lista</a></div>' +
        (GALAX.state.favorites.length ? '<div class="summary-list">' + GALAX.state.favorites.map((code) => { const p = GALAX.getProduct(code); return p ? '<div class="summary-line"><span>' + GALAX.esc(p.name) + '</span><span>' + GALAX.money(p.price) + '</span></div>' : ''; }).join('') + '</div>' : '<div class="empty-state">' + GALAX.icon('heart') + '<p>Aún no has guardado favoritos.</p><a class="btn btn-primary btn-sm" href="tienda.html">Ver catálogo</a></div>');
    } else if (state.tab === 'seguridad') {
      panel.innerHTML = '<div class="panel-head"><div><h2 style="font-size:1.05rem">Privacidad y datos</h2></div></div>' +
        '<div class="stack">' +
          '<div class="info-box">' + GALAX.icon('shield', 'icon-sm') + '<div>El perfil y los pedidos locales viven en el almacenamiento de este navegador. Puedes borrarlos cuando quieras; eso no elimina pedidos ya coordinados por WhatsApp.</div></div>' +
          '<div class="flex flex-wrap"><button class="btn btn-ghost btn-sm" type="button" id="clear-airi">Borrar historial de Airi</button><button class="btn btn-danger btn-sm" type="button" id="clear-local-data">Borrar datos locales</button></div>' +
        '</div>';
      const airi = panel.querySelector('#clear-airi');
      if (airi) airi.addEventListener('click', () => { try { localStorage.removeItem('galax_airi_history_v1'); } catch {} GALAX.toast('Historial local de Airi borrado.', 'info'); });
      const clear = panel.querySelector('#clear-local-data');
      if (clear) clear.addEventListener('click', () => {
        GALAX.modal({ title: '¿Borrar datos locales?', body: '<p>Se borrarán el perfil, los favoritos, el carrito y los pedidos guardados en este navegador. No se puede deshacer.</p>', okText: 'Sí, borrar' }).then((yes) => {
          if (!yes) return;
          ['galax_cart_v2', 'galax_favorites_v2', 'galax_local_profile_v1', 'galax_local_orders_v1', 'galax_airi_history_v1'].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
          location.reload();
        });
      });
    } else {
      panel.innerHTML = '<div class="panel-head"><div><h2 style="font-size:1.05rem">Mis datos</h2><p class="small muted">Se usan para prellenar el checkout y coordinar tus pedidos.</p></div></div>' + localProfileForm();
      bindProfileForm(panel);
    }
  }
  function bindTabs() {
    document.querySelectorAll('[data-account-tab]').forEach((btn) => btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-account-tab');
      document.querySelectorAll('[data-account-tab]').forEach((b) => b.classList.toggle('is-active', b === btn));
      if (cloudReady() && GALAX.cloudUser) renderSignedInPanel(); else renderLocalPanel();
      history.replaceState(null, '', 'cuenta.html' + (state.tab !== 'perfil' ? '#' + state.tab : ''));
    }));
  }
  function renderAuth() {
    const root = $('#account-root');
    root.innerHTML = '<div class="auth-wrap">' +
      (state.recovery ? recoveryHTML() : authHTML()) +
      '</div>' +
      (mergeOrders().length ? '<div class="panel" style="max-width:680px;margin:0 auto 50px"><div class="panel-head"><div><h2 style="font-size:1.05rem">Pedidos guardados en este dispositivo</h2><p class="small muted">Disponibles aunque aún no inicies sesión.</p></div></div>' + ordersHTML() + '</div>' : '');
    bindAuth();
    bindOrderActions(root);
    const localProfile = root.querySelector('#show-local-profile');
    if (localProfile) localProfile.addEventListener('click', () => { state.tab = 'perfil'; renderLocalDashboard(false); });
  }
  function authHTML() {
    const isLogin = state.authTab !== 'registro';
    return '<div class="auth-card">' +
      '<h1>Tu cuenta GALAX</h1><p>Inicia sesión para sincronizar favoritos y ver tus pedidos en la nube. También puedes comprar sin cuenta y coordinar por WhatsApp.</p>' +
      '<div class="auth-tabs" role="tablist" aria-label="Acceso a la cuenta"><button type="button" data-auth-tab="login" class="' + (isLogin ? 'is-active' : '') + '">Ingresar</button><button type="button" data-auth-tab="registro" class="' + (!isLogin ? 'is-active' : '') + '">Crear cuenta</button><button type="button" data-auth-tab="recuperar" class="' + (state.authTab === 'recuperar' ? 'is-active' : '') + '">Recuperar</button></div>' +
      (state.authTab === 'recuperar' ? recoverForm() : state.authTab === 'registro' ? registerForm() : loginForm()) +
      '<div class="divider-text">o</div>' +
      '<button class="btn btn-ghost btn-block" type="button" id="show-local-profile">Usar perfil en este dispositivo</button>' +
      '<p class="form-note mt-2">No se solicitan datos de tarjeta. Si el servicio de cuentas no está disponible, el catálogo y el checkout local siguen funcionando.</p>' +
      '</div>';
  }
  function loginForm() {
    return '<form id="login-form" class="stack"><div class="field"><label for="login-email">Correo electrónico</label><input class="input" id="login-email" name="email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="login-password">Contraseña</label><input class="input" id="login-password" name="password" type="password" autocomplete="current-password" required minlength="6"></div>' +
      '<div class="form-message" id="auth-message" role="alert"></div><button class="btn btn-primary btn-block" type="submit">Ingresar</button><button class="btn btn-ghost btn-block btn-sm" type="button" data-auth-tab="recuperar">Olvidé mi contraseña</button></form>';
  }
  function registerForm() {
    return '<form id="register-form" class="stack"><div class="grid grid-2"><div class="field"><label for="reg-name">Nombre *</label><input class="input" id="reg-name" name="name" autocomplete="given-name" required maxlength="60"></div><div class="field"><label for="reg-lastname">Apellidos *</label><input class="input" id="reg-lastname" name="lastName" autocomplete="family-name" required maxlength="80"></div></div>' +
      '<div class="field"><label for="reg-email">Correo electrónico *</label><input class="input" id="reg-email" name="email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="reg-phone">WhatsApp / teléfono (opcional)</label><input class="input" id="reg-phone" name="phone" type="tel" autocomplete="tel" maxlength="24"></div>' +
      '<div class="field"><label for="reg-password">Contraseña *</label><input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" required minlength="8"><p class="hint">Mínimo 8 caracteres. No uses la misma contraseña de otros servicios.</p></div>' +
      '<div class="field"><label for="reg-password2">Confirmar contraseña *</label><input class="input" id="reg-password2" name="password2" type="password" autocomplete="new-password" required minlength="8"></div>' +
      '<div class="check-inline"><input type="checkbox" id="reg-terms" required><span>Acepto el <a href="privacidad.html" style="color:var(--gx-cyan)">aviso de privacidad</a> y el uso de mis datos para gestionar mi cuenta y pedidos.</span></div>' +
      '<div class="form-message" id="auth-message" role="alert"></div><button class="btn btn-primary btn-block" type="submit">Crear cuenta</button></form>' +
      '<div class="flex flex-wrap mt-2"><button class="btn btn-ghost btn-sm" type="button" id="resend-confirmation">Reenviar correo de confirmación</button></div>';
  }
  function recoverForm() {
    return '<form id="recover-form" class="stack"><div class="field"><label for="rec-email">Correo de tu cuenta</label><input class="input" id="rec-email" name="email" type="email" autocomplete="email" required></div><div class="form-message" id="auth-message" role="alert"></div><button class="btn btn-primary btn-block" type="submit">Enviar enlace de recuperación</button><button class="btn btn-ghost btn-block btn-sm" type="button" data-auth-tab="login">Volver a ingresar</button><p class="form-note">Supabase enviará un enlace al correo si la cuenta existe. Revisa también spam. Esta función requiere el servicio de correo configurado.</p></form>';
  }
  function recoveryHTML() {
    return '<div class="auth-card"><h1>Nueva contraseña</h1><p>Establece una contraseña nueva para tu cuenta.</p><form id="update-password-form" class="stack"><div class="field"><label for="new-password">Contraseña nueva</label><input class="input" id="new-password" type="password" autocomplete="new-password" required minlength="8"></div><div class="form-message" id="auth-message" role="alert"></div><button class="btn btn-primary btn-block" type="submit">Guardar contraseña</button></form></div>';
  }
  function setAuthMessage(text, type) {
    const el = $('#auth-message');
    if (!el) return;
    el.className = 'form-message ' + (type ? 'is-' + type : '');
    el.textContent = text || '';
  }
  function bindAuth() {
    document.querySelectorAll('[data-auth-tab]').forEach((btn) => btn.addEventListener('click', () => {
      state.authTab = btn.getAttribute('data-auth-tab');
      renderAuth();
    }));
    const login = $('#login-form');
    if (login) login.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.busy = true;
      setAuthMessage('', '');
      try {
        await GALAX.cloud.signIn($('#login-email').value.trim(), $('#login-password').value);
        await GALAX.refreshAuth();
        GALAX.toast('Sesión iniciada.', 'success');
        render();
      } catch (error) {
        const msg = String(error && error.message || '');
        if (/email.*not.*confirmed|not.*confirmed/i.test(msg)) {
          setAuthMessage('Tu correo aún no está confirmado. Revisa tu bandeja de entrada y spam, o usa "Reenviar correo de confirmación".', 'error');
        } else if (/invalid login/i.test(msg)) {
          setAuthMessage('Correo o contraseña incorrectos. Verifica tus datos. Si olvidaste la contraseña, usa recuperar.', 'error');
        } else {
          setAuthMessage(msg || 'No se pudo iniciar sesión.', 'error');
        }
      } finally { state.busy = false; }
    });
    const register = $('#register-form');
    if (register) register.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.busy) return;
      if (!$('#reg-terms').checked) { setAuthMessage('Debes aceptar el aviso de privacidad.', 'error'); return; }
      state.busy = true;
      setAuthMessage('', '');
      const name = $('#reg-name').value.trim();
      const lastName = $('#reg-lastname').value.trim();
      const password = $('#reg-password').value;
      const password2 = $('#reg-password2').value;
      if (name.length < 2) { setAuthMessage('Escribe tu nombre.', 'error'); state.busy = false; return; }
      if (lastName.length < 2) { setAuthMessage('Escribe tus apellidos.', 'error'); state.busy = false; return; }
      if (password !== password2) { setAuthMessage('Las contraseñas no coinciden.', 'error'); state.busy = false; return; }
      try {
        const data = await GALAX.cloud.signUp({
          email: $('#reg-email').value.trim(),
          password: password,
          nombre: name,
          apellidos: lastName,
          phone: $('#reg-phone').value.trim()
        });
        if (data && data.session) {
          await GALAX.refreshAuth();
          GALAX.toast('Cuenta creada y sesión iniciada.', 'success');
          render();
        } else {
          setAuthMessage('Cuenta creada. Revisa tu correo para confirmar la cuenta antes de ingresar. Si no llega el correo, contacta al equipo.', 'ok');
        }
      } catch (error) {
        setAuthMessage(error.message, 'error');
      } finally { state.busy = false; }
    });
    const recover = $('#recover-form');
    if (recover) recover.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.busy = true;
      setAuthMessage('', '');
      try {
        await GALAX.cloud.resetPassword($('#rec-email').value.trim());
        setAuthMessage('Si la cuenta existe, recibirás un enlace para restablecer la contraseña. Revisa spam.', 'ok');
      } catch (error) { setAuthMessage(error.message, 'error'); }
      finally { state.busy = false; }
    });
    const resendBtn = $('#resend-confirmation');
    if (resendBtn) resendBtn.addEventListener('click', async () => {
      const email = ($('#reg-email') && $('#reg-email').value.trim()) || '';
      if (!email) { setAuthMessage('Escribe tu correo para reenviar la confirmación.', 'error'); return; }
      resendBtn.disabled = true;
      try {
        await GALAX.cloud.resendConfirmation(email);
        setAuthMessage('Si la cuenta existe y no está confirmada, se envió un nuevo correo. Revisa spam.', 'ok');
      } catch (error) { setAuthMessage(error.message, 'error'); }
      finally { resendBtn.disabled = false; }
    });
    const updatePwd = $('#update-password-form');
    if (updatePwd) updatePwd.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await GALAX.cloud.updatePassword($('#new-password').value);
        setAuthMessage('Contraseña actualizada. Ya puedes usar tu cuenta.', 'ok');
        history.replaceState(null, '', 'cuenta.html');
        state.recovery = false;
      } catch (error) { setAuthMessage(error.message, 'error'); }
    });
  }
  function renderSignedIn() {
    const p = GALAX.cloudProfile || {};
    const name = p.nombre_completo || GALAX.cloudUser.email || 'Cuenta';
    const isAdmin = ['admin', 'editor'].includes(p.role);
    const root = $('#account-root');
    root.innerHTML = '<div class="account-grid" style="padding-bottom:50px">' +
      '<aside><nav class="account-nav" aria-label="Secciones de la cuenta">' +
        '<div style="padding:10px 8px;border-bottom:1px solid var(--gx-line);margin-bottom:6px"><div class="flex"><span class="icon-wrap">' + GALAX.icon('user') + '</span><div style="min-width:0"><strong style="display:block;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + GALAX.esc(name) + '</strong><span class="tiny dim">' + GALAX.esc(GALAX.cloudUser.email) + '</span></div></div>' + (p.role ? '<span class="badge badge-cyan mt-1">Rol: ' + GALAX.esc(p.role) + '</span>' : '') + '</div>' +
        '<button type="button" data-account-tab="perfil" class="' + (state.tab === 'perfil' ? 'is-active' : '') + '">' + GALAX.icon('user') + 'Mis datos</button>' +
        '<button type="button" data-account-tab="pedidos" class="' + (state.tab === 'pedidos' ? 'is-active' : '') + '">' + GALAX.icon('receipt') + 'Mis pedidos</button>' +
        '<button type="button" data-account-tab="favoritos" class="' + (state.tab === 'favoritos' ? 'is-active' : '') + '">' + GALAX.icon('heart') + 'Favoritos</button>' +
        '<button type="button" data-account-tab="seguridad" class="' + (state.tab === 'seguridad' ? 'is-active' : '') + '">' + GALAX.icon('settings') + 'Seguridad</button>' +
        (isAdmin ? '<a href="admin.html" style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;font-size:.78rem;color:#ddd6fe">' + GALAX.icon('lock') + 'Panel del equipo</a>' : '') +
      '</nav></aside>' +
      '<section class="panel account-panel" id="account-panel"></section>' +
    '</div>';
    bindTabs();
    renderSignedInPanel();
  }
  async function renderSignedInPanel() {
    const panel = $('#account-panel');
    if (!panel) return;
    if (state.tab === 'pedidos') {
      panel.innerHTML = '<div class="panel-head"><div><h2 style="font-size:1.05rem">Mis pedidos</h2><p class="small muted">Pedidos de tu cuenta y de este dispositivo.</p></div><button class="btn btn-ghost btn-sm" type="button" id="reload-orders">' + GALAX.icon('refresh', 'icon-sm') + 'Actualizar</button></div>' + ordersHTML();
      bindOrderActions(panel);
      panel.querySelector('#reload-orders').addEventListener('click', loadCloudOrders);
      if (!state.cloudOrders.length && !state.ordersLoading) loadCloudOrders();
    } else if (state.tab === 'favoritos') {
      renderLocalPanel();
    } else if (state.tab === 'seguridad') {
      panel.innerHTML = '<div class="panel-head"><div><h2 style="font-size:1.05rem">Seguridad y sesión</h2></div></div>' +
        '<div class="stack">' +
          '<form id="change-password-form" class="stack"><h3 style="font-size:.9rem">Cambiar contraseña</h3><div class="field"><label for="chg-password">Contraseña nueva</label><input class="input" id="chg-password" type="password" autocomplete="new-password" required minlength="8"><p class="hint">Se actualiza en Supabase Auth. No se guarda en este sitio.</p></div><div class="form-message" id="security-message" role="alert"></div><button class="btn btn-soft btn-sm" type="submit">Actualizar contraseña</button></form>' +
          '<hr class="divider">' +
          '<div class="info-box">' + GALAX.icon('shield', 'icon-sm') + '<div>La sesión se administra con Supabase Auth. No compartas tu contraseña ni el enlace de recuperación. El equipo de GALAX nunca te pedirá tu contraseña.</div></div>' +
          '<div class="flex flex-wrap"><button class="btn btn-danger btn-sm" type="button" id="sign-out">' + GALAX.icon('logout', 'icon-sm') + 'Cerrar sesión</button><button class="btn btn-ghost btn-sm" type="button" id="clear-airi">Borrar historial de Airi</button></div>' +
        '</div>';
      panel.querySelector('#change-password-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const msg = panel.querySelector('#security-message');
        try {
          await GALAX.cloud.updatePassword(panel.querySelector('#chg-password').value);
          msg.className = 'form-message is-ok';
          msg.textContent = 'Contraseña actualizada.';
        } catch (error) {
          msg.className = 'form-message is-error';
          msg.textContent = error.message;
        }
      });
      panel.querySelector('#sign-out').addEventListener('click', async () => {
        try { await GALAX.cloud.signOut(); await GALAX.refreshAuth(); GALAX.toast('Sesión cerrada.', 'info'); render(); }
        catch (error) { GALAX.toast(error.message, 'error'); }
      });
      panel.querySelector('#clear-airi').addEventListener('click', () => { try { localStorage.removeItem('galax_airi_history_v1'); } catch {} GALAX.toast('Historial local de Airi borrado.', 'info'); });
    } else {
      panel.innerHTML = '<div class="panel-head"><div><h2 style="font-size:1.05rem">Mis datos</h2><p class="small muted">Nombre, contacto y dirección para tus pedidos.</p></div></div>' + localProfileForm();
      bindProfileForm(panel);
    }
  }
  async function loadCloudOrders() {
    if (!cloudReady() || !GALAX.cloudUser) return;
    state.ordersLoading = true;
    state.ordersError = null;
    renderCurrent();
    try {
      state.cloudOrders = await GALAX.cloud.listOrders();
    } catch (error) {
      state.ordersError = error.message;
      console.warn('[GALAX] Pedidos en la nube:', error.message);
    } finally {
      state.ordersLoading = false;
      renderCurrent();
    }
  }
  function renderCurrent() {
    if (cloudReady() && GALAX.cloudUser) {
      if (!document.querySelector('.account-grid') || !document.querySelector('#account-panel')) renderSignedIn();
      else renderSignedInPanel();
    } else if (cloudReady()) {
      renderAuth();
    } else {
      renderLocalDashboard(true);
    }
  }
  function render() {
    if (cloudReady()) {
      if (GALAX.cloudUser) renderSignedIn(); else renderAuth();
    } else {
      renderLocalDashboard(true);
    }
  }
  GALAX.ready().then(async () => {
    if (cloudReady() && !GALAX.cloudUser) {
      // Garantiza que el evento de auth de una sesión persistida se refleje al entrar.
      try { await GALAX.refreshAuth(); } catch {}
    }
    render();
    if (cloudReady() && GALAX.cloudUser && state.tab === 'pedidos') loadCloudOrders();
    document.addEventListener('galax:auth', render);
    document.addEventListener('galax:orders', renderCurrent);
  });
})();
