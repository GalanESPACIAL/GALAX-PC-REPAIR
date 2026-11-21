<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('ventas');
$pageTitle = 'Nueva Venta';
$clientes = db()->query("SELECT * FROM clientes ORDER BY nombre")->fetchAll();
$productos = db()->query("SELECT p.*, c.nombre as cat FROM productos p JOIN categorias c ON p.categoria_id=c.id WHERE p.estado='activo' AND p.stock>0 ORDER BY p.nombre")->fetchAll();
$igv = (float)getConfig('igv_porcentaje');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $cliente_id = (int)($_POST['cliente_id'] ?? 0);
    $metodo_pago = (string)($_POST['metodo_pago'] ?? 'efectivo');
    $notas = trim((string)($_POST['notas'] ?? ''));
    $items = json_decode((string)($_POST['items'] ?? '[]'), true);
    if (!is_array($items)) $items = [];
    $allowedPay = ['efectivo','tarjeta','transferencia','yape','plin'];

    if (!$cliente_id || !$items || !in_array($metodo_pago, $allowedPay, true)) {
        flash('error', 'Seleccione cliente, método de pago y al menos un producto.');
    } else {
        $db = db();
        $db->beginTransaction();
        try {
            // Los precios SIEMPRE se releen de MySQL; el navegador solo envía id y cantidad.
            $ids = array_values(array_unique(array_map(fn($it) => (int)($it['id'] ?? 0), $items)));
            $ids = array_values(array_filter($ids));
            if (!$ids) throw new RuntimeException('Productos inválidos');
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("SELECT id, nombre, precio_venta, stock FROM productos WHERE id IN ($marks) AND estado='activo' FOR UPDATE");
            $stmt->execute($ids);
            $catalog = [];
            foreach ($stmt->fetchAll() as $p) $catalog[(int)$p['id']] = $p;

            $lines = [];
            $qtyByProduct = [];
            $subtotal = 0.0;
            foreach ($items as $it) {
                $pid = (int)($it['id'] ?? 0);
                $qty = (int)($it['qty'] ?? 0);
                if ($qty < 1 || $qty > 99 || !isset($catalog[$pid])) {
                    throw new RuntimeException('Uno de los productos no está disponible.');
                }
                $qtyByProduct[$pid] = ($qtyByProduct[$pid] ?? 0) + $qty;
                $unit = (float)$catalog[$pid]['precio_venta'];
                $lines[] = ['id' => $pid, 'qty' => $qty, 'unit' => $unit, 'sub' => round($unit * $qty, 2)];
                $subtotal += $unit * $qty;
            }
            foreach ($qtyByProduct as $pid => $qty) {
                if ($qty > (int)$catalog[$pid]['stock']) {
                    throw new RuntimeException('Stock insuficiente para ' . $catalog[$pid]['nombre'] . '. Disponible: ' . $catalog[$pid]['stock']);
                }
            }
            $subtotal = round($subtotal, 2);
            $igvMonto = round($subtotal * ($igv / 100), 2);
            $total = round($subtotal + $igvMonto, 2);
            $codigo = generateCode('VTA', 'ventas');
            $stmt = $db->prepare("INSERT INTO ventas (codigo,cliente_id,usuario_id,subtotal,igv,total,metodo_pago,estado,notas) VALUES (?,?,?,?,?,?,?,'pagado',?)");
            $stmt->execute([$codigo, $cliente_id, (int)$_SESSION['user_id'], $subtotal, $igvMonto, $total, $metodo_pago, $notas]);
            $venta_id = (int)$db->lastInsertId();

            $detailStmt = $db->prepare("INSERT INTO detalle_ventas (venta_id,producto_id,cantidad,precio_unitario,subtotal) VALUES (?,?,?,?,?)");
            $stockStmt = $db->prepare("UPDATE productos SET stock=stock-? WHERE id=? AND stock>=?");
            $movStmt = $db->prepare("INSERT INTO inventario_movimientos (producto_id,tipo,cantidad,stock_anterior,stock_nuevo,motivo,documento,usuario_id) VALUES (?,'venta',?,?,?,?,?,?)");
            foreach ($lines as $line) {
                $detailStmt->execute([$venta_id, $line['id'], $line['qty'], $line['unit'], $line['sub']]);
                $before = (int)$catalog[$line['id']]['stock'];
                $stockStmt->execute([$line['qty'], $line['id'], $line['qty']]);
                if ($stockStmt->rowCount() !== 1) throw new RuntimeException('El stock cambió durante la operación.');
                $movStmt->execute([$line['id'], -$line['qty'], $before, $before - $line['qty'], 'Venta POS ' . $codigo, $codigo, (int)$_SESSION['user_id']]);
            }
            $db->commit();
            audit_log('create_sale', 'ventas', $venta_id, $codigo . ' total ' . $total);
            flash('success', 'Venta registrada: ' . $codigo);
            redirect(BASE_URL . '/modules/sales/view.php?id=' . $venta_id);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            error_log('[GALAX][POS] ' . $e->getMessage());
            flash('error', 'No se pudo registrar la venta: ' . $e->getMessage());
        }
    }
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-cart-plus"></i> Nueva Venta</div>
    <a href="<?= BASE_URL ?>/modules/sales/index.php" class="btn btn-ghost btn-sm"><i class="fa-solid fa-arrow-left"></i> Volver</a>
  </div>
  <form method="POST" id="saleForm">
    <?= csrf_field() ?>
    <div class="grid grid-2">
      <div class="form-group">
        <label class="form-label">Cliente *</label>
        <select name="cliente_id" class="form-control" required>
          <option value="">Seleccionar cliente...</option>
          <?php foreach ($clientes as $c): ?>
            <option value="<?= (int)$c['id'] ?>"><?= h($c['nombre'].' '.$c['apellido']) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Método de pago</label>
        <select name="metodo_pago" class="form-control">
          <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
          <option value="transferencia">Transferencia</option><option value="yape">Yape</option><option value="plin">Plin</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Agregar producto</label>
      <div style="display:flex;gap:10px;">
        <select id="prodSelect" class="form-control">
          <option value="">Seleccionar producto...</option>
          <?php foreach ($productos as $p): ?>
            <option value="<?= (int)$p['id'] ?>" data-stock="<?= (int)$p['stock'] ?>" data-name="<?= h($p['nombre']) ?>">
              <?= h($p['codigo']) ?> - <?= h($p['nombre']) ?> (Stock: <?= (int)$p['stock'] ?>) - <?= money($p['precio_venta']) ?>
            </option>
          <?php endforeach; ?>
        </select>
        <input type="number" id="prodQty" class="form-control" value="1" min="1" style="max-width:90px;">
        <button type="button" id="addProd" class="btn btn-info"><i class="fa-solid fa-plus"></i> Agregar</button>
      </div>
      <small style="color:var(--muted);">El precio se toma del servidor al guardar, no del navegador.</small>
    </div>
    <div class="table-wrap" style="margin:16px 0;">
      <table id="cartTable">
        <thead><tr><th>Producto</th><th>Cantidad</th><th></th></tr></thead>
        <tbody id="cartBody"></tbody>
      </table>
    </div>
    <div style="text-align:right;margin:12px 0;">
      <p>IGV (<?= (float)$igv ?>%): <strong id="igvLabel">S/ 0.00</strong></p>
      <p style="font-size:1.3rem;">Total: <strong id="grandTotal">S/ 0.00</strong></p>
    </div>
    <div class="form-group"><label class="form-label">Notas</label><textarea name="notas" class="form-control"></textarea></div>
    <input type="hidden" name="items" id="itemsInput">
    <button type="submit" class="btn btn-success btn-lg"><i class="fa-solid fa-check"></i> Registrar Venta</button>
  </form>
