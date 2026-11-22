<?php
require_once __DIR__ . '/../includes/repository.php';
$pageTitle = 'Inicio';
$activeNav = 'inicio';
$company = company_info();

$WHATSAPP_DEFAULT = 'https://chat.whatsapp.com/I7Syor85Jia6lfE6oIJ7tX?s=sh&p=a&iam=2//de';
$visible = static function (string $key): bool {
    return config_value($key, '1') !== '0';
};

$featured = catalog_products(['destacado' => 1, 'per_page' => 8])['rows'];
if (!$featured) {
    $featured = catalog_products(['per_page' => 8])['rows'];
}
$offers = catalog_products(['oferta' => 1, 'per_page' => 8])['rows'];
$services = services_list();
$categories = categories_list();
$stats = getStats();

$resolveUrl = static function ($value, string $default): string {
    $value = trim((string)$value);
    if ($value === '') {
        return $default;
    }
    return str_starts_with($value, '/') ? BASE_URL . $value : $value;
};

$heroTitle = config_value('hero_title', 'Tecnología que');
$heroHighlight = config_value('hero_highlight', 'sí funciona');
$heroText = config_value('hero_text', 'Componentes y equipos con stock real, reparación técnica especializada y un asistente que te orienta con datos de nuestro catálogo. Todo en un solo lugar.');
$whatsappUrl = config_value('whatsapp_url', $WHATSAPP_DEFAULT);
require_once __DIR__ . '/../includes/store_header.php';
?>
<section class="hero">
  <div class="hero-grid">
    <div>
      <span class="eyebrow"><?= h(config_value('hero_eyebrow', 'Venta · Reparación · Asistencia')) ?></span>
      <h1><?= h($heroTitle) ?> <span class="gradient-text"><?= h($heroHighlight) ?></span></h1>
      <p><?= h($heroText) ?></p>
      <div class="hero-actions">
        <?php if (config_value('hero_primary_text', '') !== ''): ?>
          <a class="btn btn-glow" href="<?= h($resolveUrl(config_value('hero_primary_url', ''), BASE_URL . '/shop/catalog.php')) ?>"><i class="fa-solid fa-store"></i> <?= h(config_value('hero_primary_text', 'Ver catálogo')) ?></a>
        <?php else: ?>
          <a class="btn btn-glow" href="<?= BASE_URL ?>/shop/catalog.php"><i class="fa-solid fa-store"></i> Ver catálogo</a>
        <?php endif; ?>
        <?php if (config_value('hero_secondary_text', '') !== ''): ?>
          <a class="btn btn-outline" href="<?= h($resolveUrl(config_value('hero_secondary_url', ''), BASE_URL . '/shop/repair_request.php')) ?>"><i class="fa-solid fa-laptop-medical"></i> <?= h(config_value('hero_secondary_text', 'Reparar mi equipo')) ?></a>
        <?php else: ?>
          <a class="btn btn-outline" href="<?= BASE_URL ?>/shop/repair_request.php"><i class="fa-solid fa-laptop-medical"></i> Reparar mi equipo</a>
        <?php endif; ?>
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

<?php $bannerImage = trim((string)config_value('banner_image', '')); ?>
<?php if ($bannerImage !== ''): ?>
<section class="promo-banner" style="background-image:linear-gradient(90deg,rgba(8,13,31,.92),rgba(8,13,31,.35)),url('<?= h(product_image_url($bannerImage)) ?>');">
  <div class="promo-banner-content">
    <span class="eyebrow">Promoción destacada</span>
    <h2><?= h(config_value('banner_title', 'Tecnología a tu alcance')) ?></h2>
    <p><?= h(config_value('banner_text', 'Descubre nuestros productos y servicios con precios reales y stock disponible.')) ?></p>
    <a class="btn btn-glow" href="<?= h($resolveUrl(config_value('banner_url', ''), BASE_URL . '/shop/catalog.php?oferta=1')) ?>">
      <?= h(config_value('banner_button_text', 'Ver ofertas')) ?> <i class="fa-solid fa-arrow-right"></i>
    </a>
  </div>
</section>
<?php endif; ?>

<?php if ($visible('section_categorias_visible')): ?>
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
<?php endif; ?>

<?php if ($visible('section_destacados_visible')): ?>
<section class="section">
  <div class="section-head">
    <div><span class="eyebrow">Selección real</span><h2>Productos destacados</h2><p>Sin stock ficticio: solo lo que existe en nuestro inventario.</p></div>
    <a class="chip" href="<?= BASE_URL ?>/shop/catalog.php">Ver catálogo completo <i class="fa-solid fa-arrow-right"></i></a>
  </div>
  <?php if (!$featured): ?>
    <div class="empty-state"><i class="fa-solid fa-box-open"></i><h3>El catálogo aún no tiene productos publicados</h3><p>Cuando se registren productos, aparecerán aquí automáticamente.</p></div>
  <?php else: ?>
  <div class="products-grid">
    <?php foreach ($featured as $p): ?><?= product_card_html($p) ?><?php endforeach; ?>
  </div>
  <?php endif; ?>
</section>
<?php endif; ?>

