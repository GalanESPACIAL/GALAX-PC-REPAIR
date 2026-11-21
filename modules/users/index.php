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
    if ($id === 0 && mb_strlen($password) < 8) {
        flash('error', 'La contraseña inicial debe tener al menos 8 caracteres.');
        redirect(BASE_URL.'/modules/users/index.php');
    }
    if ($id > 0 && $password !== '' && mb_strlen($password) < 8) {
        flash('error', 'La nueva contraseña debe tener al menos 8 caracteres.');
        redirect(BASE_URL.'/modules/users/index.php');
    }
    if (!valid_email($email)) {
        flash('error', 'Correo electrónico inválido.');
        redirect(BASE_URL.'/modules/users/index.php');
    }
    if ($nombre!=='' && $apellido!=='' && $email!=='') {
        if ($id > 0) {
            if ($password !== '') {
                $hash = password_hash($password, PASSWORD_DEFAULT);
                db()->prepare("UPDATE usuarios SET nombre=?,apellido=?,email=?,telefono=?,rol_id=?,estado=?,password=? WHERE id=?")->execute([$nombre,$apellido,$email,$telefono,$rol_id,$estado,$hash,$id]);
            } else {
                db()->prepare("UPDATE usuarios SET nombre=?,apellido=?,email=?,telefono=?,rol_id=?,estado=? WHERE id=?")->execute([$nombre,$apellido,$email,$telefono,$rol_id,$estado,$id]);
            }
            flash('success','Usuario actualizado');
        } else {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            db()->prepare("INSERT INTO usuarios (nombre,apellido,email,password,telefono,avatar,rol_id,estado) VALUES (?,?,?,?,?,?,?,?)")->execute([$nombre,$apellido,mb_strtolower($email),$hash,$telefono,$avatar ?: null,$rol_id,$estado]);
            audit_log('create_user', 'usuarios', db()->lastInsertId());
            flash('success','Usuario creado');
        }
        redirect(SITE_URL.'/modules/users/index.php');
    }
}

$usuarios = db()->query("SELECT u.*, r.nombre as rol_nombre FROM usuarios u JOIN roles r ON u.rol_id=r.id ORDER BY u.id DESC")->fetchAll();
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
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-users"></i> Listado de Usuarios</div></div>
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
              <a href="?edit=<?= $u['id'] ?>" class="btn btn-info btn-sm btn-icon"><i class="fa-solid fa-pen"></i></a>
              <form method="post" onsubmit="return confirm('¿Desactivar este usuario?')" style="margin:0;">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="deactivate">
                <input type="hidden" name="id" value="<?= (int)$u['id'] ?>">
                <button class="btn btn-danger btn-sm btn-icon" type="submit" title="Desactivar"><i class="fa-solid fa-trash"></i></button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
