<?php
/**
 * GALAX PC REPAIR — Gestión administrativa de pedidos online.
 */
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('pedidos');

$pageTitle = 'Pedidos Online';

$gxDate = static function ($value): string {
    $value = trim((string)$value);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return '';
    }
    [$anio, $mes, $dia] = array_map('intval', explode('-', $value));
    return checkdate($mes, $dia, $anio) ? $value : '';
};

$estadosPedido = ['pendiente', 'confirmado', 'preparando', 'completado', 'cancelado'];
$transiciones = [
    'pendiente'  => ['confirmado', 'cancelado'],
    'confirmado' => ['preparando', 'cancelado'],
    'preparando' => ['completado', 'cancelado'],
    'completado' => [],
    'cancelado'  => [],
];

/* ------------------------------------------------------------------ */
/* Cambio rápido de estado — CSRF + transición válida + auditoría      */
/* ------------------------------------------------------------------ */

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    require_csrf();
    if (($_POST['action'] ?? '') === 'estado') {
        $id = (int)($_POST['id'] ?? 0);
        $nuevo = (string)($_POST['estado'] ?? '');
        $stmt = db()->prepare('SELECT estado, codigo FROM pedidos WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $pedido = $stmt->fetch();

        if (!$pedido) {
            flash('error', 'El pedido no existe.');
        } elseif (!in_array($nuevo, $transiciones[$pedido['estado']] ?? [], true)) {
            flash('error', 'Transición de estado no permitida.');
        } else {
            $anterior = $pedido['estado'];
            db()->prepare('UPDATE pedidos SET estado = ?, actualizado_en = NOW() WHERE id = ?')
                ->execute([$nuevo, $id]);
            audit_log(
                'pedido_estado_cambiado',
                'pedidos',
                $id,
                $pedido['codigo'] . ' | ' . $anterior . ' -> ' . $nuevo
            );
            flash('success', 'Estado del pedido ' . $pedido['codigo'] . ' actualizado a ' . ucfirst($nuevo) . '.');
        }
    } else {
        flash('error', 'Acción no reconocida.');
    }
    redirect(BASE_URL . '/modules/orders/index.php');
}

/* ------------------------------------------------------------------ */
/* Filtros y listado paginado                                          */
/* ------------------------------------------------------------------ */

$filtros = [
    'estado' => (string)($_GET['estado'] ?? ''),
    'desde'  => $gxDate($_GET['desde'] ?? ''),
    'hasta'  => $gxDate($_GET['hasta'] ?? ''),
    'q'      => trim((string)($_GET['q'] ?? '')),
];
if (!in_array($filtros['estado'], $estadosPedido, true)) {
    $filtros['estado'] = '';
}

$where = [];
$params = [];
if ($filtros['estado'] !== '') {
    $where[] = 'p.estado = ?';
    $params[] = $filtros['estado'];
}
if ($filtros['desde'] !== '') {
    $where[] = 'DATE(p.creado_en) >= ?';
    $params[] = $filtros['desde'];
}
if ($filtros['hasta'] !== '') {
    $where[] = 'DATE(p.creado_en) <= ?';
    $params[] = $filtros['hasta'];
}
if ($filtros['q'] !== '') {
    $like = '%' . $filtros['q'] . '%';
    $where[] = '(p.codigo LIKE ? OR p.nombre_cliente LIKE ? OR p.email_cliente LIKE ? OR p.documento LIKE ?)';
    $params = array_merge($params, [$like, $like, $like, $like]);
}
$sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = db()->prepare('SELECT COUNT(*) FROM pedidos p ' . $sqlWhere);
foreach ($params as $i => $valor) {
    $stmt->bindValue($i + 1, $valor);
}
$stmt->execute();
$totalPedidos = (int)$stmt->fetchColumn();
$pagina = paginate($totalPedidos, 15, (int)($_GET['page'] ?? 1));

$stmt = db()->prepare(
    'SELECT p.*,
            (SELECT COUNT(*) FROM pedido_detalles d WHERE d.pedido_id = p.id) AS items
       FROM pedidos p
       ' . $sqlWhere . '
      ORDER BY p.creado_en DESC, p.id DESC
      LIMIT ? OFFSET ?'
);
foreach ($params as $i => $valor) {
    $stmt->bindValue($i + 1, $valor);
}
$stmt->bindValue(count($params) + 1, $pagina['perPage'], PDO::PARAM_INT);
$stmt->bindValue(count($params) + 2, $pagina['offset'], PDO::PARAM_INT);
$stmt->execute();
$pedidos = $stmt->fetchAll();

$conteos = db()->query('SELECT estado, COUNT(*) AS num FROM pedidos GROUP BY estado')->fetchAll();
$porEstado = array_column($conteos, 'num', 'estado');
$totalesPedidos = db()->query('SELECT COALESCE(SUM(total),0) FROM pedidos')->fetchColumn();

