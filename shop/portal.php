<?php
require_once __DIR__ . '/../includes/repository.php';
requireLogin();
$pageTitle = 'Mi cuenta';
$activeNav = 'portal';
$user = currentUser();
$tab = (string)($_GET['tab'] ?? 'pedidos');
if (!in_array($tab, ['pedidos','reparaciones','tickets','perfil'], true)) {
    $tab = 'pedidos';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $action = (string)($_POST['action'] ?? '');
    if ($action === 'perfil') {
        $nombre = trim((string)($_POST['nombre'] ?? ''));
        $apellido = trim((string)($_POST['apellido'] ?? ''));
        $telefono = trim((string)($_POST['telefono'] ?? ''));
        $direccion = trim((string)($_POST['direccion'] ?? ''));
        if (mb_strlen($nombre) < 2 || mb_strlen($apellido) < 2) {
            flash('error', 'Nombre y apellido son obligatorios.');
        } else {
            $avatar = (string)($_POST['avatar'] ?? '');
            $stored = $user['avatar'];
            if (in_array($avatar, avatar_candidates(), true)) {
                $stored = $avatar;
            } elseif (isset($_FILES['avatar_file'])) {
                $uploaded = handle_avatar_upload($_FILES['avatar_file']);
                if ($uploaded !== null) {
                    $stored = $uploaded;
                } else {
                    flash('error', 'La imagen de avatar debe ser PNG, JPG o WEBP de hasta 2 MB.');
                }
            }
            db()->prepare('UPDATE usuarios SET nombre=?, apellido=?, telefono=?, direccion=?, avatar=? WHERE id=?')
              ->execute([$nombre, $apellido, mb_substr($telefono,0,32), mb_substr($direccion,0,255), $stored, (int)$user['id']]);
            audit_log('update_profile', 'usuarios', $user['id']);
            flash('success', 'Datos actualizados correctamente.');
        }
        redirect(BASE_URL . '/shop/portal.php?tab=perfil');
    }
    if ($action === 'borrar_chat') {
        $db = db();
        $stmt = $db->prepare('SELECT id FROM ai_conversaciones WHERE usuario_id=? OR session_token=?');
        $stmt->execute([(int)$user['id'], cart_session_token()]);
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
        if ($ids) {
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $db->prepare("DELETE FROM ai_mensajes WHERE conversacion_id IN ($marks)")->execute($ids);
            $db->prepare("DELETE FROM ai_conversaciones WHERE id IN ($marks)")->execute($ids);
        }
        audit_log('delete_chat_history', 'ai_conversaciones', $user['id']);
        flash('success', 'Historial del asistente eliminado.');
        redirect(BASE_URL . '/shop/portal.php?tab=perfil');
    }
    if ($action === 'ticket') {
        $asunto = trim((string)($_POST['asunto'] ?? ''));
        $mensaje = trim((string)($_POST['mensaje'] ?? ''));
        if (mb_strlen($asunto) < 4 || mb_strlen($mensaje) < 10) {
            flash('error', 'Ingrese un asunto y una descripción de al menos 10 caracteres.');
        } else {
            $clienteStmt = db()->prepare('SELECT id FROM clientes WHERE usuario_id=? LIMIT 1');
            $clienteStmt->execute([(int)$user['id']]);
            $clienteId = $clienteStmt->fetchColumn() ?: null;
            $code = generateCode('TKT', 'tickets');
            db()->prepare('INSERT INTO tickets (codigo, asunto, descripcion, cliente_id, usuario_id, prioridad, estado, categoria) VALUES (?,?,?,?,?,\'media\',\'abierto\',\'general\')')
              ->execute([$code, mb_substr($asunto,0,200), $mensaje, $clienteId, (int)$user['id']]);
            audit_log('create_ticket', 'tickets', $code);
            flash('success', 'Ticket ' . $code . ' registrado.');
        }
        redirect(BASE_URL . '/shop/portal.php?tab=tickets');
    }
}

