/* GALAX PC REPAIR — checkout con pedido local o Supabase, sin pago simulado */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = {
    lines: [],
    shipping: 'lima',
    payment: 'yape',
    busy: false,
    prefill: false
  };
  function esc(v) { return GALAX.esc(v); }
  function money(v) { return GALAX.money(v); }
  function shippingCost() {
    if (state.shipping === 'lima') return Number(GALAX.config.commerce.shippingLima) || 12;
    return 0;
  }
  function shippingLabel() {
    return state.shipping === 'lima' ? 'Envío Lima' : state.shipping === 'pickup' ? 'Recojo en taller' : 'Envío provincia (por cotizar)';
  }
  function totals() {
    const subtotal = state.lines.reduce((n, l) => n + l.subtotal, 0);
    return { subtotal, shipping: shippingCost(), total: subtotal + shippingCost() };
  }
  function renderItems() {
    $('#order-items').innerHTML = state.lines.map((l) => '<div class="order-item"><img src="' + esc(GALAX.productImage(l.product)) + '" alt="" loading="lazy" width="42" height="38"><div><strong style="display:block;font-size:.75rem">' + esc(l.product.model || l.product.name) + '</strong><span class="tiny dim">' + esc(l.product.code) + ' · ' + l.qty + ' × ' + money(l.product.price) + '</span></div><span class="order-item-price">' + money(l.subtotal) + '</span></div>').join('');
    $('#order-count').textContent = GALAX.cartCount() + (GALAX.cartCount() === 1 ? ' producto' : ' productos');
    renderTotals();
  }
  function renderTotals() {
    const t = totals();
    $('#order-totals').innerHTML = '<div class="summary-line"><span>Subtotal</span><strong>' + money(t.subtotal) + '</strong></div>' +
      '<div class="summary-line"><span>' + esc(shippingLabel()) + '</span><span>' + (state.shipping === 'province' ? 'Por cotizar' : money(t.shipping)) + '</span></div>' +
      '<div class="summary-line total"><span>Total referencial</span><span>' + money(t.total) + '</span></div>';
  }
  function syncShipping() {
    const toggles = document.querySelectorAll('[name="shipping"]');
    toggles.forEach((r) => r.addEventListener('change', () => {
      state.shipping = document.querySelector('[name="shipping"]:checked').value;
      const address = $('#address-fields');
      const required = state.shipping !== 'pickup';
      address.style.display = required ? '' : 'none';
      $('#co-address').required = required;
      $('#co-city').required = required;
      renderTotals();
    }));
  }
  function syncPayment() {
    document.querySelectorAll('[name="payment"]').forEach((r) => r.addEventListener('change', () => {
      state.payment = document.querySelector('[name="payment"]:checked').value;
    }));
  }
  function prefill() {
    if (state.prefill) return;
    state.prefill = true;
    const p = GALAX.cloudProfile || GALAX.localProfile();
    if (p) {
      $('#co-name').value = p.nombre_completo || p.name || '';
      $('#co-phone').value = p.telefono || p.phone || '';
      $('#co-email').value = (GALAX.cloudUser && GALAX.cloudUser.email) || p.email || '';
      $('#co-address').value = p.direccion || p.address || '';
    }
  }
  function setMessage(text, type) {
    const node = $('#checkout-message');
    node.className = 'form-message ' + (type ? 'is-' + type : '');
    node.textContent = text || '';
  }
  function validPhone(value) { return /^[+\d][\d\s().-]{6,20}$/.test(String(value || '').trim()); }
  function validate() {
    const name = $('#co-name').value.trim();
    const phone = $('#co-phone').value.trim();
    const email = $('#co-email').value.trim();
    const address = $('#co-address').value.trim();
    const city = $('#co-city').value.trim();
    if (name.length < 3) return 'Escribe tu nombre y apellidos.';
    if (!validPhone(phone)) return 'Escribe un número de WhatsApp o teléfono válido.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'El correo electrónico no tiene un formato válido.';
    if (state.shipping !== 'pickup' && address.length < 6) return 'Escribe una dirección de entrega válida o elige recojo en el taller.';
    if (state.shipping !== 'pickup' && city.length < 2) return 'Indica la ciudad o distrito de entrega.';
    if (!$('#co-terms').checked) return 'Debes aceptar las condiciones del pedido para continuar.';
    if (!state.lines.length) return 'Tu carrito está vacío.';
    for (const line of state.lines) {
      const p = GALAX.getProduct(line.product.code);
      if (!p || !p.published) return 'Un producto del carrito ya no está publicado: ' + line.product.code + '.';
      if (line.qty > p.stock) return 'El stock de ' + p.code + ' cambió. Solo hay ' + p.stock + ' unidades. Ajusta el carrito.';
    }
    return null;
  }
  function collect() {
    return {
      customer: {
        name: $('#co-name').value.trim(),
        phone: $('#co-phone').value.trim(),
        email: $('#co-email').value.trim() || null,
        document: $('#co-document').value.trim() || null,
        address: $('#co-address').value.trim() || null,
        city: $('#co-city').value.trim() || null,
        region: $('#co-region').value.trim() || null
      },
      shipping: { method: state.shipping, cost: shippingCost(), label: shippingLabel(), address: $('#co-address').value.trim() || null, city: $('#co-city').value.trim() || null, region: $('#co-region').value.trim() || null },
      payment: state.payment,
      notes: $('#co-notes').value.trim()
    };
  }
  function localCode() {
    const d = new Date();
    const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'GX-' + ymd + '-' + String(Math.floor(1000 + Math.random() * 9000));
  }
  function makeLocalOrder(data) {
    const t = totals();
    return {
      code: localCode(),
      date: new Date().toISOString(),
      status: 'pendiente',
      payment: data.payment,
      paymentLabel: { yape: 'Yape', plin: 'Plin', transfer: 'Transferencia bancaria', card: 'Tarjeta (no habilitada)' }[data.payment] || data.payment,
      customer: data.customer,
      shipping: data.shipping,
      shippingCost: t.shipping,
      subtotal: t.subtotal,
      total: t.total,
      notes: data.notes,
      items: state.lines.map((l) => ({ code: l.product.code, name: l.product.name, qty: l.qty, price: l.product.price, subtotal: l.subtotal })),
      source: 'local'
    };
  }
  async function submit(data) {
    if (state.busy) return;
    state.busy = true;
    $('#checkout-submit').disabled = true;
    $('#checkout-submit').innerHTML = '<span class="spinner"></span>Enviando pedido…';
    setMessage('', '');
    try {
      if (data.payment === 'card') {
        setMessage('El pago con tarjeta aún no está habilitado. Elige Yape, Plin, transferencia o coordinación por WhatsApp. No se realizó ningún cobro.', 'error');
        state.busy = false;
        $('#checkout-submit').disabled = false;
        $('#checkout-submit').innerHTML = GALAX.icon('send', 'icon-sm') + 'Enviar pedido (pendiente de pago)';
        return;
      }
      let order = null;
      let cloudError = null;
      if (GALAX.cloud && GALAX.cloud.configured()) {
        try {
          const payloadItems = state.lines.map((l) => ({ code: l.product.code, qty: l.qty }));
          const response = await GALAX.cloud.createOrder({
            items: payloadItems,
            customer: data.customer,
            shipping: data.shipping,
            payment: data.payment,
            notes: data.notes
          });
          if (response && (response.code || response.order)) {
            const body = response.order || response;
            order = Object.assign({}, body, {
              code: body.code,
              status: body.status || 'pendiente',
              payment: data.payment,
              customer: data.customer,
              shipping: data.shipping,
              shippingCost: Number(body.shipping_cost != null ? body.shipping_cost : body.shippingCost != null ? body.shippingCost : totals().shipping),
              subtotal: Number(body.subtotal != null ? body.subtotal : totals().subtotal),
              total: Number(body.total != null ? body.total : totals().total),
              date: body.created_at || new Date().toISOString(),
              items: (body.items || body.store_order_items || state.lines.map((l) => ({ code: l.product.code, name: l.product.name, qty: l.qty, price: l.product.price, subtotal: l.subtotal }))),
              notes: data.notes,
              source: 'cloud'
            });
          } else {
            throw new Error('La confirmación del pedido llegó vacía.');
          }
        } catch (error) {
          cloudError = error;
          console.warn('[GALAX] No se pudo registrar el pedido en Supabase:', error.message);
        }
      }
      if (!order) {
        order = makeLocalOrder(data);
        order.cloudError = cloudError ? 'El pedido se guardó en este dispositivo porque Supabase no respondió.' : null;
        GALAX.addLocalOrder(order);
      } else {
        GALAX.addLocalOrder(order);
      }
      try { GALAX.saveLocalProfile({ name: data.customer.name, email: data.customer.email || '', phone: data.customer.phone, address: data.customer.address || '' }); } catch {}
      GALAX.clearCart();
      renderSuccess(order, cloudError);
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'No se pudo crear el pedido. Intenta de nuevo o coordina por WhatsApp.', 'error');
      state.busy = false;
      $('#checkout-submit').disabled = false;
      $('#checkout-submit').innerHTML = GALAX.icon('send', 'icon-sm') + 'Enviar pedido (pendiente de pago)';
    }
  }
  function renderSuccess(order, cloudError) {
    const t = { subtotal: order.subtotal, shipping: order.shippingCost, total: order.total };
    const waText = 'Hola, registré el pedido ' + order.code + ' por ' + money(order.total) + ' con pago ' + order.payment + '. Quiero coordinar la confirmación.';
    const view = $('#checkout-view');
    view.innerHTML = '<div class="panel success-panel">' +
      '<div class="success-icon">' + GALAX.icon('checkCircle') + '</div>' +
      '<span class="eyebrow" style="justify-content:center">Pedido registrado</span>' +
      '<h1 style="margin:8px 0 4px;font-size:1.7rem">Gracias, ' + esc(String(order.customer.name || '').split(' ')[0] || 'cliente') + '</h1>' +
      '<p class="muted">Tu pedido quedó <strong>pendiente de confirmación de stock y pago</strong>. No se ha cobrado nada automáticamente.</p>' +
      '<p class="order-code mt-2">' + esc(order.code) + '</p>' +
      '<div class="summary-list" style="max-width:420px;margin:18px auto 0;text-align:left">' +
        '<div class="summary-line"><span>Estado</span><strong>Pendiente</strong></div>' +
        '<div class="summary-line"><span>Pago</span><span>' + esc(order.paymentLabel || order.payment) + '</span></div>' +
        '<div class="summary-line"><span>Entrega</span><span>' + esc((order.shipping && order.shipping.label) || 'Por coordinar') + '</span></div>' +
        '<div class="summary-line"><span>Subtotal</span><span>' + money(t.subtotal) + '</span></div>' +
        '<div class="summary-line"><span>Envío</span><span>' + (order.shipping && order.shipping.method === 'province' ? 'Por cotizar' : money(t.shipping)) + '</span></div>' +
        '<div class="summary-line total"><span>Total referencial</span><span>' + money(t.total) + '</span></div>' +
      '</div>' +
      '<div class="info-box ' + (cloudError ? 'warn' : '') + ' mt-3" style="text-align:left">' + GALAX.icon(cloudError ? 'alert' : 'info') + '<div>' + (cloudError ? 'El pedido se guardó en este dispositivo porque Supabase no respondió. Descarga tu recibo y coordina por WhatsApp; el equipo puede registrarlo manualmente.' : 'El pedido se registró correctamente. Coordina el pago por WhatsApp indicando tu código.') + '</div></div>' +
      '<div class="flex center flex-wrap mt-3">' +
        '<button class="btn btn-primary" type="button" id="download-receipt">' + GALAX.icon('download') + 'Descargar recibo PNG</button>' +
        '<a class="btn btn-soft" href="' + esc(GALAX.whatsappUrl(waText)) + '" target="_blank" rel="noopener">' + GALAX.icon('whatsapp') + 'Coordinar por WhatsApp</a>' +
        '<a class="btn btn-ghost" href="cuenta.html">Ver mi cuenta</a>' +
        '<a class="btn btn-ghost" href="tienda.html">Seguir comprando</a>' +
      '</div>' +
      '<p class="receipt-note mt-3">El recibo PNG es un comprobante comercial interno, no una factura electrónica SUNAT. Si necesitas un documento tributario, coordínalo con el equipo.</p>' +
    '</div>';
    document.querySelectorAll('.step').forEach((step, i) => { step.classList.toggle('is-done', i < 2); step.classList.toggle('is-active', i === 2); });
    const download = $('#download-receipt');
    if (download) download.addEventListener('click', async () => {
      download.disabled = true;
      try { await GalaxReceipt.download(order); } catch (error) { GALAX.toast(error.message, 'error'); } finally { download.disabled = false; }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function renderEmpty() {
    $('#checkout-view').innerHTML = '<div class="empty-state"><div>' + GALAX.icon('cart') + '</div><h2>Tu carrito está vacío</h2><p>Agrega productos antes de completar un pedido.</p><a class="btn btn-primary" href="tienda.html">Ver catálogo</a></div>';
  }
  GALAX.ready().then(() => {
    const icons = { 'payment-info-icon': 'shield', 'checkout-submit-icon': 'send', 'order-info-icon': 'info' };
    Object.entries(icons).forEach(([id, name]) => { const node = document.getElementById(id); if (node) node.innerHTML = GALAX.icon(name, 'icon-sm'); });
    state.lines = GALAX.cartLines();
    if (!state.lines.length) { renderEmpty(); return; }
    renderItems();
    prefill();
    syncShipping();
    syncPayment();
    const hasCard = Boolean(GALAX.config.culqi && GALAX.config.culqi.publicKey && GALAX.cloud && GALAX.cloud.configured());
    if (hasCard) {
      const option = $('#card-option');
      const input = option && option.querySelector('input');
      if (option && input) {
        option.classList.remove('disabled');
        input.disabled = false;
        $('#card-note').textContent = 'La pasarela está configurada. El cobro solo se realiza en el entorno oficial de Culqi y requiere confirmación del servidor.';
      }
    }
    $('#address-fields').style.display = state.shipping === 'pickup' ? 'none' : '';
    $('#co-address').required = state.shipping !== 'pickup';
    $('#co-city').required = state.shipping !== 'pickup';
    $('#checkout-form').addEventListener('submit', (event) => {
      event.preventDefault();
      setMessage('', '');
      const error = validate();
      if (error) { setMessage(error, 'error'); return; }
      submit(collect());
    });
    document.addEventListener('galax:cart', () => {
      state.lines = GALAX.cartLines();
      if (!state.lines.length) renderEmpty(); else renderItems();
    });
  });
})();
