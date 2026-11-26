/* GALAX PC REPAIR — contacto por WhatsApp */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  GALAX.ready().then(() => {
    const display = (GALAX.content.brand && GALAX.content.brand.whatsappDisplay) || '+51 986 260 738';
    const waUrl = GALAX.whatsappUrl('Hola GALAX PC REPAIR, quiero hacer una consulta.');
    $('#cc-wa').innerHTML = GALAX.icon('whatsapp');
    $('#cc-loc').innerHTML = GALAX.icon('mapPin');
    $('#cc-clock').innerHTML = GALAX.icon('clock');
    $('#cc-shield').innerHTML = GALAX.icon('shield');
    $('#contact-wa').href = waUrl;
    $('#contact-wa').textContent = display;
    $('#contact-note').innerHTML = GALAX.icon('info', 'icon-sm') + '<div><strong>Este sitio no publica correo, teléfono fijo ni dirección no verificados.</strong> El único canal público confirmado es el WhatsApp ' + GALAX.esc(display) + '. Los datos del seed antiguo no se presentan como información oficial.</div>';
    $('#contact-faq').innerHTML = [
      { q: '¿Puedo comprar sin crear una cuenta?', a: 'Sí. Puedes completar el checkout en modo local y coordinar por WhatsApp. Si Supabase está configurado, el pedido puede registrarse en la nube; la cuenta sirve para sincronizar favoritos y consultar pedidos.' },
      { q: '¿Cómo sé si un producto tiene stock?', a: 'El stock mostrado proviene del catálogo. Se valida nuevamente al crear el pedido. Si cambió, el equipo te lo informa antes de confirmar. Para unidades limitadas, consulta por WhatsApp.' },
      { q: '¿Puedo pagar con tarjeta?', a: 'Solo si la pasarela oficial está habilitada con credenciales comerciales. En este despliegue el pago con tarjeta está desactivado y no se simula ningún cobro. Yape, Plin y transferencia quedan pendientes de confirmación manual.' },
      { q: '¿El recibo sirve como factura?', a: 'No. El PNG es un comprobante comercial interno con los datos del pedido. No es una factura electrónica SUNAT. Si necesitas un documento tributario, coordínalo con el equipo.' }
    ].map((f) => '<details class="faq-item"><summary>' + GALAX.esc(f.q) + GALAX.icon('plus') + '</summary><p>' + GALAX.esc(f.a) + '</p></details>').join('');
    $('#contact-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const msg = $('#contact-msg');
      const name = $('#ct-name').value.trim();
      const phone = $('#ct-phone').value.trim();
      const topic = $('#ct-topic').value;
      const text = $('#ct-message').value.trim();
      if (name.length < 3) { msg.className = 'form-message is-error'; msg.textContent = 'Escribe tu nombre.'; return; }
      if (!/^[+\d][\d\s().-]{6,20}$/.test(phone)) { msg.className = 'form-message is-error'; msg.textContent = 'Escribe un número de WhatsApp válido.'; return; }
      if (!topic) { msg.className = 'form-message is-error'; msg.textContent = 'Selecciona el motivo de contacto.'; return; }
      if (text.length < 5) { msg.className = 'form-message is-error'; msg.textContent = 'Escribe tu consulta.'; return; }
      const wa = GALAX.whatsappUrl('Hola GALAX PC REPAIR.\n\nNombre: ' + name + '\nWhatsApp: ' + phone + '\nMotivo: ' + topic + '\nConsulta: ' + text);
      msg.className = 'form-message is-ok';
      msg.textContent = 'Se abrirá WhatsApp con tu mensaje preparado. Recuerda enviarlo desde la aplicación.';
      window.open(wa, '_blank', 'noopener');
    });
  });
})();
