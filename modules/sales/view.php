<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('ventas');
$pageTitle = 'Detalle de Venta';
$id = (int)($_GET['id'] ?? 0);
$stmt = db()->prepare("SELECT v.*, c.nombre as cn, c.apellido as ca, c.email as ce, c.telefono as ct, u.nombre as vn, u.apellido as va FROM ventas v JOIN clientes c ON v.cliente_id=c.id JOIN usuarios u ON v.usuario_id=u.id WHERE v.id=?");
$stmt->execute([$id]);
$v = $stmt->fetch();
if (!$v) { flash('error','Venta no encontrada'); redirect(SITE_URL.'/modules/sales/index.php'); }
$det = db()->prepare("SELECT d.*, p.nombre as pn, p.codigo as pc FROM detalle_ventas d JOIN productos p ON d.producto_id=p.id WHERE d.venta_id=?");
$det->execute([$id]);
$items = $det->fetchAll();
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card" style="max-width:900px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-receipt"></i> Venta <?= h($v['codigo']) ?></div>
    <a href="<?= SITE_URL ?>/modules/sales/index.php" class="btn btn-ghost btn-sm"><i class="fa-solid fa-arrow-left"></i> Volver</a>
  </div>
  <div class="grid grid-2" style="margin-bottom:18px;">
    <div>
      <p><strong>Cliente:</strong> <?= h($v['cn'].' '.$v['ca']) ?></p>
      <p><strong>Email:</strong> <?= h($v['ce']) ?></p>
      <p><strong>Telefono:</strong> <?= h($v['ct']) ?></p>
    </div>
    <div>
      <p><strong>Vendedor:</strong> <?= h($v['vn'].' '.$v['va']) ?></p>
      <p><strong>Metodo pago:</strong> <?= ucfirst($v['metodo_pago']) ?></p>
      <p><strong>Estado:</strong> <?= badgeEstado($v['estado']) ?></p>
      <p><strong>Fecha:</strong> <?= fecha($v['created_at']) ?></p>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Codigo</th><th>Producto</th><th>Cantidad</th><th>P. Unitario</th><th>Subtotal</th></tr></thead>
      <tbody>
      <?php foreach ($items as $it): ?>
        <tr>
          <td><?= h($it['pc']) ?></td>
          <td><?= h($it['pn']) ?></td>
          <td><?= $it['cantidad'] ?></td>
          <td><?= money($it['precio_unitario']) ?></td>
          <td><?= money($it['subtotal']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div style="margin-top:16px;text-align:right;">
    <p><strong>Subtotal:</strong> <?= money($v['subtotal']) ?></p>
    <p><strong>IGV (18%):</strong> <?= money($v['igv']) ?></p>
    <p style="font-size:1.2rem;"><strong>Total:</strong> <?= money($v['total']) ?></p>
    <?php if ($v['notas']): ?><p style="color:var(--muted);margin-top:8px;"><strong>Notas:</strong> <?= h($v['notas']) ?></p><?php endif; ?>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
