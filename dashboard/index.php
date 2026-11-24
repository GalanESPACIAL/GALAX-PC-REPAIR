<?php
require_once __DIR__ . '/../includes/functions.php';
requirePermission('dashboard');
$pageTitle = 'Panel de control';
$stats = getStats();
$pedidosPendientes = (int)db()->query("SELECT COUNT(*) FROM pedidos WHERE estado IN ('pendiente','confirmado','preparando','listo')")->fetchColumn();
$reparacionesActivas = (int)db()->query("SELECT COUNT(*) FROM reparaciones WHERE estado NOT IN ('entregado','cancelado')")->fetchColumn();
require_once __DIR__ . '/../includes/header.php';
?>
<div class="stats-grid stagger">
  <div class="stat-card">
    <div class="label">Productos activos</div>
    <div class="value" data-count="<?= (int)$stats['productos'] ?>"><?= (int)$stats['productos'] ?></div>
    <div class="trend"><i class="fa-solid fa-arrow-up"></i> En catálogo</div>
    <i class="fa-solid fa-box icon"></i>
  </div>
  <div class="stat-card">
    <div class="label">Clientes</div>
    <div class="value" data-count="<?= (int)$stats['clientes'] ?>"><?= (int)$stats['clientes'] ?></div>
    <div class="trend">Registrados</div>
    <i class="fa-solid fa-users icon"></i>
  </div>
  <div class="stat-card">
    <div class="label">Ventas del mes</div>
    <div class="value" data-count="<?= (float)$stats['ventas_mes'] ?>"><?= money($stats['ventas_mes']) ?></div>
    <div class="trend">Ingresos POS + online</div>
    <i class="fa-solid fa-cart-shopping icon"></i>
  </div>
  <div class="stat-card">
    <div class="label">Pedidos por atender</div>
    <div class="value" data-count="<?= $pedidosPendientes ?>"><?= $pedidosPendientes ?></div>
    <div class="trend"><a style="color:var(--accent);" href="<?= BASE_URL ?>/modules/orders/index.php">Ver pedidos</a></div>
    <i class="fa-solid fa-bag-shopping icon"></i>
  </div>
  <div class="stat-card">
    <div class="label">Reparaciones activas</div>
    <div class="value" data-count="<?= $reparacionesActivas ?>"><?= $reparacionesActivas ?></div>
    <div class="trend"><a style="color:var(--accent);" href="<?= BASE_URL ?>/modules/repairs/index.php">Ver reparaciones</a></div>
    <i class="fa-solid fa-laptop-medical icon"></i>
  </div>
  <div class="stat-card">
    <div class="label">Tickets abiertos</div>
    <div class="value" data-count="<?= (int)$stats['tickets_abiertos'] ?>"><?= (int)$stats['tickets_abiertos'] ?></div>
    <div class="trend"><a style="color:var(--accent);" href="<?= BASE_URL ?>/modules/support/index.php">Ver soporte</a></div>
    <i class="fa-solid fa-headset icon"></i>
  </div>
</div>

<div class="grid grid-2">
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fa-solid fa-triangle-exclamation"></i> Stock bajo</div>
      <a href="<?= BASE_URL ?>/modules/inventory/index.php" class="btn btn-ghost btn-sm">Ver inventario</a>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th></tr></thead>
        <tbody>
        <?php
        $rows = db()->query("SELECT nombre, stock, stock_minimo FROM productos WHERE stock <= stock_minimo AND estado='activo' ORDER BY stock ASC LIMIT 8")->fetchAll();
        if (empty($rows)): ?>
          <tr><td colspan="3" style="text-align:center;color:var(--muted);">Sin alertas de stock</td></tr>
        <?php else: foreach ($rows as $r): ?>
          <tr><td><?= h($r['nombre']) ?></td><td><span style="color:var(--danger);font-weight:700;"><?= (int)$r['stock'] ?></span></td><td><?= (int)$r['stock_minimo'] ?></td></tr>
        <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fa-solid fa-receipt"></i> Últimas ventas</div>
      <a href="<?= BASE_URL ?>/modules/sales/index.php" class="btn btn-ghost btn-sm">Ver todas</a>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Código</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
        <tbody>
        <?php
        $rows = db()->query("SELECT codigo,total,estado,created_at FROM ventas ORDER BY id DESC LIMIT 8")->fetchAll();
        if (empty($rows)): ?>
          <tr><td colspan="4" style="text-align:center;color:var(--muted);">Sin ventas aún</td></tr>
        <?php else: foreach ($rows as $r): ?>
          <tr><td><?= h($r['codigo']) ?></td><td><?= money($r['total']) ?></td><td><?= badgeEstado($r['estado']) ?></td><td><?= fecha($r['created_at']) ?></td></tr>
        <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<?php
$clientes = db()->query("SELECT id, nombre, apellido, email, telefono, created_at FROM clientes ORDER BY id DESC LIMIT 6")->fetchAll();
?>
<div class="card" style="margin-top:18px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-user-group"></i> Últimos clientes</div>
    <a href="<?= BASE_URL ?>/modules/customers/index.php" class="btn btn-ghost btn-sm">Ver todos</a>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Registrado</th></tr></thead>
      <tbody>
      <?php if (empty($clientes)): ?>
        <tr><td colspan="4" style="text-align:center;color:var(--muted);">Sin clientes registrados</td></tr>
      <?php else: foreach ($clientes as $c): ?>
        <tr><td><?= h(trim((string)($c['nombre'] ?? '') . ' ' . ($c['apellido'] ?? ''))) ?></td><td><?= h($c['email']) ?></td><td><?= h($c['telefono']) ?></td><td><?= fecha($c['created_at']) ?></td></tr>
      <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>
</div>

<div class="card" style="margin-top:18px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-ticket"></i> Tickets recientes de soporte</div>
    <a href="<?= BASE_URL ?>/modules/support/index.php" class="btn btn-ghost btn-sm">Ver todos</a>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Código</th><th>Asunto</th><th>Prioridad</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>
      <?php
      $rows = db()->query("SELECT codigo,asunto,prioridad,estado,created_at FROM tickets ORDER BY id DESC LIMIT 6")->fetchAll();
      if (empty($rows)): ?>
        <tr><td colspan="5" style="text-align:center;color:var(--muted);">Sin tickets</td></tr>
      <?php else: foreach ($rows as $r): ?>
        <tr><td><?= h($r['codigo']) ?></td><td><?= h($r['asunto']) ?></td><td><?= badgeEstado($r['prioridad']) ?></td><td><?= badgeEstado($r['estado']) ?></td><td><?= fecha($r['created_at']) ?></td></tr>
      <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
