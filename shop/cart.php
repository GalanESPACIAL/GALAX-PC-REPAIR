<?php
require_once __DIR__ . '/../includes/repository.php';
$pageTitle = 'Carrito';
$activeNav = 'catalogo';
$cart = cart_totals();
$rows = $cart['items'];
$canUndo = false;
try {
    $stmt = db()->prepare('SELECT COUNT(*) FROM carrito_historial WHERE carrito_id=?');
    $stmt->execute([cart_id()]);
    $canUndo = (int)$stmt->fetchColumn() >= 1;
} catch (Throwable $e) {}
require_once __DIR__ . '/../includes/store_header.php';
?>
<div class="section-head" style="margin-top:6px;">
  <div><span class="eyebrow">Tu compra</span><h1 style="font-size:2rem;">Carrito de compras</h1><p>El precio final se calcula en el servidor al confirmar el pedido.</p></div>
  <a class="chip" href="<?= BASE_URL ?>/shop/catalog.php"><i class="fa-solid fa-arrow-left"></i> Seguir comprando</a>
</div>

<?php if ($canUndo): ?>
<div class="undo-bar">
  <span><i class="fa-solid fa-rotate-left"></i> ¿Eliminaste algo por error? Puedes restaurar el estado anterior del carrito.</span>
  <button class="btn btn-outline btn-sm" type="button" data-cart-action="undo"><i class="fa-solid fa-undo"></i> Deshacer última acción</button>
</div>
<?php endif; ?>

<?php if (!$rows): ?>
  <div class="empty-state">
    <i class="fa-solid fa-cart-shopping"></i>
    <h2>Tu carrito está vacío</h2>
    <p>Explora el catálogo y agrega los productos que necesites.</p>
    <a class="btn btn-glow" href="<?= BASE_URL ?>/shop/catalog.php"><i class="fa-solid fa-store"></i> Ir al catálogo</a>
  </div>
<?php else: ?>
<div class="cart-layout">
  <div class="card" style="padding:0;overflow:hidden;">
    <?php foreach ($rows as $item): ?>
    <?php
      $lineTotal = (float)$item['precio'] * (int)$item['cantidad'];
      $url = BASE_URL . '/shop/product.php?id=' . (int)$item['producto_id'] . ($item['slug'] ? '&slug=' . rawurlencode($item['slug']) : '');
    ?>
    <div class="cart-item">
      <div class="cart-thumb">
        <img src="<?= h(product_image_url($item['imagen'])) ?>" alt="<?= h($item['nombre']) ?>">
      </div>
      <div>
        <strong style="font-size:.92rem;"><a href="<?= h($url) ?>" style="color:inherit;text-decoration:none;"><?= h($item['nombre']) ?></a></strong>
        <div style="color:var(--gx-muted);font-size:.76rem;margin-top:3px;"><?= h($item['codigo']) ?> · <?= h($item['marca'] ?? '') ?></div>
        <div style="color:#67e8f9;font-size:.84rem;font-weight:700;margin-top:5px;"><?= h(money($item['precio'])) ?> c/u</div>
        <?php if ((int)$item['cantidad'] > (int)$item['stock']): ?>
          <div style="color:#fca5a5;font-size:.76rem;margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> Stock insuficiente (<?= (int)$item['stock'] ?>)</div>
        <?php endif; ?>
      </div>
      <div class="qty-control">
        <button type="button" data-cart-action="update" data-product-id="<?= (int)$item['producto_id'] ?>" data-qty="<?= max(0,(int)$item['cantidad']-1) ?>" aria-label="Disminuir">−</button>
        <input type="number" value="<?= (int)$item['cantidad'] ?>" min="0" max="99" data-qty-input="<?= (int)$item['producto_id'] ?>" aria-label="Cantidad">
        <button type="button" data-cart-action="update" data-product-id="<?= (int)$item['producto_id'] ?>" data-qty="<?= min(99,(int)$item['cantidad']+1) ?>" aria-label="Aumentar">+</button>
      </div>
      <strong class="item-subtotal" style="white-space:nowrap;"><?= h(money($lineTotal)) ?></strong>
      <button class="btn btn-outline btn-sm" type="button" data-cart-action="remove" data-product-id="<?= (int)$item['producto_id'] ?>" title="Eliminar" aria-label="Eliminar <?= h($item['nombre']) ?>"><i class="fa-solid fa-trash"></i></button>
    </div>
    <?php endforeach; ?>
  </div>

  <aside class="card" style="padding:20px;position:sticky;top:86px;">
    <h3 style="font-size:1.05rem;margin-bottom:14px;"><i class="fa-solid fa-receipt"></i> Resumen</h3>
    <div class="summary-row"><span>Subtotal</span><strong><?= h(money($cart['subtotal'])) ?></strong></div>
    <?php if ($cart['descuento'] > 0): ?>
    <div class="summary-row" style="color:#34d399;"><span>Descuento (<?= (float)$cart['descuento_pct'] ?>%)</span><strong>−<?= h(money($cart['descuento'])) ?></strong></div>
    <?php endif; ?>
    <div class="summary-row"><span>Impuestos (<?= (float)config_value('igv_porcentaje',18) ?>%)</span><strong><?= h(money($cart['impuestos'])) ?></strong></div>
    <div class="summary-row"><span>Envío</span><strong><?= $cart['envio'] > 0 ? h(money($cart['envio'])) : 'Se calcula al confirmar' ?></strong></div>
    <div class="summary-row total"><span>Total estimado</span><span><?= h(money($cart['total'])) ?></span></div>
    <a class="btn btn-glow" style="width:100%;justify-content:center;margin-top:18px;" href="<?= BASE_URL ?>/shop/checkout.php"><i class="fa-solid fa-credit-card"></i> Confirmar pedido</a>
    <button class="btn btn-outline" style="width:100%;justify-content:center;margin-top:8px;" type="button" data-cart-action="clear"><i class="fa-solid fa-trash-can"></i> Vaciar carrito</button>
    <p style="color:var(--gx-muted);font-size:.73rem;margin-top:14px;line-height:1.6;">El precio final, impuestos y envío se recalculan en el servidor cuando confirmes tu pedido. El stock se descuenta solo al confirmar.</p>
  </aside>
</div>
<?php endif; ?>

<script>
document.querySelectorAll('[data-qty-input]').forEach(function (input) {
  input.addEventListener('change', function () {
    const synthetic = document.createElement('button');
    synthetic.type = 'button';
    synthetic.hidden = true;
    synthetic.dataset.cartAction = 'update';
    synthetic.dataset.productId = input.dataset.qtyInput;
    synthetic.dataset.qty = String(Math.max(0, parseInt(input.value, 10) || 0));
    document.body.appendChild(synthetic);
    synthetic.click();
    synthetic.remove();
  });
});
</script>

<?php require_once __DIR__ . '/../includes/store_footer.php'; ?>
