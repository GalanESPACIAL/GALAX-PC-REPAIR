/* GALAX PC REPAIR — favoritos locales y sincronizados */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  function render() {
    const codes = GALAX.state.favorites;
    const products = codes.map((c) => GALAX.getProduct(c)).filter((p) => p && p.published);
    const grid = $('#favorites-grid');
    const empty = $('#favorites-empty');
    grid.innerHTML = products.map((p) => GALAX.productCard(p)).join('');
    grid.hidden = !products.length;
    empty.hidden = Boolean(products.length);
    const status = $('#favorites-status');
    const cloud = GALAX.cloud && GALAX.cloud.configured();
    if (cloud && GALAX.cloudUser) {
      status.innerHTML = '<div class="info-box" style="margin-bottom:14px">' + GALAX.icon('checkCircle', 'icon-sm') + '<div>Favoritos sincronizados con tu cuenta. ' + (products.length ? products.length + ' guardados.' : 'Marca productos para verlos aquí y en otros dispositivos.') + '</div></div>';
    } else if (cloud) {
      status.innerHTML = '<div class="info-box" style="margin-bottom:14px">' + GALAX.icon('info', 'icon-sm') + '<div>Estos favoritos están guardados en este dispositivo. <a href="cuenta.html" style="color:var(--gx-cyan)">Inicia sesión</a> para sincronizarlos con tu cuenta.</div></div>';
    } else {
      status.innerHTML = '<div class="info-box" style="margin-bottom:14px">' + GALAX.icon('info', 'icon-sm') + '<div>Modo local: los favoritos se guardan en este navegador. La sincronización en la nube se activa cuando el proyecto Supabase está configurado.</div></div>';
    }
    GALAX.renderFavoriteButtons();
  }
  GALAX.ready().then(() => {
    $('#fav-empty-icon').innerHTML = GALAX.icon('heart');
    render();
    document.addEventListener('galax:favorites', render);
    document.addEventListener('galax:auth', render);
  });
})();
