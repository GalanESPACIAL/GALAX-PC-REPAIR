<?php
/**
 * GALAX PC REPAIR — Detalle administrativo de un pedido online.
 */
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('pedidos');

$pageTitle = 'Detalle de Pedido';
$id = (int)($_GET['id'] ?? 0);

$stmt = db()->prepare(
    'SELECT p.*, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido
       FROM pedidos p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.id = ? LIMIT 1'
);
$stmt->execute([$id]);
$pedido = $stmt->fetch();
if (!$pedido) {
    flash('error', 'Pedido no encontrado.');
    redirect(BASE_URL . '/modules/orders/index.php');
}

$transiciones = [
    'pendiente'  => ['confirmado', 'cancelado'],
    'confirmado' => ['preparando', 'cancelado'],
    'preparando' => ['completado', 'cancelado'],
    'completado' => [],
    'cancelado'  => [],
];

/* ------------------------------------------------------------------ */
/* Cambio de estado — CSRF, transición válida y auditoría               */
/* ------------------------------------------------------------------ */

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    require_csrf();
    if (($_POST['action'] ?? '') === 'estado') {
        $nuevo = (string)($_POST['estado'] ?? '');
        $actual = $pedido['estado'];
        if (!in_array($nuevo, $transiciones[$actual] ?? [], true)) {
            flash('error', 'La transición desde ' . ucfirst($actual) . ' a ' . ucfirst($nuevo) . ' no está permitida.');
        } else {
            db()->prepare('UPDATE pedidos SET estado = ?, actualizado_en = NOW() WHERE id = ?')
                ->execute([$nuevo, $id]);
            audit_log(
                'pedido_estado_cambiado',
                'pedidos',
                $id,
                $pedido['codigo'] . ' | ' . $actual . ' -> ' . $nuevo
            );
            flash('success', 'Pedido ' . $pedido['codigo'] . ' actualizado a ' . ucfirst($nuevo) . '.');
        }
    } else {
        flash('error', 'Acción no reconocida.');
    }
    redirect(BASE_URL . '/modules/orders/view.php?id=' . $id);
}

$stmt = db()->prepare(
    'SELECT d.*, pr.codigo AS producto_codigo, pr.nombre AS producto_actual, pr.stock AS stock_actual
       FROM pedido_detalles d
       LEFT JOIN productos pr ON pr.id = d.producto_id
      WHERE d.pedido_id = ?
      ORDER BY d.id ASC'
);
$stmt->execute([$id]);
$detalles = $stmt->fetchAll();

$pasos = ['pendiente', 'confirmado', 'preparando', 'completado'];
$indiceActual = array_search($pedido['estado'], $pasos, true);
$opciones = $transiciones[$pedido['estado']] ?? [];