<?php if ($visible('section_ofertas_visible')): ?>
<section class="section" id="ofertas">
  <div class="section-head">
    <div><span class="eyebrow">Ofertas especiales</span><h2><?= h(config_value('ofertas_title', 'Precios que convienen')) ?></h2><p><?= h(config_value('ofertas_text', 'Productos con precio promocional, equipos recomendados y novedades.')) ?></p></div>
    <a class="chip" href="<?= BASE_URL ?>/shop/catalog.php?oferta=1">Ver todas las ofertas <i class="fa-solid fa-arrow-right"></i></a>
  </div>
  <?php if ($offers): ?>
    <div class="products-grid">
      <?php foreach ($offers as $p): ?><?= product_card_html($p) ?><?php endforeach; ?>
    </div>
  <?php else: ?>
    <div class="empty-state"><i class="fa-solid fa-tags"></i><h3>Próximamente nuevas promociones</h3><p>El administrador puede publicar precios promocionales desde el panel de productos.</p></div>
  <?php endif; ?>
  <div class="offer-links">
    <a class="chip" href="<?= BASE_URL ?>/shop/catalog.php?destacado=1"><i class="fa-solid fa-star"></i> Destacados</a>
    <a class="chip" href="<?= BASE_URL ?>/shop/catalog.php?nuevo=1"><i class="fa-solid fa-sparkles"></i> Novedades</a>
    <a class="chip" href="<?= BASE_URL ?>/shop/catalog.php?orden=precio_asc"><i class="fa-solid fa-arrow-trend-down"></i> Menor precio</a>
  </div>
</section>
<?php endif; ?>

<?php if ($visible('section_servicios_visible')): ?>
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
<?php endif; ?>

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

<?php if ($visible('section_whatsapp_visible')): ?>
<section class="section" id="comunidad">
  <div class="whatsapp-cta">
    <div class="whatsapp-icon"><i class="fa-brands fa-whatsapp"></i></div>
    <div>
      <span class="eyebrow">Comunidad</span>
      <h2><?= h(config_value('whatsapp_title', 'Únete a nuestra comunidad de GALAX PC REPAIR')) ?></h2>
      <p><?= h(config_value('whatsapp_text', 'Mantente informado sobre novedades tecnológicas, productos, ofertas y noticias de nuestra comunidad.')) ?></p>
    </div>
    <a class="btn btn-whatsapp" href="<?= h($whatsappUrl) ?>" target="_blank" rel="noopener noreferrer">
      <i class="fa-brands fa-whatsapp"></i> UNIRME AL GRUPO DE WHATSAPP
    </a>
  </div>
</section>
<?php endif; ?>

<?php if ($visible('section_tesis_visible')): ?>
<section class="section project-section" id="sobre-el-proyecto">
  <div class="section-head">
    <div><span class="eyebrow">Memoria del proyecto</span><h2>SOBRE EL PROYECTO GALAX PC REPAIR</h2></div>
  </div>
  <div class="project-grid">
    <article class="project-card">
      <h3><i class="fa-solid fa-book-open"></i> Introducción</h3>
      <p><?= h(config_value('tesis_intro', 'GALAX PC REPAIR es un proyecto desarrollado con la visión de crear una plataforma tecnológica que integre comercio electrónico, servicios informáticos, gestión de productos, soporte técnico y herramientas digitales en un solo entorno.')) ?></p>
    </article>
    <article class="project-card">
      <h3><i class="fa-solid fa-bullseye"></i> Objetivo general</h3>
      <p><?= h(config_value('tesis_objetivo', 'Construir una solución que permita ofrecer productos y servicios informáticos de manera organizada, moderna y accesible.')) ?></p>
    </article>
    <article class="project-card">
      <h3><i class="fa-solid fa-list-check"></i> Objetivos específicos</h3>
      <p><?= nl2br(h(config_value('tesis_objetivos_especificos', "Integrar catálogo, carrito y pedidos en una sola plataforma.\nOfrecer seguimiento de reparaciones y soporte técnico.\nBrindar herramientas de administración sin editar código."))) ?></p>
    </article>
    <article class="project-card">
      <h3><i class="fa-solid fa-layer-group"></i> Descripción de la plataforma</h3>
      <p><?= h(config_value('tesis_descripcion', 'Esta plataforma nace del interés por la programación, el desarrollo web y los sistemas de información. Reúne tienda, inventario, reparaciones, soporte y asistente inteligente en un entorno organizado y accesible.')) ?></p>
    </article>
    <article class="project-card">
      <h3><i class="fa-solid fa-code"></i> Tecnologías utilizadas</h3>
      <p><?= h(config_value('tesis_tecnologias', 'PHP, JavaScript, HTML y CSS; Supabase (autenticación, base de datos PostgreSQL y almacenamiento); diseño responsive; servicios REST y asistente con modelo local.')) ?></p>
    </article>
    <article class="project-card">
      <h3><i class="fa-solid fa-flag-checkered"></i> Conclusión</h3>
      <p><?= h(config_value('tesis_conclusion', 'GALAX PC REPAIR representa mi esfuerzo, aprendizaje, creatividad y compromiso con el desarrollo tecnológico.')) ?></p>
    </article>
  </div>
  <div class="project-author">
    <i class="fa-solid fa-user-pen"></i>
    <span>Creador: <strong><?= h(config_value('tesis_autor', 'Pedro Aldair Arribasplata')) ?></strong></span>
  </div>
</section>
<?php endif; ?>

<?php require_once __DIR__ . '/../includes/store_footer.php'; ?>
