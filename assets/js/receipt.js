/* =====================================================================
   GALAX PC REPAIR — recibo PNG generado con datos reales del pedido.
   No es una factura electrónica SUNAT. Se genera en el navegador del dueño.
   ===================================================================== */
(function () {
  'use strict';

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  function fmt(value) {
    return window.GALAX ? GALAX.money(value) : 'S/ ' + Number(value || 0).toFixed(2);
  }
  function dateText(value) {
    try { return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(value)); }
    catch { return String(value || ''); }
  }
  function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/);
    let line = '', lines = 0;
    for (let n = 0; n < words.length; n++) {
      const test = line ? line + ' ' + words[n] : words[n];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = words[n];
        y += lineHeight;
        lines++;
        if (maxLines && lines >= maxLines - 1) {
          let rest = words.slice(n).join(' ');
          while (ctx.measureText(rest + '…').width > maxWidth && rest.length > 0) rest = rest.slice(0, -1);
          ctx.fillText(rest + '…', x, y);
          return y + lineHeight;
        }
      } else line = test;
    }
    if (line) { ctx.fillText(line, x, y); y += lineHeight; }
    return y;
  }
  function normalize(order) {
    if (!order) throw new Error('No hay datos del pedido.');
    const items = (order.items || order.store_order_items || []).map((it) => ({
      code: it.code || it.product_code || it.sku || '',
      name: it.name || it.product_name || it.nombre_producto || 'Producto',
      qty: Number(it.qty || it.quantity || it.cantidad || 1),
      price: Number(it.price || it.unit_price || it.precio_unitario || 0),
      subtotal: Number(it.subtotal || (Number(it.qty || it.quantity || 1) * Number(it.price || it.unit_price || 0)))
    }));
    const subtotal = Number(order.subtotal || items.reduce((n, i) => n + i.subtotal, 0));
    const shipping = Number(order.shippingCost != null ? order.shippingCost : order.shipping_cost || 0);
    const total = Number(order.total || subtotal + shipping);
    return {
      code: order.code || order.codigo || 'GX-SIN-CODIGO',
      date: order.date || order.created_at || order.creado_en || new Date().toISOString(),
      status: order.status || order.estado || 'pendiente',
      payment: order.payment || order.payment_method || order.metodo_pago || 'coordinar',
      customer: order.customer || {
        name: order.customer_name || order.nombre_cliente || '',
        email: order.customer_email || order.email_cliente || '',
        phone: order.customer_phone || order.telefono_cliente || '',
        address: order.shipping_address || order.direccion || ''
      },
      notes: order.notes || order.notas || '',
      items, subtotal, shipping, total,
      source: order.source || 'local'
    };
  }

  async function generate(order) {
    const data = normalize(order);
    if (!data.items.length) throw new Error('El pedido no tiene productos para el recibo.');
    const width = 1000;
    const itemSpace = data.items.reduce((n, i) => n + 55, 0);
    const height = Math.max(1180, 780 + itemSpace);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Fondo
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0b1424';
    ctx.fillRect(0, 0, width, 250);
    // Acento
    const grad = ctx.createLinearGradient(0, 230, width, 250);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(.55, '#38bdf8');
    grad.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 248, width, 4);

    const logo = await loadImage('assets/img/logo.jpeg');
    if (logo) {
      ctx.save();
      ctx.beginPath();
      const r = 14;
      const x = 56, y = 42, w = 108, h = 108;
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
      ctx.clip();
      ctx.drawImage(logo, x, y, w, h);
      ctx.restore();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText('GALAX PC REPAIR', 188, 84);
    ctx.fillStyle = '#22d3ee';
    ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText('VENTA · REPARACIÓN · ASISTENCIA TÉCNICA', 188, 108);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Lima, Perú · WhatsApp +51 986 260 738', 188, 130);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('COMPROBANTE INTERNO DE PEDIDO', 940, 68);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px "Consolas", "Courier New", monospace';
    ctx.fillText(data.code, 940, 105);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(dateText(data.date), 940, 128);
    ctx.textAlign = 'left';

    // Datos del cliente
    let y = 292;
    ctx.fillStyle = '#0b1424';
    ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
    ctx.fillText('DATOS DEL PEDIDO', 56, y);
    y += 28;
    ctx.fillStyle = '#334155';
    ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Cliente', 56, y);
    ctx.fillText('Contacto', 530, y);
    y += 22;
    ctx.font = '400 15px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(String(data.customer.name || 'No registrado').slice(0, 55), 56, y);
    ctx.fillText(String(data.customer.phone || data.customer.email || 'No registrado').slice(0, 55), 530, y);
    y += 22;
    ctx.fillStyle = '#64748b';
    ctx.font = '400 12px "Segoe UI", Arial, sans-serif';
    wrap(ctx, data.customer.address || 'Entrega a coordinar', 56, y, 400, 17, 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Estado: ' + String(data.status).toUpperCase(), 940, y);
    ctx.fillText('Pago: ' + String(data.payment).toUpperCase(), 940, y + 18);
    ctx.textAlign = 'left';

    // Tabla
    y = 430;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(56, y - 20, 888, 34);
    ctx.fillStyle = '#334155';
    ctx.font = '700 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText('PRODUCTO', 70, y + 2);
    ctx.textAlign = 'center';
    ctx.fillText('CANT.', 650, y + 2);
    ctx.textAlign = 'right';
    ctx.fillText('PRECIO', 780, y + 2);
    ctx.fillText('SUBTOTAL', 930, y + 2);
    ctx.textAlign = 'left';
    y += 38;
    for (const item of data.items) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
      wrap(ctx, item.name, 70, y, 520, 16, 2);
      ctx.fillStyle = '#64748b';
      ctx.font = '400 11px "Segoe UI", Arial, sans-serif';
      ctx.fillText(item.code, 70, y + 30);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
      ctx.fillText(String(item.qty), 655, y);
      ctx.textAlign = 'right';
      ctx.fillText(fmt(item.price), 830, y);
      ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
      ctx.fillText(fmt(item.subtotal), 930, y);
      ctx.textAlign = 'left';
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath(); ctx.moveTo(56, y + 42); ctx.lineTo(944, y + 42); ctx.stroke();
      y += 55;
    }

    // Totales
    y += 18;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(560, y - 20, 384, 120);
    ctx.fillStyle = '#334155';
    ctx.font = '400 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Subtotal', 584, y + 2);
    ctx.textAlign = 'right';
    ctx.fillText(fmt(data.subtotal), 920, y + 2);
    ctx.textAlign = 'left';
    ctx.fillText('Envío / coordinación', 584, y + 28);
    ctx.textAlign = 'right';
    ctx.fillText(data.shipping > 0 ? fmt(data.shipping) : 'A coordinar', 920, y + 28);
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath(); ctx.moveTo(584, y + 42); ctx.lineTo(920, y + 42); ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Total', 584, y + 68);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0e7490';
    ctx.fillText(fmt(data.total), 920, y + 68);

    // Notas y pie
    ctx.textAlign = 'left';
    y += 140;
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Notas', 56, y);
    ctx.fillStyle = '#475569';
    ctx.font = '400 12px "Segoe UI", Arial, sans-serif';
    y = wrap(ctx, data.notes || 'Pedido sujeto a validación de stock y confirmación de pago. La coordinación se realiza por WhatsApp.', 56, y + 20, 888, 17, 3);
    y += 16;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath(); ctx.moveTo(56, y); ctx.lineTo(944, y); ctx.stroke();
    y += 24;
    ctx.fillStyle = '#b45309';
    ctx.font = '700 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('DOCUMENTO INTERNO — NO ES UNA FACTURA ELECTRÓNICA SUNAT', 56, y);
    ctx.fillStyle = '#64748b';
    ctx.font = '400 11px "Segoe UI", Arial, sans-serif';
    y = wrap(ctx, 'Este PNG resume los datos registrados del pedido y sirve como comprobante de coordinación. Para un documento tributario, solicita la emisión correspondiente al equipo. GALAX PC REPAIR nunca solicita el número completo de tarjeta ni el CVV por chat.', 56, y + 19, 888, 16, 3);
    y += 20;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText('GALAX PC REPAIR · galanespacial.github.io/GALAX-PC-REPAIR · Lima, Perú', 56, y);
    ctx.textAlign = 'right';
    ctx.fillText('Generado: ' + dateText(new Date()), 944, y);
    ctx.textAlign = 'left';

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('No se pudo generar el PNG.')); return; }
        resolve({ blob, dataUrl: canvas.toDataURL('image/png'), filename: 'GALAX-recibo-' + data.code + '.png' });
      }, 'image/png');
    });
  }

  async function download(order) {
    const file = await generate(order);
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    if (window.GALAX) GALAX.toast('Recibo PNG descargado. Es un comprobante interno, no una factura SUNAT.', 'success');
    return file;
  }

  window.GalaxReceipt = { generate, download, normalize };
})();
