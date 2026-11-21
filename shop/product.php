<?php
require_once __DIR__ . '/../includes/repository.php';

$id = max(0, (int)($_GET['id'] ?? 0));
$product = $id > 0 ? product_by_id($id) : null;
if (!$product) {
    http_response_code(404);
    $pageTitle = 'Producto no encontrado';
    require_once __DIR__ . '/../includes/store_header.php';
    echo '<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><h2>Producto no encontrado</h2><p>El producto solicitado no existe o no está publicado.</p><a class="btn btn-primary" href="' . BASE_URL . '/shop/catalog.php">Volver al catálogo</a></div>';
    require_once __DIR__ . '/../includes/store_footer.php';
    exit;
}
$pageTitle = $product['nombre'];
$activeNav = 'catalogo';
$specs = product_specs($product);
$price = effective_price($product);
$related = related_products($product);
require_once __DIR__ . '/../includes/store_header.php';
?>
<nav style="font-size:.82rem;color:var(--gx-muted);margin-bottom:20px;">
  <a href="<?= BASE_URL ?>/shop/index.php" style="color:inherit;">Inicio</a> /
  <a href="<?= BASE_URL ?>/shop/catalog.php" style="color:inherit;">Catálogo</a> /
  <?php if (!empty($product['categoria_slug'])): ?>
  <a href="<?= BASE_URL ?>/shop/catalog.php?cat=<?= (int)$product['categoria_id'] ?>" style="color:inherit;"><?= h($product['categoria']) ?></a> /
  <?php endif; ?>
  <span style="color:#cbd5e1;"><?= h($product['nombre']) ?></span>
</nav>

<div class="detail-grid">
  <div class="detail-gallery">
    <img src="<?= h(product_image_url($product['imagen'])) ?>" alt="<?= h($product['nombre']) ?>">
  </div>
  <div class="detail-info">
    <span class="eyebrow"><?= h($product['codigo']) ?> · <?= h($product['categoria'] ?? 'Producto') ?></span>
    <h1><?= h($product['nombre']) ?></h1>
    <?php if (!empty($product['marca']) || !empty($product['modelo'])): ?>
      <p style="color:var(--gx-muted);margin-top:8px;">
        <?= h(trim(($product['marca'] ?? '') . ' ' . ($product['modelo'] ?? ''))) ?>
      </p>
    <?php endif; ?>
    <div class="detail-price"><?= h(money($price)) ?></div>
    <?php if ($product['precio_oferta'] !== null && (float)$product['precio_oferta'] < (float)$product['precio_venta']): ?>
      <p style="color:#fca5a5;">Antes <?= h(money($product['precio_venta'])) ?> · Ahorras <?= h(money((float)$product['precio_venta'] - $price)) ?></p>
    <?php endif; ?>
    <p class="stock-line <?= (int)$product['stock']>5?'stock-ok':((int)$product['stock']>0?'stock-low':'stock-out') ?>">
      <i class="fa-solid fa-circle"></i>
      <?= (int)$product['stock'] > 0 ? (int)$product['stock'] . ' unidades disponibles' : 'Agotado temporalmente' ?>
    </p>

    <?php if (!empty($product['descripcion'])): ?>
      <div style="margin-top:20px;color:#cbd5e1;line-height:1.7;font-size:.92rem;"><?= nl2br(h($product['descripcion'])) ?></div>
    <?php endif; ?>

    <div style="display:flex;align-items:center;gap:12px;margin-top:24px;flex-wrap:wrap;">
      <?php if ((int)$product['stock'] > 0): ?>
      <div class="qty-control">
        <button type="button" id="qtyMinus" aria-label="Disminuir cantidad">−</button>
        <input type="number" id="qtyInput" value="1" min="1" max="<?= (int)$product['stock'] ?>" aria-label="Cantidad">
        <button type="button" id="qtyPlus" aria-label="Aumentar cantidad">+</button>
      </div>
      <button class="btn btn-glow" type="button" id="addToCart" data-cart-action="add" data-product-id="<?= (int)$product['id'] ?>" data-qty="1">
        <i class="fa-solid fa-cart-plus"></i> Agregar al carrito
      </button>
      <?php else: ?>
      <button class="btn btn-outline" type="button" id="notifyBtn"><i class="fa-solid fa-bell"></i> Consultar disponibilidad</button>
      <?php endif; ?>
    </div>
    <?php if (!empty($product['garantia'])): ?>
      <p style="margin-top:14px;color:#a5b4fc;font-size:.84rem;"><i class="fa-solid fa-shield-halved"></i> Garantía: <?= h($product['garantia']) ?></p>
    <?php endif; ?>
  </div>
</div>

<?php if ($specs): ?>
<section class="section">
  <div class="section-head"><div><span class="eyebrow">Ficha técnica</span><h2>Especificaciones</h2></div></div>
  <div class="card" style="padding:8px 18px;">
    <table class="spec-table">
      <tbody>
        <?php foreach ($specs as $key => $value): ?>
          <?php if (is_array($value)) $value = implode(', ', $value); ?>
          <tr><td><?= h(ucwords(str_replace('_',' ',(string)$key))) ?></td><td><?= h($value) ?></td></tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
<?php endif; ?>

<?php if ($related): ?>
<section class="section">
  <div class="section-head"><div><span class="eyebrow">También te puede interesar</span><h2>Productos relacionados</h2></div></div>
  <div class="products-grid">
    <?php foreach ($related as $r): ?><?= product_card_html($r) ?><?php endforeach; ?>
  </div>
</section>
<?php endif; ?>

<script>
(function () {
  const input = document.getElementById('qtyInput');
  const add = document.getElementById('addToCart');
  const max = input ? parseInt(input.max, 10) : 0;
  function sync() {
    let v = parseInt(input.value, 10) || 1;
    v = Math.max(1, Math.min(max, v));
    input.value = v;
    if (add) add.dataset.qty = String(v);
  }
  document.getElementById('qtyMinus')?.addEventListener('click', () => { input.value = (parseInt(input.value,10)||1) - 1; sync(); });
  document.getElementById('qtyPlus')?.addEventListener('click', () => { input.value = (parseInt(input.value,10)||1) + 1; sync(); });
  input?.addEventListener('input', sync);
  document.getElementById('notifyBtn')?.addEventListener('click', () => {
    window.gxToast ? window.gxToast('Este producto está agotado. Consulte disponibilidad por WhatsApp.') : alert('Producto agotado.');
  });
})();
</script>

<?php require_once __DIR__ . '/../includes/store_footer.php'; ?>
