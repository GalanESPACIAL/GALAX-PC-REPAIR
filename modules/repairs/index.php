<?php
/**
 * GALAX PC REPAIR — Listado administrativo de órdenes de reparación.
 * Filtros por estado/búsqueda y paginación sobre el total real de filas.
 */
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('reparaciones');

$pageTitle = 'Reparaciones';
$estados = [
    'recibido' => 'Recibido',
    'pendiente_diagnostico' => 'Pendiente de diagnóstico',
    'en_diagnostico' => 'En diagnóstico',
    'presupuesto_enviado' => 'Presupuesto enviado',
    'esperando_aprobacion' => 'Esperando aprobación',
    'aprobado' => 'Aprobado',
    'en_reparacion' => 'En reparación',
    'esperando_repuestos' => 'Esperando repuestos',
    'en_pruebas' => 'En pruebas',
    'reparado' => 'Reparado',
    'listo_para_entregar' => 'Listo para entregar',
    'entregado' => 'Entregado',
    'cancelado' => 'Cancelado',
];

$estado = (string)($_GET['estado'] ?? '');
if ($estado !== '' && !isset($estados[$estado])) {
    $estado = '';
}
$q = trim((string)($_GET['q'] ?? ''));
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 10;

$where = [];
$params = [];
if ($estado !== '') {
    $where[] = 'r.estado = ?';
    $params[] = $estado;
}
if ($q !== '') {
    $like = '%' . $q . '%';
    $where[] = '(r.codigo LIKE ? OR r.nombre_cliente LIKE ? OR r.contacto_cliente LIKE ?'
        . ' OR r.tipo_equipo LIKE ? OR r.marca LIKE ? OR r.modelo LIKE ? OR r.numero_serie LIKE ?)';
    for ($i = 0; $i < 7; $i++) {
        $params[] = $like;
    }
}
$sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = db()->prepare("SELECT COUNT(*) FROM reparaciones r $sqlWhere");
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();
$pag = paginate($total, $perPage, $page);

$stmt = db()->prepare(
    "SELECT r.*,
            c.nombre AS cli_nombre, c.apellido AS cli_apellido,
            t.nombre AS tec_nombre, t.apellido AS tec_apellido
       FROM reparaciones r
       LEFT JOIN clientes c ON r.cliente_id = c.id
       LEFT JOIN usuarios t ON r.tecnico_id = t.id
       $sqlWhere
      ORDER BY r.creado_en DESC, r.id DESC
      LIMIT ? OFFSET ?"
);
$queryParams = $params;
$queryParams[] = $pag['perPage'];
$queryParams[] = $pag['offset'];
foreach ($queryParams as $i => $value) {
    $isPagination = $i >= count($params);
    $stmt->bindValue($i + 1, $value, $isPagination ? PDO::PARAM_INT : PDO::PARAM_STR);
}
$stmt->execute();
$reparaciones = $stmt->fetchAll();

// KPIs reales del módulo.
$stats = db()->query(
    "SELECT
       SUM(estado NOT IN ('entregado','cancelado')) AS activas,
       SUM(estado = 'listo_para_entregar') AS por_entregar,
       SUM(estado = 'entregado') AS entregadas,
       SUM(estado IN ('esperando_aprobacion','presupuesto_enviado')) AS pendientes_aprobacion,
       COALESCE(SUM(CASE WHEN estado NOT IN ('cancelado') THEN costo_total ELSE 0 END),0) AS importe
     FROM reparaciones"
)->fetch();

$baseParams = array_filter([
    'estado' => $estado,
    'q' => $q,
], fn($v) => $v !== '');

