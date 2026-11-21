<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('ventas');
$pageTitle = 'Ventas';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'anular') {
    require_csrf();
    $id = (int)($_POST['id'] ?? 0);
    $db = db();
    $stmt = $db->prepare("SELECT estado FROM ventas WHERE id=? LIMIT 1");
    $stmt->execute([$id]);
    $estado = $stmt->fetchColumn();
    if ($estado === false) {
        flash('error', 'Venta no encontrada.');
    } elseif ($estado === 'cancelado') {
        flash('error', 'La venta ya está anulada.');
    } else {
        $db->beginTransaction();
        try {
            $det = $db->prepare("SELECT producto_id,cantidad FROM detalle_ventas WHERE venta_id=?");
            $det->execute([$id]);
            $details = $det->fetchAll();
            $restore = $db->prepare("UPDATE productos SET stock=stock+? WHERE id=?");
            $mov = $db->prepare("INSERT INTO inventario_movimientos (producto_id,tipo,cantidad,stock_anterior,stock_nuevo,motivo,documento,usuario_id) SELECT id,'cancelacion',?,stock,stock+?,?,?,? FROM productos WHERE id=?");
            foreach ($details as $d) {
                $restore->execute([$d['cantidad'], $d['producto_id']]);
                $mov->execute([$d['cantidad'], $d['cantidad'], 'Anulación de venta #' . $id, (string)$id, (int)$_SESSION['user_id'], $d['producto_id']]);
            }
            $db->prepare("UPDATE ventas SET estado='cancelado' WHERE id=?")->execute([$id]);
            $db->commit();
            audit_log('cancel_sale', 'ventas', $id);
            flash('success', 'Venta anulada y stock restaurado.');
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            error_log('[GALAX][CANCEL_SALE] ' . $e->getMessage());
            flash('error', 'No se pudo anular la venta.');
        }
    }
    redirect(BASE_URL . '/modules/sales/index.php');
}

$ventas = db()->query("SELECT v.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido, u.nombre as vendedor FROM ventas v JOIN clientes c ON v.cliente_id=c.id JOIN usuarios u ON v.usuario_id=u.id ORDER BY v.id DESC")->fetchAll();
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-cart-shopping"></i> Historial de Ventas</div>
    <a href="<?= BASE_URL ?>/modules/sales/create.php" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Nueva Venta</a>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Código</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Método</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
      <tbody>
      <?php if (empty($ventas)): ?>
        <tr><td colspan="8" style="text-align:center;color:var(--muted);">Sin ventas registradas</td></tr>
      <?php else: foreach ($ventas as $v): ?>
        <tr>
          <td><strong><?= h($v['codigo']) ?></strong></td>
          <td><?= h($v['cliente_nombre'].' '.$v['cliente_apellido']) ?></td>
          <td><?= h($v['vendedor']) ?></td>
          <td><?= money($v['total']) ?></td>
          <td><?= h(ucfirst($v['metodo_pago'])) ?></td>
          <td><?= badgeEstado($v['estado']) ?></td>
          <td><?= fecha($v['created_at']) ?></td>
          <td style="display:flex;gap:6px;">
            <a href="<?= BASE_URL ?>/modules/sales/view.php?id=<?= (int)$v['id'] ?>" class="btn btn-info btn-sm btn-icon" title="Ver"><i class="fa-solid fa-eye"></i></a>
            <?php if ($v['estado'] !== 'cancelado'): ?>
            <form method="post" onsubmit="return confirm('¿Anular esta venta y restaurar el stock?')" style="margin:0;">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="anular">
              <input type="hidden" name="id" value="<?= (int)$v['id'] ?>">
              <button class="btn btn-danger btn-sm btn-icon" title="Anular" type="submit"><i class="fa-solid fa-ban"></i></button>
            </form>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
