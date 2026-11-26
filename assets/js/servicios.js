/* GALAX PC REPAIR — servicios y solicitud por WhatsApp */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  function serviceIcon(icon) {
    return { 'fa-laptop': 'laptop', 'fa-microchip': 'cpu', 'fa-windows': 'desktop', 'fa-fan': 'refresh', 'fa-network-wired': 'wifi', 'fa-chart-simple': 'shield' }[icon] || 'wrench';
  }
  function renderServices() {
    const services = GALAX.content.services || [];
    $('#services-grid').innerHTML = services.map((s) => '<article class="service-card"><span class="service-icon">' + GALAX.icon(serviceIcon(s.icon)) + '</span><div><h3>' + GALAX.esc(s.name) + '</h3><p>' + GALAX.esc(s.description) + '</p><span class="service-meta">' + GALAX.icon('clock', 'icon-sm') + 'Cotización tras evaluación</span></div></article>').join('');
    const scope = [
      ['laptop', 'Laptops y notebooks', 'Arranque, batería, teclado, pantalla, ventilación, temperatura y rendimiento.'],
      ['desktop', 'PC de escritorio', 'Fuente, almacenamiento, memoria, limpieza, sistema operativo y armado.'],
      ['cpu', 'Placas y componentes', 'Revisión electrónica, microsoldadura y diagnóstico de componentes cuando el caso lo permite.'],
      ['wifi', 'Redes y conectividad', 'Configuración de routers, repetidores y red cableada o inalámbrica.'],
      ['refresh', 'Mantenimiento', 'Limpieza interna, pasta térmica y puesta a punto según el estado del equipo.'],
      ['shield', 'Diagnóstico honesto', 'Si no encontramos una solución segura, te lo decimos antes de intervenir.']
    ];
    $('#service-scope').innerHTML = scope.map(([ic, title, text]) => '<article class="service-detail-card"><h3>' + GALAX.icon(ic) + GALAX.esc(title) + '</h3><p>' + GALAX.esc(text) + '</p></article>').join('');
    const select = $('#sv-service');
    select.innerHTML = '<option value="">No estoy seguro</option>' + services.map((s) => '<option value="' + GALAX.esc(s.name) + '">' + GALAX.esc(s.name) + '</option>').join('');
    const faq = [
      { q: '¿El diagnóstico tiene costo?', a: 'La evaluación y su costo se confirman antes de recibir el equipo. No se publica una tarifa única porque depende del tipo de revisión. Consúltalo por WhatsApp y quedará claro antes de dejar el equipo.' },
      { q: '¿Cuánto demora una reparación?', a: 'Depende del diagnóstico y de la disponibilidad de repuestos. No prometemos plazos que no podamos cumplir; el tiempo estimado se informa después de la evaluación.' },
      { q: '¿Se garantiza la recuperación de datos?', a: 'No. El respaldo o recuperación de datos no está garantizado. Si la información es crítica, indícalo antes de intervenir y evalúa un servicio especializado.' },
      { q: '¿Puedo enviar mi equipo por courier?', a: 'Se puede coordinar según el destino. El costo y el riesgo del traslado se conversan antes. Para Lima también existe recojo coordinado en el taller.' },
      { q: '¿Qué pasa si no autorizo la reparación?', a: 'Se coordina la devolución del equipo en el estado en que se recibió, salvo que se haya autorizado algún trabajo adicional. Cualquier costo de evaluación se informa antes.' }
    ];
    $('#service-faq').innerHTML = faq.map((f) => '<details class="faq-item"><summary>' + GALAX.esc(f.q) + GALAX.icon('plus') + '</summary><p>' + GALAX.esc(f.a) + '</p></details>').join('');
  }
  function bindForm() {
    const form = $('#service-form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const message = $('#service-message');
      const name = $('#sv-name').value.trim();
      const phone = $('#sv-phone').value.trim();
      const type = $('#sv-type').value;
      const service = $('#sv-service').value;
      const problem = $('#sv-problem').value.trim();
      if (name.length < 3) { message.className = 'full form-message is-error'; message.textContent = 'Escribe tu nombre.'; return; }
      if (!/^[+\d][\d\s().-]{6,20}$/.test(phone)) { message.className = 'full form-message is-error'; message.textContent = 'Escribe un número de contacto válido.'; return; }
      if (!type) { message.className = 'full form-message is-error'; message.textContent = 'Selecciona el tipo de equipo.'; return; }
      if (problem.length < 10) { message.className = 'full form-message is-error'; message.textContent = 'Describe la falla con un poco más de detalle.'; return; }
      if (!$('#sv-consent').checked) { message.className = 'full form-message is-error'; message.textContent = 'Acepta el uso de tus datos para responder la solicitud.'; return; }
      const text = 'Hola GALAX PC REPAIR, quiero solicitar una evaluación técnica.\n\nNombre: ' + name + '\nWhatsApp: ' + phone + '\nEquipo: ' + type + '\nServicio de interés: ' + (service || 'No estoy seguro') + '\nFalla: ' + problem + '\n\nEntiendo que el diagnóstico y el costo se confirman después de revisar el equipo.';
      const url = GALAX.whatsappUrl(text);
      message.className = 'full form-message is-ok';
      message.textContent = 'Se abrirá WhatsApp con tu solicitud preparada. Debes enviar el mensaje para que el equipo lo reciba.';
      window.open(url, '_blank', 'noopener');
    });
  }
  GALAX.ready().then(() => {
    ['srv-check-1', 'srv-check-2', 'srv-check-3', 'srv-check-4'].forEach((id) => { const node = document.getElementById(id); if (node) node.innerHTML = GALAX.icon('check', 'icon-sm'); });
    $('#services-note').innerHTML = GALAX.icon('info', 'icon-sm') + '<div>El precio final depende del diagnóstico, repuestos y estado del equipo. No se cobra ni se promete un resultado antes de revisar el equipo. Los precios de servicio del catálogo no están definidos y no se inventan.</div>';
    $('#srv-info').innerHTML = GALAX.icon('shield', 'icon-sm') + '<div>No envíes contraseñas ni datos de tarjeta por chat. Para revisar el equipo, coordina primero el recojo o la entrega en el taller.</div>';
    $('#srv-wa-icon').innerHTML = GALAX.icon('whatsapp');
    $('#srv-wa').href = GALAX.whatsappUrl('Hola GALAX PC REPAIR, quiero consultar por el servicio técnico.');
    renderServices();
    bindForm();
  });
})();