$orders = orders_for_user((int)$user['id']);
$repairs = [];
try {
    $stmt = db()->prepare(
        'SELECT r.* FROM reparaciones r
          LEFT JOIN clientes c ON c.id=r.cliente_id
          WHERE r.usuario_id=? OR (r.cliente_id IS NOT NULL AND c.usuario_id=?)
          ORDER BY r.id DESC LIMIT 50'
    );
    $stmt->execute([(int)$user['id'], (int)$user['id']]);
    $repairs = $stmt->fetchAll();
} catch (Throwable $e) {}
$tickets = [];
try {
    $stmt = db()->prepare(
        'SELECT t.* FROM tickets t LEFT JOIN clientes c ON c.id=t.cliente_id
          WHERE t.usuario_id=? OR (t.cliente_id IS NOT NULL AND c.usuario_id=?)
          ORDER BY t.id DESC LIMIT 50'
    );
    $stmt->execute([(int)$user['id'], (int)$user['id']]);
    $tickets = $stmt->fetchAll();
} catch (Throwable $e) {}
$chatMessages = [];
try {
    $stmt = db()->prepare(
        'SELECT m.rol, m.mensaje, m.creado_en
           FROM ai_mensajes m JOIN ai_conversaciones c ON c.id=m.conversacion_id
          WHERE c.usuario_id=? ORDER BY m.id DESC LIMIT 10'
    );
    $stmt->execute([(int)$user['id']]);
    $chatMessages = $stmt->fetchAll();
} catch (Throwable $e) {}

require_once __DIR__ . '/../includes/store_header.php';
?>
<div class="section-head" style="margin-top:6px;">
  <div>
    <span class="eyebrow">Área privada</span>
    <h1 style="font-size:2rem;">Hola, <?= h($user['nombre']) ?></h1>
    <p>Consulta tus pedidos, reparaciones, tickets y gestiona tus datos personales.</p>
  </div>
  <img class="avatar-img" style="width:52px;height:52px;" src="<?= h(avatar_url_from_stored($user['avatar'])) ?>" alt="Tu avatar">
</div>

