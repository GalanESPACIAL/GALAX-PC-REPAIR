/* GALAX PC REPAIR — preferencias del dispositivo */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  function syncVoice() {
    let on = false;
    try { on = localStorage.getItem('galax_airi_voice_v1') === '1'; } catch {}
    const btn = $('#voice-setting');
    if (btn) btn.setAttribute('aria-pressed', String(on));
  }
  GALAX.ready().then(() => {
    $('#a11y-info').innerHTML = GALAX.icon('info', 'icon-sm') + '<div>Si tu sistema tiene activada la opción de movimiento reducido, la tienda desactiva animaciones y efectos automáticamente. Las preferencias se guardan solo en este navegador.</div>';
    $('#config-wa-icon').innerHTML = GALAX.icon('whatsapp');
    $('#config-wa').href = GALAX.whatsappUrl('Hola GALAX PC REPAIR, necesito ayuda con la tienda o un producto.');
    const configured = GALAX.cloud && GALAX.cloud.configured();
    $('#system-status').innerHTML = '<div class="summary-line"><span>Catálogo</span><span>' + (configured ? 'Supabase + respaldo local' : 'Datos locales del proyecto') + '</span></div>' +
      '<div class="summary-line"><span>Cuentas</span><span>' + (configured ? (GALAX.cloudUser ? 'Sesión activa' : 'Disponibles para iniciar sesión') : 'No configuradas en este despliegue') + '</span></div>' +
      '<div class="summary-line"><span>Pedidos</span><span>' + (configured ? 'Nube + copia local' : 'Guardados en este dispositivo') + '</span></div>' +
      '<div class="summary-line"><span>Pago con tarjeta</span><span>' + (GALAX.config.culqi.publicKey ? 'Clave pública presente; requiere validación del servidor' : 'No habilitado') + '</span></div>' +
      '<div class="summary-line"><span>Yape / Plin</span><span>Pendiente de confirmación manual</span></div>';
    $('#system-info').innerHTML = configured
      ? GALAX.icon('shield', 'icon-sm') + '<div>La tienda está conectada a Supabase. Aun así, los pagos con tarjeta solo se habilitan con la pasarela oficial y la validación del servidor. No se simula un cobro.</div>'
      : GALAX.icon('alert', 'icon-sm') + '<div>Este despliegue usa datos locales porque faltan las credenciales públicas de Supabase. El catálogo, el carrito y el recibo funcionan; las cuentas en la nube y los pedidos compartidos se activarán al configurar el proyecto.</div>';
    syncVoice();
    const voice = $('#voice-setting');
    if (voice) voice.addEventListener('click', () => {
      let on = false;
      try { on = localStorage.getItem('galax_airi_voice_v1') === '1'; } catch {}
      on = !on;
      try { localStorage.setItem('galax_airi_voice_v1', on ? '1' : '0'); } catch {}
      voice.setAttribute('aria-pressed', String(on));
      GALAX.toast(on ? 'Airi intentará leer sus respuestas en voz alta.' : 'Lectura en voz alta desactivada.', 'info');
    });
    document.addEventListener('galax:settings', () => syncVoice());
    $('#clear-airi').addEventListener('click', () => { try { localStorage.removeItem('galax_airi_history_v1'); } catch {} GALAX.toast('Historial de Airi borrado.', 'info'); });
    $('#clear-local').addEventListener('click', () => {
      GALAX.modal({ title: '¿Borrar datos locales?', body: '<p>Se borrarán carrito, favoritos, perfil y pedidos guardados en este navegador. La cuenta en la nube y los pedidos ya coordinados no se eliminan.</p>', okText: 'Sí, borrar' }).then((yes) => {
        if (!yes) return;
        ['galax_cart_v2', 'galax_favorites_v2', 'galax_local_profile_v1', 'galax_local_orders_v1', 'galax_airi_history_v1'].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
        location.reload();
      });
    });
  });
})();
