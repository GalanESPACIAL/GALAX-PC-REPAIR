<?php
/**
 * Detalle de ticket. El personal con permiso `soporte` ve todo; el cliente
 * únicamente ve los tickets vinculados a su usuario o a su ficha de cliente.
 * Las notas internas nunca se muestran al cliente.
 */
require_once __DIR__ . '/../../includes/functions.php';
requireLogin();

$isStaff = hasPermission('soporte');
$pageTitle = 'Detalle ticket';
$id = (int)($_GET['id'] ?? 0);
$stmt = db()->prepare(
    'SELECT t.*, c.nombre as cn, c.apellido as ca, c.usuario_id AS cli_usuario_id,
            u.nombre as creador, a.nombre as asignado
       FROM tickets t
       LEFT JOIN clientes c ON t.cliente_id=c.id
       JOIN usuarios u ON t.usuario_id=u.id
       LEFT JOIN usuarios a ON t.asignado_a=a.id
      WHERE t.id=? LIMIT 1'
);
$stmt->execute([$id]);
$t = $stmt->fetch();
if (!$t) {
    flash('error', 'Ticket no encontrado');
    redirect(BASE_URL . ($isStaff ? '/modules/support/index.php' : '/shop/portal.php?tab=tickets'));
}

if (!$isStaff) {
    $clienteId = false;
    $stmt = db()->prepare('SELECT id FROM clientes WHERE usuario_id=? LIMIT 1');
    $stmt->execute([(int)$_SESSION['user_id']]);
    $clienteId = $stmt->fetchColumn();
    $ownByUser = (int)$t['usuario_id'] === (int)$_SESSION['user_id'];
    $ownByClient = $clienteId !== false && (int)$t['cliente_id'] === (int)$clienteId;
    if (!$ownByUser && !$ownByClient) {
        accessDenied();
    }
}

$allowedStates = $isStaff
    ? ['abierto', 'en_proceso', 'resuelto', 'cerrado']
    : ['abierto', 'en_proceso'];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['mensaje'])) {
    require_csrf();
    $msg = trim((string)($_POST['mensaje']));
    $estado = (string)($_POST['estado'] ?? $t['estado']);
    if (!in_array($estado, $allowedStates, true)) {
        $estado = $t['estado'];
    }
    $interno = $isStaff && isset($_POST['interno']) ? 1 : 0;
    if ($msg !== '' && mb_strlen($msg) <= 5000) {
        $db = db();
        $stmt = $db->prepare('INSERT INTO respuestas_tickets (ticket_id,usuario_id,mensaje,es_interno) VALUES (?,?,?,?)');
        $stmt->execute([$id, (int)$_SESSION['user_id'], $msg, $interno]);
        $db->prepare('UPDATE tickets SET estado=?, updated_at=NOW() WHERE id=?')->execute([$estado, $id]);
        audit_log('reply_ticket', 'tickets', $id);
        flash('success', 'Respuesta agregada');
        redirect(BASE_URL . '/modules/support/view.php?id=' . $id);
    }
    flash('error', 'La respuesta no puede estar vacía ni superar 5000 caracteres.');
}

$sql = 'SELECT r.*, u.nombre, u.apellido, u.rol_id
          FROM respuestas_tickets r JOIN usuarios u ON r.usuario_id=u.id
         WHERE r.ticket_id=?';
if (!$isStaff) {
    $sql .= ' AND r.es_interno=0';
}
$sql .= ' ORDER BY r.id ASC';
$stmt = db()->prepare($sql);
$stmt->execute([$id]);
$respuestas = $stmt->fetchAll();

if ($isStaff) {
    require_once __DIR__ . '/../../includes/header.php';
} else {
    $activeNav = 'portal';
    require_once __DIR__ . '/../../includes/store_header.php';
}
?>
<div class="card" style="max-width:900px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-ticket"></i> Ticket <?= h($t['codigo']) ?></div>
    <a href="<?= BASE_URL ?><?= $isStaff ? '/modules/support/index.php' : '/shop/portal.php?tab=tickets' ?>" class="btn btn-ghost btn-sm"><i class="fa-solid fa-arrow-left"></i> Volver</a>
  </div>
  <div style="margin-bottom:16px;">
    <h3 style="margin-bottom:6px;"><?= h($t['asunto']) ?></h3>
    <p style="color:var(--muted);white-space:pre-wrap;"><?= h($t['descripcion']) ?></p>
    <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;">
      <span>Prioridad: <?= badgeEstado($t['prioridad']) ?></span>
      <span>Estado: <?= badgeEstado($t['estado']) ?></span>
      <span>Categoría: <?= h($t['categoria']) ?></span>
      <?php if ($t['cn']): ?><span>Cliente: <?= h($t['cn'].' '.$t['ca']) ?></span><?php endif; ?>
      <span>Creador: <?= h($t['creador']) ?></span>
    </div>
  </div>

  <div style="border-top:1px solid var(--border);padding-top:16px;">
    <h4 style="margin-bottom:12px;">Conversación</h4>
    <?php if (empty($respuestas)): ?>
      <p style="color:var(--muted);">Sin respuestas aún</p>
    <?php else: foreach ($respuestas as $r): ?>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px;<?= $r['es_interno']?'border-left:3px solid var(--warning);':'' ?>">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <strong><?= h($r['nombre'].' '.$r['apellido']) ?> <?= $r['es_interno']?'<span style="color:var(--warning);font-size:.75rem;">(interno)</span>':'' ?></strong>
          <small style="color:var(--muted);"><?= fecha($r['created_at']) ?></small>
        </div>
        <p style="white-space:pre-wrap;"><?= h($r['mensaje']) ?></p>
      </div>
    <?php endforeach; endif; ?>
  </div>

  <?php if (!in_array($t['estado'], ['cerrado','resuelto'], true) || $isStaff): ?>
  <form method="POST" style="margin-top:16px;">
    <?= csrf_field() ?>
    <div class="form-group">
      <label class="form-label">Responder</label>
      <textarea name="mensaje" class="form-control" maxlength="5000" required></textarea>
    </div>
    <div class="grid grid-2">
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select name="estado" class="form-control">
          <?php foreach ($allowedStates as $st): ?>
            <option value="<?= $st ?>" <?= $t['estado']===$st?'selected':'' ?>><?= h(ucfirst(str_replace('_',' ',$st))) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <?php if ($isStaff): ?>
      <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:24px;">
        <input type="checkbox" name="interno" id="interno"> <label for="interno" style="color:var(--muted);">Nota interna</label>
      </div>
      <?php endif; ?>
    </div>
    <button class="btn btn-primary"><i class="fa-solid fa-reply"></i> Enviar respuesta</button>
  </form>
  <?php else: ?>
    <p style="color:var(--muted);margin-top:16px;">Este ticket ya está resuelto. Si necesita más ayuda, abra uno nuevo desde su portal.</p>
  <?php endif; ?>
</div>
<?php
if ($isStaff) {
    require_once __DIR__ . '/../../includes/footer.php';
} else {
    require_once __DIR__ . '/../../includes/store_footer.php';
}