require_once __DIR__ . '/../../includes/header.php';
echo '<link rel="stylesheet" href="' . h(BASE_URL . '/assets/css/theme.css') . '">';
?>
<div class="stats-grid">
  <div class="stat-card"><div class="label">Pedidos registrados</div><div class="value"><?= $totalPedidos ?></div><i class="fa-solid fa-bag-shopping"></i></div>
  <?php foreach (['pendiente', 'confirmado', 'preparando', 'completado'] as $estado): ?>
    <div class="stat-card">
      <div class="label"><?= ucfirst($estado) ?></div>
      <div class="value"><?= (int)($porEstado[$estado] ?? 0) ?></div>
      <i class="fa-solid fa-<?= $estado === 'pendiente' ? 'hourglass-half' : ($estado === 'completado' ? 'circle-check' : 'truck') ?>"></i>
    </div>
  <?php endforeach; ?>
  <div class="stat-card"><div class="label">Facturación pedidos</div><div class="value"><?= money($totalesPedidos) ?></div><i class="fa-solid fa-sack-dollar"></i></div>
</div>

<div class="card">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-list-ol"></i> Pedidos de la tienda</div>
    <span class="chip"><?= $totalPedidos ?> resultados</span>
  </div>

  <form method="GET" class="grid grid-4" style="margin-bottom:14px;">
    <div class="form-group">
      <label class="form-label">Buscar</label>
      <input type="text" name="q" class="form-control" value="<?= h($filtros['q']) ?>" placeholder="Código, cliente, email…">
    </div>
    <div class="form-group">
      <label class="form-label">Estado</label>
      <select name="estado" class="form-control">
        <option value="">Todos</option>
        <?php foreach ($estadosPedido as $estado): ?>
          <option value="<?= $estado ?>" <?= $filtros['estado'] === $estado ? 'selected' : '' ?>><?= ucfirst($estado) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Desde</label>
      <input type="date" name="desde" class="form-control" value="<?= h($filtros['desde']) ?>">
    </div>
    <div class="form-group">
      <label class="form-label">Hasta</label>
      <input type="date" name="hasta" class="form-control" value="<?= h($filtros['hasta']) ?>">
    </div>
    <div style="grid-column:1/-1;">
      <button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-filter"></i> Filtrar</button>
      <a class="btn btn-ghost btn-sm" href="<?= h(BASE_URL . '/modules/orders/index.php') ?>"><i class="fa-solid fa-rotate"></i> Limpiar</a>
    </div>
  </form>

  <div class="table-wrap">
    <table>
      <thead><tr><th>Código</th><th>Cliente</th><th>Contacto</th><th>Entrega</th><th>Ítems</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
      <tbody>
      <?php if (!$pedidos): ?>
        <tr><td colspan="9" style="text-align:center;color:var(--muted);">No hay pedidos con estos filtros.</td></tr>
      <?php else: foreach ($pedidos as $p): ?>
        <tr>
          <td><strong><?= h($p['codigo']) ?></strong></td>
          <td><?= h($p['nombre_cliente']) ?></td>
          <td><?= h($p['email_cliente']) ?><br><small style="color:var(--muted);"><?= h($p['telefono_cliente'] ?: '-') ?></small></td>
          <td><?= ucfirst(h($p['metodo_entrega'])) ?></td>
          <td><?= (int)$p['items'] ?></td>
          <td><strong><?= money($p['total']) ?></strong></td>
          <td><?= badgeEstado($p['estado']) ?></td>
          <td><?= fecha($p['creado_en']) ?></td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <a class="btn btn-info btn-sm btn-icon" href="<?= h(BASE_URL . '/modules/orders/view.php?id=' . (int)$p['id']) ?>" title="Ver detalle"><i class="fa-solid fa-eye"></i></a>
              <a class="btn btn-success btn-sm btn-icon" target="_blank" rel="noopener" href="<?= h(BASE_URL . '/shop/receipt.php?pedido=' . (int)$p['id']) ?>" title="Comprobante PNG"><i class="fa-solid fa-image"></i></a>
              <?php $opciones = $transiciones[$p['estado']] ?? []; ?>
              <?php if ($opciones): ?>
                <form method="POST" style="display:flex;gap:4px;" onsubmit="return confirm('¿Cambiar el estado de este pedido?');">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="estado">
                  <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
                  <select name="estado" class="form-control" style="max-width:130px;padding:5px;font-size:.78rem;" required>
                    <?php foreach ($opciones as $op): ?>
                      <option value="<?= $op ?>"><?= ucfirst($op) ?></option>
                    <?php endforeach; ?>
                  </select>
                  <button class="btn btn-warning btn-sm" type="submit" title="Actualizar estado"><i class="fa-solid fa-arrows-rotate"></i></button>
                </form>
              <?php endif; ?>
            </div>
          </td>
        </tr>
      <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>
  <?= pagination_links($pagina, BASE_URL . '/modules/orders/index.php', $filtros) ?>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