$listUrl = BASE_URL . '/modules/repairs/index.php';
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="stats-grid">
  <div class="stat-card"><div class="label">Ordenes activas</div><div class="value"><?= (int)($stats['activas'] ?? 0) ?></div><i class="fa-solid fa-screwdriver-wrench icon"></i></div>
  <div class="stat-card"><div class="label">Por entregar</div><div class="value"><?= (int)($stats['por_entregar'] ?? 0) ?></div><i class="fa-solid fa-truck icon"></i></div>
  <div class="stat-card"><div class="label">Pendientes de aprobación</div><div class="value"><?= (int)($stats['pendientes_aprobacion'] ?? 0) ?></div><i class="fa-solid fa-hourglass-half icon"></i></div>
  <div class="stat-card"><div class="label">Entregadas</div><div class="value"><?= (int)($stats['entregadas'] ?? 0) ?></div><i class="fa-solid fa-circle-check icon"></i></div>
</div>

<div class="card">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-laptop-medical"></i> Órdenes de reparación</div>
    <a href="<?= BASE_URL ?>/modules/repairs/create.php" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Nueva orden</a>
  </div>

  <form method="GET" class="grid grid-3" style="align-items:end;margin-bottom:18px;">
    <div class="form-group" style="margin-bottom:0;">
      <label class="form-label" for="q">Buscar</label>
      <input type="text" id="q" name="q" class="form-control" value="<?= h($q) ?>"
             placeholder="Código, cliente, equipo, serie...">
    </div>
    <div class="form-group" style="margin-bottom:0;">
      <label class="form-label" for="estado">Estado</label>
      <select id="estado" name="estado" class="form-control">
        <option value="">-- Todos los estados --</option>
        <?php foreach ($estados as $key => $label): ?>
          <option value="<?= h($key) ?>" <?= $estado === $key ? 'selected' : '' ?>><?= h($label) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-primary" type="submit"><i class="fa-solid fa-magnifying-glass"></i> Filtrar</button>
      <a class="btn btn-ghost" href="<?= h($listUrl) ?>"><i class="fa-solid fa-rotate-left"></i> Limpiar</a>
    </div>
  </form>

  <p style="color:var(--muted);font-size:.85rem;margin-bottom:12px;">
    <?= (int)$total ?> <?= $total === 1 ? 'orden encontrada' : 'órdenes encontradas' ?>
    <?php if ($total > 0): ?> — página <?= $pag['page'] ?> de <?= $pag['pages'] ?><?php endif; ?>
  </p>

  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Código</th><th>Cliente / Equipo</th><th>Estado</th><th>Presupuesto</th>
          <th>Total</th><th>Técnico</th><th>Recepción</th><th></th>
        </tr>
      </thead>
      <tbody>
        <?php if (!$reparaciones): ?>
          <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:28px;">
            No hay órdenes que coincidan con los filtros.
          </td></tr>
        <?php else: foreach ($reparaciones as $r): ?>
          <?php
            $clienteMostrado = $r['cli_nombre']
                ? trim($r['cli_nombre'] . ' ' . $r['cli_apellido'])
                : $r['nombre_cliente'];
            $tecnicoMostrado = $r['tec_nombre'] ? trim($r['tec_nombre'] . ' ' . $r['tec_apellido']) : 'Sin asignar';
          ?>
          <tr>
            <td><strong><?= h($r['codigo']) ?></strong></td>
            <td>
              <strong><?= h($clienteMostrado) ?></strong><br>
              <small style="color:var(--muted);"><?= h($r['tipo_equipo']) ?>
                <?= $r['marca'] ? ' · ' . h($r['marca']) : '' ?>
                <?= $r['modelo'] ? ' ' . h($r['modelo']) : '' ?>
              </small>
            </td>
            <td><?= badgeEstado($r['estado']) ?></td>
            <td><?= h(money($r['presupuesto'])) ?></td>
            <td><strong><?= h(money($r['costo_total'])) ?></strong></td>
            <td><?= h($tecnicoMostrado) ?></td>
            <td><?= h(fecha($r['fecha_recepcion'])) ?></td>
            <td><a class="btn btn-ghost btn-sm" href="<?= BASE_URL ?>/modules/repairs/view.php?id=<?= (int)$r['id'] ?>">
              <i class="fa-solid fa-eye"></i> Ver</a></td>
          </tr>
        <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>
  <?= pagination_links($pag, $listUrl, $baseParams) ?>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