<div class="portal-layout">
  <nav class="card portal-nav" style="padding:10px;">
    <?php foreach (['pedidos'=>'<i class="fa-solid fa-box"></i> Mis pedidos','reparaciones'=>'<i class="fa-solid fa-laptop-medical"></i> Mis reparaciones','tickets'=>'<i class="fa-solid fa-headset"></i> Mis tickets','perfil'=>'<i class="fa-solid fa-user-gear"></i> Mi perfil'] as $key=>$label): ?>
      <a class="chip" style="display:flex;width:100%;margin-bottom:5px;" href="<?= BASE_URL ?>/shop/portal.php?tab=<?= $key ?>" <?= $tab===$key?'data-active="1"':'' ?>><?= $label ?></a>
    <?php endforeach; ?>
    <a class="chip" style="display:flex;width:100%;margin-top:14px;" href="<?= BASE_URL ?>/auth/logout.php"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</a>
  </nav>

  <div>
    <?php if ($tab === 'pedidos'): ?>
      <section class="card" style="padding:22px;">
        <h2 class="form-section-title" style="margin-top:0;"><i class="fa-solid fa-box"></i> Mis pedidos</h2>
        <?php if (!$orders): ?>
          <div class="empty-state"><i class="fa-solid fa-box-open"></i><p>Aún no tiene pedidos. <a href="<?= BASE_URL ?>/shop/catalog.php">Explorar catálogo</a></p></div>
        <?php else: ?>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Código</th><th>Fecha</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead>
          <tbody>
            <?php foreach ($orders as $o): ?>
            <tr>
              <td><strong><?= h($o['codigo']) ?></strong></td>
              <td><?= h(fecha($o['creado_en'])) ?></td>
              <td><?= badgeEstado($o['estado']) ?></td>
              <td><?= h(money($o['total'])) ?></td>
              <td>
                <a class="btn btn-sm btn-outline" href="<?= BASE_URL ?>/shop/success.php?pedido=<?= (int)$o['id'] ?>"><i class="fa-solid fa-eye"></i> Detalle</a>
                <a class="btn btn-sm btn-outline" href="<?= BASE_URL ?>/shop/receipt.php?pedido=<?= (int)$o['id'] ?>" target="_blank" rel="noopener"><i class="fa-solid fa-eye"></i> PNG</a>
                <a class="btn btn-sm btn-outline" href="<?= BASE_URL ?>/shop/receipt.php?pedido=<?= (int)$o['id'] ?>&download=1"><i class="fa-solid fa-download"></i> Descargar</a>
              </td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table></div>
        <?php endif; ?>
      </section>

    <?php elseif ($tab === 'reparaciones'): ?>
      <section class="card" style="padding:22px;">
        <h2 class="form-section-title" style="margin-top:0;"><i class="fa-solid fa-laptop-medical"></i> Mis reparaciones</h2>
        <p style="color:var(--gx-muted);font-size:.86rem;"><a href="<?= BASE_URL ?>/shop/repair_request.php">Solicitar una nueva reparación →</a></p>
        <?php if (!$repairs): ?>
          <div class="empty-state"><i class="fa-solid fa-screwdriver-wrench"></i><p>No tiene reparaciones registradas.</p></div>
        <?php else: ?>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Código</th><th>Equipo</th><th>Ingreso</th><th>Estado</th><th>Presupuesto</th><th>Ver</th></tr></thead>
          <tbody>
            <?php foreach ($repairs as $r): ?>
            <tr>
              <td><strong><?= h($r['codigo']) ?></strong></td>
              <td><?= h(trim($r['marca'].' '.$r['modelo'])) ?: h($r['tipo_equipo']) ?></td>
              <td><?= h(fecha_corta($r['fecha_recepcion'])) ?></td>
              <td><?= badgeEstado($r['estado']) ?></td>
              <td><?= h(money($r['presupuesto'])) ?></td>
              <td><a class="btn btn-sm btn-outline" href="<?= BASE_URL ?>/modules/repairs/view.php?id=<?= (int)$r['id'] ?>"><i class="fa-solid fa-eye"></i></a></td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table></div>
        <?php endif; ?>
      </section>

    <?php elseif ($tab === 'tickets'): ?>
      <section class="card" style="padding:22px;margin-bottom:18px;">
        <h2 class="form-section-title" style="margin-top:0;"><i class="fa-solid fa-plus"></i> Nuevo ticket</h2>
        <form method="post" class="store-form"><?= csrf_field() ?>
          <input type="hidden" name="action" value="ticket">
          <div class="form-group"><label for="asunto">Asunto</label><input class="form-control" id="asunto" name="asunto" maxlength="200" required></div>
          <div class="form-group"><label for="mensaje">Descripción</label><textarea class="form-control" id="mensaje" name="mensaje" rows="4" maxlength="2000" required></textarea></div>
          <button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i> Enviar ticket</button>
        </form>
      </section>
      <section class="card" style="padding:22px;">
        <h2 class="form-section-title" style="margin-top:0;"><i class="fa-solid fa-headset"></i> Mis tickets</h2>
        <?php if (!$tickets): ?><div class="empty-state"><i class="fa-solid fa-ticket"></i><p>No tiene tickets registrados.</p></div>
        <?php else: ?>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Código</th><th>Asunto</th><th>Fecha</th><th>Estado</th><th>Ver</th></tr></thead>
          <tbody>
            <?php foreach ($tickets as $t): ?>
            <tr>
              <td><?= h($t['codigo']) ?></td><td><?= h($t['asunto']) ?></td>
              <td><?= h(fecha_corta($t['created_at'])) ?></td><td><?= badgeEstado($t['estado']) ?></td>
              <td><a class="btn btn-sm btn-outline" href="<?= BASE_URL ?>/modules/support/view.php?id=<?= (int)$t['id'] ?>"><i class="fa-solid fa-eye"></i></a></td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table></div>
        <?php endif; ?>
      </section>

    <?php else: ?>
      <section class="card" style="padding:22px;">
        <h2 class="form-section-title" style="margin-top:0;"><i class="fa-solid fa-user-gear"></i> Mis datos</h2>
        <form method="post" enctype="multipart/form-data" class="store-form"><?= csrf_field() ?>
          <input type="hidden" name="action" value="perfil">
          <div class="grid grid-2">
            <div class="form-group"><label>Nombre</label><input class="form-control" name="nombre" required value="<?= h($user['nombre']) ?>"></div>
            <div class="form-group"><label>Apellido</label><input class="form-control" name="apellido" required value="<?= h($user['apellido']) ?>"></div>
            <div class="form-group"><label>Correo (no editable)</label><input class="form-control" value="<?= h($user['email']) ?>" disabled></div>
            <div class="form-group"><label>Teléfono</label><input class="form-control" name="telefono" value="<?= h($user['telefono'] ?? '') ?>"></div>
          </div>
          <div class="form-group"><label>Dirección</label><input class="form-control" name="direccion" value="<?= h($user['direccion'] ?? '') ?>"></div>
          <div class="form-group">
            <label>Avatar</label>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0;">
              <?php foreach (avatar_candidates() as $key): ?>
              <label style="cursor:pointer;">
                <input type="radio" name="avatar" value="<?= h($key) ?>" <?= normalize_avatar($user['avatar'])===$key?'checked':'' ?>>
                <img class="avatar-img" src="<?= h(BASE_URL.'/'.AVATAR_FILES[$key]) ?>" alt="<?= h($key) ?>">
              </label>
              <?php endforeach; ?>
            </div>
            <input class="form-control" type="file" name="avatar_file" accept="image/png,image/jpeg,image/webp">
            <small style="color:var(--gx-muted);">O sube tu propia imagen (PNG/JPG/WEBP, máx. 2 MB).</small>
          </div>
          <button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Guardar cambios</button>
        </form>
        <hr style="border-color:var(--gx-border);margin:24px 0;">
        <h3 style="font-size:1rem;"><i class="fa-solid fa-shield-halved"></i> Privacidad del asistente</h3>
        <p style="color:var(--gx-muted);font-size:.84rem;margin:8px 0 14px;">Puede eliminar el historial de conversación con Airi almacenado en el sistema.</p>
        <form method="post" class="store-form"><?= csrf_field() ?>
          <input type="hidden" name="action" value="borrar_chat">
          <button class="btn btn-outline" type="submit" onclick="return confirm('¿Eliminar su historial del asistente?')"><i class="fa-solid fa-trash"></i> Eliminar historial del chat</button>
        </form>
        <?php if ($chatMessages): ?>
          <h3 style="font-size:1rem;margin-top:22px;"><i class="fa-solid fa-comments"></i> Últimos mensajes</h3>
          <div style="max-height:260px;overflow:auto;margin-top:10px;">
            <?php foreach ($chatMessages as $m): ?>
              <div style="border-bottom:1px solid var(--gx-border);padding:8px 0;font-size:.84rem;">
                <strong><?= $m['rol'] === 'usuario' ? 'Usted' : 'Asistente' ?></strong>
                <small style="color:var(--gx-muted);"> · <?= h(fecha($m['creado_en'])) ?></small>
                <div style="white-space:pre-wrap;color:var(--gx-muted);"><?= h(mb_substr($m['mensaje'], 0, 300)) ?></div>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </section>
    <?php endif; ?>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/store_footer.php'; ?>
