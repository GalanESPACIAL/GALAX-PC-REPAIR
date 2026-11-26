/* GALAX PC REPAIR — página nosotros */
(function () {
  'use strict';
  GALAX.ready().then(() => {
    const about = GALAX.content.about || {};
    const paragraphs = about.paragraphs && about.paragraphs.length ? about.paragraphs : [about.subtitle || 'GALAX PC REPAIR reúne venta de equipos, componentes y servicio técnico.'];
    document.getElementById('about-paragraphs').innerHTML = paragraphs.map((p) => '<p class="small muted" style="line-height:1.75">' + GALAX.esc(p) + '</p>').join('');
    document.getElementById('about-products').textContent = GALAX.catalog.meta.productCount || GALAX.catalog.products.length;
    document.getElementById('about-brands').textContent = GALAX.catalog.brands.length;
    document.getElementById('about-services').textContent = (GALAX.content.services || []).length;
    ['val-1', 'val-2', 'val-3'].forEach((id) => { const node = document.getElementById(id); if (node) node.innerHTML = GALAX.icon('checkCircle'); });
  });
})();
