<?php
require_once __DIR__ . '/../includes/repository.php';
$pageTitle = 'Inicio';
$activeNav = 'inicio';
$company = company_info();
$featured = catalog_products(['destacado' => 1, 'per_page' => 8])['rows'];
if (!$featured) {
    $featured = catalog_products(['per_page' => 8])['rows'];
}
$services = services_list();
$categories = categories_list();
$stats = getStats();
require_once __DIR__ . '/../includes/store_header.php';
?>
<section class="hero">
  <div class="hero-grid">
    <div>
      <span class="eyebrow">Venta · Reparación · Asistencia</span>
      <h1>Tecnología que <span class="gradient-text">sí funciona</span></h1>
      <p>Componentes y equipos con stock real, reparación técnica especializada y un asistente que te orienta con datos de nuestro catálogo. Todo en un solo lugar.</p>
      <div class="hero-actions">
        <a class="btn btn-glow" href="<?= BASE_URL ?>/shop/catalog.php"><i class="fa-solid fa-store"></i> Ver catálogo</a>
        <a class="btn btn-outline" href="<?= BASE_URL ?>/shop/repair_request.php"><i class="fa-solid fa-laptop-medical"></i> Reparar mi equipo</a>
      </div>
      <div class="hero-badges">
        <span><i class="fa-solid fa-boxes-stacked"></i> <?= (int)$stats['productos'] ?> productos en stock</span>
        <span><i class="fa-solid fa-screwdriver-wrench"></i> <?= (int)$stats['reparaciones_activas'] ?> reparaciones activas</span>
        <span><i class="fa-solid fa-shield-halved"></i> Garantía en cada compra</span>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="orb"><i class="fa-solid fa-microchip"></i></div>
    </div>
  </div>
</section>

<section class="section" id="categorias">
  <div class="section-head">
    <div><span class="eyebrow">Explorar</span><h2>Compra por categoría</h2><p>Precios y disponibilidad actualizados desde el inventario.</p></div>
    <a class="chip" href="<?= BASE_URL ?>/shop/catalog.php">Ver todo <i class="fa-solid fa-arrow-right"></i></a>
  </div>
  <div class="grid-auto">
    <?php foreach (array_slice($categories, 0, 12) as $cat): ?>
    <a class="category-tile" href="<?= BASE_URL ?>/shop/catalog.php?cat=<?= (int)$cat['id'] ?>">
      <i class="fa-solid <?= h(preg_match('/^fa-/', (string)($cat['icono'] ?? '')) ? $cat['icono'] : 'fa-layer-group') ?>"></i>
      <span><strong><?= h($cat['nombre']) ?></strong><small><?= (int)($cat['productos'] ?? 0) ?> productos</small></span>
    </a>
    <?php endforeach; ?>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <div><span class="eyebrow">Selección real</span><h2>Productos destacados</h2><p>Sin stock ficticio: solo lo que existe en nuestro inventario.</p></div>
    <a class="chip" href="<?= BASE_URL ?>/shop/catalog.php">Ver catálogo completo <i class="fa-solid fa-arrow-right"></i></a>
  </div>
  <?php if (!$featured): ?>
    <div class="empty-state"><i class="fa-solid fa-box-open"></i><h3>El catálogo aún no tiene productos publicados</h3><p>Cuando se registren productos, aparecerán aquí automáticamente.</p></div>
  <?php else: ?>
  <div class="products-grid">
    <?php foreach ($featured as $p): ?>
      <?= product_card_html($p) ?>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</section>

<section class="section" id="servicios">
  <div class="section-head">
    <div><span class="eyebrow">Taller técnico</span><h2>Nuestros servicios</h2><p>Diagnóstico y reparación con seguimiento del estado de tu equipo.</p></div>
    <a class="chip" href="<?= BASE_URL ?>/shop/repair_request.php">Solicitar reparación <i class="fa-solid fa-arrow-right"></i></a>
  </div>
  <div class="grid-auto">
    <?php foreach ($services as $s): ?>
    <article class="feature">
      <div class="ico"><i class="fa-solid <?= h(preg_match('/^fa-/', (string)$s['icono']) ? $s['icono'] : 'fa-microchip') ?>"></i></div>
      <h3><?= h($s['nombre']) ?></h3>
      <p><?= h($s['descripcion']) ?></p>
      <?php if ((float)$s['precio_desde'] > 0): ?><p style="margin-top:8px;color:#67e8f9;font-weight:700;">Desde <?= money($s['precio_desde']) ?></p><?php endif; ?>
    </article>
    <?php endforeach; ?>
  </div>
</section>

<section class="section">
  <div class="hero" style="min-height:auto;padding:36px 40px;">
    <div class="hero-grid" style="grid-template-columns:1fr;">
      <div>
        <span class="eyebrow">¿Necesitas ayuda?</span>
        <h2 style="font-size:1.8rem;">Pregúntale a Airi</h2>
        <p>Usa el ícono de chat en la esquina para buscar productos o conocer nuestros servicios. Las respuestas se generan a partir de datos reales; si el modelo local no está activo, verás una búsqueda de catálogo claramente identificada.</p>
      </div>
    </div>
  </div>
</section>

<?php require_once __DIR__ . '/../includes/store_footer.php'; ?>
