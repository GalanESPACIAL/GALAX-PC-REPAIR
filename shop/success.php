<?php
require_once __DIR__ . '/../includes/repository.php';
$pageTitle = 'Pedido confirmado';
$activeNav = 'portal';
$orderId = max(0, (int)($_GET['pedido'] ?? 0));
if (isLoggedIn()) {
    $order = order_by_id($orderId, isStaff() ? null : (int)$_SESSION['user_id']);
} else {
    $order = guest_order_granted($orderId) ? order_by_id($orderId) : null;
}
if (!$order) {
    http_response_code(404);
    $pageTitle = 'Pedido no encontrado';
    require_once __DIR__ . '/../includes/store_header.php';
    echo '<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><h2>Pedido no encontrado</h2><p>No encontramos un pedido asociado a su cuenta.</p><a class="btn btn-primary" href="' . BASE_URL . '/shop/portal.php">Ir a mi cuenta</a></div>';
    require_once __DIR__ . '/../includes/store_footer.php';
    exit;
}
$details = order_details($orderId);
require_once __DIR__ . '/../includes/store_header.php';
?>
<div class="empty-state" style="padding:36px 20px;">
  <i class="fa-solid fa-circle-check" style="color:#34d399;opacity:1;"></i>
  <h2 style="color:#fff;">¡Pedido confirmado!</h2>
  <p>Su pedido <strong style="color:#67e8f9;"><?= h($order['codigo']) ?></strong> fue registrado correctamente.</p>
</div>

<div class="cart-layout" style="max-width:900px;margin:0 auto;">
  <section class="card" style="padding:22px;">
    <h2 class="form-section-title" style="margin-top:0;"><i class="fa-solid fa-list-check"></i> Resumen del pedido</h2>
    <p style="color:var(--gx-muted);font-size:.85rem;">Registrado el <?= h(fecha($order['creado_en'])) ?> · Estado: <?= badgeEstado($order['estado']) ?></p>
    <table class="table" style="margin-top:16px;">
      <thead><tr><th>Producto</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
      <tbody>
        <?php foreach ($details as $d): ?>
        <tr>
          <td><?= h($d['nombre_producto']) ?><br><small style="color:var(--gx-muted);"><?= h($d['sku']) ?></small></td>
          <td><?= (int)$d['cantidad'] ?></td>
          <td><?= h(money($d['precio_unitario'])) ?></td>
          <td><strong><?= h(money($d['subtotal'])) ?></strong></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <div class="summary-row total" style="max-width:280px;margin-left:auto;"><span>Total</span><span><?= h(money($order['total'])) ?></span></div>
  </section>

  <aside class="card" style="padding:22px;">
    <h3 style="font-size:1.05rem;"><i class="fa-solid fa-file-image"></i> Comprobante</h3>
    <p style="color:var(--gx-muted);font-size:.85rem;margin:10px 0 16px;">Descargue o abra su comprobante en formato PNG.</p>
    <a class="btn btn-glow" style="width:100%;justify-content:center;" href="<?= BASE_URL ?>/shop/receipt.php?pedido=<?= (int)$order['id'] ?>&download=1"><i class="fa-solid fa-download"></i> Descargar boleta PNG</a>
    <a class="btn btn-outline" style="width:100%;justify-content:center;margin-top:9px;" href="<?= BASE_URL ?>/shop/receipt.php?pedido=<?= (int)$order['id'] ?>" target="_blank" rel="noopener"><i class="fa-solid fa-eye"></i> Ver comprobante PNG</a>
    <a class="btn btn-outline" style="width:100%;justify-content:center;margin-top:9px;" href="<?= BASE_URL ?>/shop/portal.php"><i class="fa-solid fa-user"></i> Ir a mi cuenta</a>
    <a class="chip" style="margin-top:16px;" href="<?= BASE_URL ?>/shop/catalog.php"><i class="fa-solid fa-store"></i> Seguir comprando</a>
  </aside>
</div>

<?php require_once __DIR__ . '/../includes/store_footer.php'; ?>
