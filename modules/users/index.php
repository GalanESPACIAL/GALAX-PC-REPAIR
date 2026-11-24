<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('usuarios');
$pageTitle = 'Usuarios';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'deactivate') {
    require_csrf();
    $id = (int)($_POST['id'] ?? 0);
    if ($id !== (int)($_SESSION['user_id'] ?? 0)) {
        db()->prepare("UPDATE usuarios SET estado='inactivo' WHERE id=?")->execute([$id]);
        audit_log('deactivate_user', 'usuarios', $id);
        flash('success', 'Usuario desactivado.');
    } else {
        flash('error', 'No puede desactivar su propia cuenta.');
    }
    redirect(BASE_URL.'/modules/users/index.php');
}

if ($_SERVER['REQUEST_METHOD']==='POST') {
    require_csrf();
    $id = (int)($_POST['id'] ?? 0);
    $nombre = trim($_POST['nombre'] ?? '');
    $apellido = trim($_POST['apellido'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $telefono = trim($_POST['telefono'] ?? '');
    $rol_id = (int)($_POST['rol_id'] ?? 4);
    $estado = $_POST['estado'] ?? 'activo';
    $password = (string)($_POST['password'] ?? '');
    $avatar = (string)($_POST['avatar'] ?? '');
    if (!in_array($avatar, array_merge(avatar_candidates(), ['', 'neutro']), true)) $avatar = '';
    if ($id === 0 && mb_strlen($password) < 16) {
        flash('error', 'La contraseña inicial debe tener al menos 16 caracteres.');
        redirect(BASE_URL.'/modules/users/index.php');
    }
    if ($id > 0 && $password !== '' && mb_strlen($password) < 16) {
        flash('error', 'La nueva contraseña debe tener al menos 16 caracteres.');
        redirect(BASE_URL.'/modules/users/index.php');
    }
    if (!valid_email($email)) {
        flash('error', 'Correo electrónico inválido.');
        redirect(BASE_URL.'/modules/users/index.php');
    }
    if ($nombre!=='' && $apellido!=='' && $email!=='') {
        $email = mb_strtolower($email);
        $supabaseUid = null;
        try {
            if ($id > 0) {
                $s = db()->prepare('SELECT supabase_uid FROM usuarios WHERE id=? LIMIT 1');
                $s->execute([$id]);
                $row = $s->fetch();
                $supabaseUid = $row ? (string)($row['supabase_uid'] ?? '') : '';
                if (supabase_is_configured() && $supabaseUid !== '' && $password !== '') {
                    supabase_admin_update_user($supabaseUid, ['password' => $password]);
                }
                db()->prepare("UPDATE usuarios SET nombre=?,apellido=?,email=?,telefono=?,rol_id=?,estado=? WHERE id=?")->execute([$nombre,$apellido,$email,$telefono,$rol_id,$estado,$id]);
                flash('success','Usuario actualizado');
            } else {
                $hash = password_hash(random_token(24), PASSWORD_DEFAULT);
                if (supabase_is_configured()) {
                    $authUser = supabase_admin_create_user($email, $password, [
                        'nombre' => $nombre, 'apellido' => $apellido,
                    ]);
                    $supabaseUid = (string)($authUser['id'] ?? '');
                }
                db()->prepare("INSERT INTO usuarios (nombre,apellido,email,password,telefono,avatar,rol_id,estado,supabase_uid) VALUES (?,?,?,?,?,?,?,?,?)")
                   ->execute([$nombre,$apellido,$email,$hash,$telefono,$avatar ?: null,$rol_id,$estado,$supabaseUid ?: null]);
                audit_log('create_user', 'usuarios', db()->lastInsertId());
                flash('success','Usuario creado' . ($supabaseUid !== '' ? ' en Supabase Auth' : ''));
            }
        } catch (Throwable $e) {
            flash('error', 'No se pudo completar la operación: ' . mb_substr($e->getMessage(), 0, 160));
        }
        redirect(SITE_URL.'/modules/users/index.php');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'delete') {
    require_csrf();
    $id = (int)($_POST['id'] ?? 0);
    $self = (int)($_SESSION['user_id'] ?? 0);
    $refs = [
        ['ai_conversaciones', 'usuario_id'], ['carritos', 'usuario_id'], ['clientes', 'usuario_id'],
        ['compras_proveedor', 'usuario_id'], ['inventario_movimientos', 'usuario_id'],
        ['notificaciones', 'usuario_id'], ['pedidos', 'usuario_id'], ['reparaciones', 'tecnico_id'],
    ];
    if ($id !== $self) {
        $blocked = [];
        foreach ($refs as [$table, $col]) {
            $st = db()->prepare("SELECT COUNT(*) AS c FROM `$table` WHERE `$col` = ?");
            $st->execute([$id]);
            if ((int)$st->fetch()['c'] > 0) $blocked[] = $table;
        }
        if ($blocked) {
            flash('error', 'No se puede quitar: hay registros asociados en ' . implode(', ', $blocked) . '.');
        } else {
            db()->prepare('DELETE FROM usuarios WHERE id=?')->execute([$id]);
            audit_log('delete_user', 'usuarios', $id);
            flash('success', 'Usuario quitado.');
        }
    } else {
        flash('error', 'No puede quitar su propia cuenta.');
    }
    redirect(SITE_URL.'/modules/users/index.php');
}

$estadoFilter = trim((string)($_GET['estado'] ?? ''));
$usuarios = $estadoFilter !== ''
  ? db()->prepare('SELECT u.*, r.nombre as rol_nombre FROM usuarios u JOIN roles r ON u.rol_id=r.id WHERE u.estado=? ORDER BY u.id DESC')->fetchAll([$estadoFilter])
  : db()->query("SELECT u.*, r.nombre as rol_nombre FROM usuarios u JOIN roles r ON u.rol_id=r.id ORDER BY u.id DESC")->fetchAll();
$roles = db()->query("SELECT * FROM roles ORDER BY id")->fetchAll();
$edit = null;
if (isset($_GET['edit'])) {
    $s = db()->prepare("SELECT * FROM usuarios WHERE id=?");
    $s->execute([(int)$_GET['edit']]);
    $edit = $s->fetch();
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="grid grid-2">
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-user-shield"></i> <?= $edit?'Editar':'Nuevo' ?> Usuario</div></div>
    <form method="POST">
      <?= csrf_field() ?>
      <input type="hidden" name="id" value="<?= $edit['id'] ?? 0 ?>">
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">Nombre *</label><input name="nombre" class="form-control" required value="<?= h($edit['nombre'] ?? '') ?>"></div>
        <div class="form-group"><label class="form-label">Apellido *</label><input name="apellido" class="form-control" required value="<?= h($edit['apellido'] ?? '') ?>"></div>
      </div>
      <div class="form-group"><label class="form-label">Email *</label><input type="email" name="email" class="form-control" required value="<?= h($edit['email'] ?? '') ?>"></div>
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">Telefono</label><input name="telefono" class="form-control" value="<?= h($edit['telefono'] ?? '') ?>"></div>
        <div class="form-group">
          <label class="form-label">Rol</label>
          <select name="rol_id" class="form-control">
            <?php foreach ($roles as $r): ?>
              <option value="<?= $r['id'] ?>" <?= (($edit['rol_id'] ?? 4)==$r['id'])?'selected':'' ?>><?= h($r['nombre']) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select name="estado" class="form-control">
            <option value="activo" <?= ($edit['estado']??'activo')=='activo'?'selected':'' ?>>Activo</option>
            <option value="inactivo" <?= ($edit['estado']??'')=='inactivo'?'selected':'' ?>>Inactivo</option>
            <option value="bloqueado" <?= ($edit['estado']??'')=='bloqueado'?'selected':'' ?>>Bloqueado</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Contraseña <?= $edit?'(dejar vacío para no cambiar)':'' ?></label><input type="password" name="password" class="form-control" minlength="8"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Avatar</label>
        <select name="avatar" class="form-control">
          <option value="">Predeterminado</option>
          <?php foreach (avatar_candidates() as $key): ?>
            <option value="<?= h($key) ?>" <?= (($edit['avatar'] ?? '') === $key) ? 'selected' : '' ?>><?= h(ucfirst($key)) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <button class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar</button>
      <?php if ($edit): ?><a href="<?= SITE_URL ?>/modules/users/index.php" class="btn btn-ghost">Cancelar</a><?php endif; ?>
    </form>
  </div>
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fa-solid fa-users"></i> Listado de Usuarios</div>
      <div style="display:flex;gap:8px;">
        <a class="btn btn-ghost btn-sm" href="?estado=activo">Solo activos</a>
        <a class="btn btn-ghost btn-sm" href="?estado=">Todos</a>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
        <?php foreach ($usuarios as $u): ?>
          <tr>
            <td><?= h($u['nombre'].' '.$u['apellido']) ?></td>
            <td><?= h($u['email']) ?></td>
            <td><?= h($u['rol_nombre']) ?></td>
            <td><?= badgeEstado($u['estado']) ?></td>
            <td style="display:flex;gap:6px;">
              <a href="?edit=<?= $u['id'] ?>&estado=<?= urlencode($_GET['estado'] ?? '') ?>" class="btn btn-info btn-sm btn-icon"><i class="fa-solid fa-pen"></i></a>
              <form method="post" onsubmit="return confirm('¿Desactivar este usuario?')" style="margin:0;">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="deactivate">
                <input type="hidden" name="id" value="<?= (int)$u['id'] ?>">
                <button class="btn btn-danger btn-sm btn-icon" type="submit" title="Desactivar"><i class="fa-solid fa-trash"></i></button>
              </form>
              <form method="post" onsubmit="return confirm('¿Quitar (eliminar) la cuenta de este usuario? Los registros asociados no se borran.')" style="margin:0;">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= (int)$u['id'] ?>">
                <button class="btn btn-ghost btn-sm btn-icon" type="submit" title="Quitar cuenta"><i class="fa-solid fa-user-xmark"></i></button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        <?php if (empty($usuarios)): ?>
        <tr><td colspan="5" style="text-align:center;color:var(--muted);">Sin usuarios con este filtro.</td></tr>
        <?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>
  <div class="card" style="margin-top:18px;">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-shield-halved"></i> Registro de acceso del usuario</div></div>
    <p class="muted" style="margin:0;font-size:.85rem">Solo el personal con permiso "usuarios" puede ver, desactivar o quitar cuentas. Quitar: las compras/pedidos/carritos asociados deben quedar protegidos por restricciones de base de datos.</p>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