</div>
<script>
const cart = [];
const igvRate = <?= (float)$igv ?> / 100;
function renderCart() {
  const body = document.getElementById('cartBody');
  body.innerHTML = '';
  cart.forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${it.name}</td><td>${it.qty}</td>
      <td><button type="button" class="btn btn-danger btn-sm btn-icon" onclick="removeItem(${idx})"><i class="fa-solid fa-times"></i></button></td>`;
    body.appendChild(tr);
  });
  document.getElementById('itemsInput').value = JSON.stringify(cart.map(c => ({id: c.id, qty: c.qty})));
  document.getElementById('igvLabel').textContent = 'Se calculará en el servidor';
  document.getElementById('grandTotal').textContent = 'Se calculará en el servidor';
}
function removeItem(i){ cart.splice(i,1); renderCart(); }
document.getElementById('addProd').addEventListener('click', () => {
  const sel = document.getElementById('prodSelect');
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  const id = parseInt(opt.value), stock = parseInt(opt.dataset.stock);
  const qty = parseInt(document.getElementById('prodQty').value) || 1;
  const existing = cart.find(c => c.id === id);
  if ((existing ? existing.qty : 0) + qty > stock) { alert('Stock insuficiente (disponible: '+stock+')'); return; }
  if (existing) existing.qty += qty;
  else cart.push({id, name: opt.dataset.name, qty, stock});
  renderCart();
});
document.getElementById('saleForm').addEventListener('submit', (e) => {
  if (cart.length === 0) { e.preventDefault(); alert('Agregue al menos un producto'); }
});
</script>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
