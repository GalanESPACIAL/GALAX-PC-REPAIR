<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('soporte');
$pageTitle = 'Soporte online';

// El borrado físico de tickets se sustituye por archivado lógico para preservar el historial.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'archive') {
    require_csrf();
    $id = (int)($_POST['id'] ?? 0);
    $stmt = db()->prepare("SELECT estado FROM tickets WHERE id=?");
    $stmt->execute([$id]);
    if ($stmt->fetchColumn() !== false) {
        db()->prepare("UPDATE tickets SET estado='cerrado', updated_at=NOW() WHERE id=?")->execute([$id]);
        audit_log('archive_ticket', 'tickets', $id);
        flash('success', 'Ticket archivado ( cerrado ), se conserva el historial.');
    }
    redirect(BASE_URL.'/modules/support/index.php');
}

$tickets = db()->query("SELECT t.*, u.nombre as creador, a.nombre as asignado FROM tickets t JOIN usuarios u ON t.usuario_id=u.id LEFT JOIN usuarios a ON t.asignado_a=a.id ORDER BY t.id DESC")->fetchAll();
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-headset"></i> Tickets de soporte</div>
    <div style="display:flex;gap:8px;">
      <a href="<?= BASE_URL ?>/shop/portal.php?tab=tickets" class="btn btn-ghost btn-sm"><i class="fa-solid fa-plus"></i> Solicitar por portal</a>
      <a href="<?= BASE_URL ?>/modules/support/create.php" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Nuevo ticket</a>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Código</th><th>Asunto</th><th>Creador</th><th>Asignado</th><th>Prioridad</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
      <tbody>
      <?php if (empty($tickets)): ?>
        <tr><td colspan="8" style="text-align:center;color:var(--muted);">Sin tickets</td></tr>
      <?php else: foreach ($tickets as $t): ?>
        <tr>
          <td><strong><?= h($t['codigo']) ?></strong></td>
          <td><?= h($t['asunto']) ?></td>
          <td><?= h($t['creador']) ?></td>
          <td><?= h($t['asignado'] ?? '-') ?></td>
          <td><?= badgeEstado($t['prioridad']) ?></td>
          <td><?= badgeEstado($t['estado']) ?></td>
          <td><?= fecha($t['created_at']) ?></td>
          <td style="display:flex;gap:6px;">
            <a href="<?= BASE_URL ?>/modules/support/view.php?id=<?= (int)$t['id'] ?>" class="btn btn-info btn-sm btn-icon" title="Ver"><i class="fa-solid fa-eye"></i></a>
            <?php if ($t['estado'] !== 'cerrado'): ?>
            <form method="post" onsubmit="return confirm('¿Archivar este ticket?')" style="margin:0;">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="archive">
              <input type="hidden" name="id" value="<?= (int)$t['id'] ?>">
              <button class="btn btn-danger btn-sm btn-icon" type="submit" title="Archivar"><i class="fa-solid fa-box-archive"></i></button>
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