require_once __DIR__ . '/../../includes/header.php';
echo '<link rel="stylesheet" href="' . h(BASE_URL . '/assets/css/theme.css') . '">';
?>
<div class="card">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-receipt"></i> Pedido <?= h($pedido['codigo']) ?></div>
    <a class="btn btn-ghost btn-sm" href="<?= h(BASE_URL . '/modules/orders/index.php') ?>"><i class="fa-solid fa-arrow-left"></i> Volver</a>
  </div>

  <div class="grid grid-2" style="margin-bottom:18px;">
    <div>
      <h3 style="margin-bottom:8px;"><?= h($pedido['nombre_cliente']) ?></h3>
      <div class="summary-row"><span>Email</span><strong><?= h($pedido['email_cliente']) ?></strong></div>
      <div class="summary-row"><span>Teléfono</span><strong><?= h($pedido['telefono_cliente'] ?: '-') ?></strong></div>
      <div class="summary-row"><span>Documento</span><strong><?= h($pedido['documento'] ?: '-') ?></strong></div>
      <div class="summary-row"><span>Dirección</span><strong><?= h($pedido['direccion'] ?: '-') ?></strong></div>
      <div class="summary-row"><span>Referencia</span><strong><?= h($pedido['referencia'] ?: '-') ?></strong></div>
    </div>
    <div>
      <div class="summary-row"><span>Estado actual</span><strong><?= badgeEstado($pedido['estado']) ?></strong></div>
      <div class="summary-row"><span>Creado</span><strong><?= fecha($pedido['creado_en']) ?></strong></div>
      <div class="summary-row"><span>Actualizado</span><strong><?= fecha($pedido['actualizado_en']) ?></strong></div>
      <div class="summary-row"><span>Entrega</span><strong><?= ucfirst(h($pedido['metodo_entrega'])) ?></strong></div>
      <div class="summary-row"><span>Pago</span><strong><?= ucfirst(h($pedido['metodo_pago'])) ?></strong></div>
      <div class="summary-row"><span>Registrado por</span><strong><?= h(trim(($pedido['usuario_nombre'] ?? '') . ' ' . ($pedido['usuario_apellido'] ?? '')) ?: 'Tienda online') ?></strong></div>
    </div>
  </div>

  <?php if ($pedido['estado'] === 'cancelado'): ?>
    <div class="alert alert-danger"><i class="fa-solid fa-ban"></i> Este pedido fue cancelado.</div>
  <?php else: ?>
    <ul class="status-timeline" style="margin-bottom:18px;max-width:420px;">
      <?php foreach ($pasos as $i => $paso): ?>
        <li class="<?= $indiceActual !== false && $i <= $indiceActual ? 'done' : '' ?>">
          <strong><?= ucfirst($paso) ?></strong>
          <small><?= $indiceActual !== false && $i <= $indiceActual ? 'Etapa completada' : 'Pendiente' ?></small>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>

  <div class="table-wrap">
    <table>
      <thead><tr><th>SKU</th><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Descuento</th><th>Subtotal</th><th>Stock actual</th></tr></thead>
      <tbody>
      <?php if (!$detalles): ?>
        <tr><td colspan="7" style="text-align:center;color:var(--muted);">El pedido no tiene detalles registrados.</td></tr>
      <?php else: foreach ($detalles as $d): ?>
        <tr>
          <td><strong><?= h($d['sku']) ?></strong></td>
          <td>
            <?= h($d['nombre_producto']) ?>
            <?php if ($d['producto_actual']): ?><br><small style="color:var(--muted);"><?= h($d['producto_actual']) ?></small><?php endif; ?>
          </td>
          <td><?= (int)$d['cantidad'] ?></td>
          <td><?= money($d['precio_unitario']) ?></td>
          <td><?= money($d['descuento']) ?></td>
          <td><?= money($d['subtotal']) ?></td>
          <td><?= $d['stock_actual'] !== null ? (int)$d['stock_actual'] : 'Producto eliminado' ?></td>
        </tr>
      <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>

  <div class="grid grid-2" style="margin-top:18px;align-items:start;">
    <div>
      <div class="summary-row"><span>Subtotal</span><strong><?= money($pedido['subtotal']) ?></strong></div>
      <div class="summary-row"><span>Descuento</span><strong>− <?= money($pedido['descuento']) ?></strong></div>
      <div class="summary-row"><span>Impuestos</span><strong><?= money($pedido['impuestos']) ?></strong></div>
      <div class="summary-row"><span>Envío</span><strong><?= money($pedido['envio']) ?></strong></div>
      <div class="summary-row total"><span>Total</span><strong><?= money($pedido['total']) ?></strong></div>
      <?php if ($pedido['notas']): ?>
        <p style="color:var(--muted);margin-top:12px;"><strong>Notas del cliente:</strong><br><?= h($pedido['notas']) ?></p>
      <?php endif; ?>
    </div>

    <div class="card" style="background:var(--gx-surface);">
      <div class="card-title"><i class="fa-solid fa-arrows-rotate"></i> Actualizar estado</div>
      <?php if ($opciones): ?>
        <form method="POST" style="margin-top:12px;" onsubmit="return confirm('¿Confirmar el cambio de estado?');">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="estado">
          <div class="form-group">
            <label class="form-label">Nuevo estado</label>
            <select name="estado" class="form-control" required>
              <?php foreach ($opciones as $op): ?>
                <option value="<?= $op ?>"><?= ucfirst($op) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary" type="submit"><i class="fa-solid fa-check"></i> Guardar estado</button>
            <a class="btn btn-success" target="_blank" rel="noopener" href="<?= h(BASE_URL . '/shop/receipt.php?pedido=' . $id) ?>">
              <i class="fa-solid fa-image"></i> Ver comprobante PNG
            </a>
            <a class="btn btn-success" href="<?= h(BASE_URL . '/shop/receipt.php?pedido=' . $id . '&download=1') ?>">
              <i class="fa-solid fa-download"></i> Descargar PNG
            </a>
          </div>
        </form>
      <?php else: ?>
        <p style="color:var(--muted);margin-top:10px;">Este pedido está <?= h($pedido['estado']) ?>; no hay transiciones pendientes.</p>
        <a class="btn btn-success" target="_blank" rel="noopener" href="<?= h(BASE_URL . '/shop/receipt.php?pedido=' . $id) ?>">
          <i class="fa-solid fa-image"></i> Ver comprobante PNG
        </a>
        <a class="btn btn-success" href="<?= h(BASE_URL . '/shop/receipt.php?pedido=' . $id . '&download=1') ?>">
          <i class="fa-solid fa-download"></i> Descargar PNG
        </a>
      <?php endif; ?>
    </div>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
