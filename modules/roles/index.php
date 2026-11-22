<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('roles');
$pageTitle = 'Roles';

$allPermissions = [];
try {
    $allPermissions = db()->query('SELECT codigo, descripcion FROM permisos ORDER BY codigo')->fetchAll(PDO::FETCH_KEY_PAIR);
} catch (Throwable $e) {
    $allPermissions = [];
}
$permisosDisponibles = array_keys($allPermissions);
if (!$permisosDisponibles) {
    $permisosDisponibles = ['dashboard','productos','categorias','clientes','ventas','soporte','usuarios','roles','configuracion','pedidos','reparaciones','inventario','reportes','mis_compras'];
}

if ($_SERVER['REQUEST_METHOD']==='POST') {
    require_csrf();
    $id = (int)($_POST['id'] ?? 0);
    $nombre = trim((string)($_POST['nombre'] ?? ''));
    $descripcion = trim((string)($_POST['descripcion'] ?? ''));
    $permisosPost = array_values(array_filter((array)($_POST['permisos'] ?? []), fn($p) => in_array((string)$p, $permisosDisponibles, true)));
    $permisos = implode(',', $permisosPost);
    if ($nombre !== '') {
        $db = db();
        if ($id > 0) {
            $db->prepare("UPDATE roles SET nombre=?,descripcion=?,permisos=? WHERE id=?")->execute([$nombre,$descripcion,$permisos,$id]);
        } else {
            $db->prepare("INSERT INTO roles (nombre,descripcion,permisos) VALUES (?,?,?)")->execute([$nombre,$descripcion,$permisos]);
            $id = (int)$db->lastInsertId();
        }
        $db->prepare('DELETE FROM rol_permiso WHERE rol_id=?')->execute([$id]);
        $ins = $db->prepare('INSERT INTO rol_permiso (rol_id, permiso_id) SELECT ?, id FROM permisos WHERE codigo IN (' . implode(',', array_fill(0, max(1, count($permisosPost)), '?')) . ') ON CONFLICT DO NOTHING');
        $ins->execute(array_merge([$id], $permisosPost ?: ['']));
        audit_log('save_role', 'roles', $id);
        flash('success','Rol y permisos actualizados. Los cambios se reflejan al iniciar una nueva sesión.');
        redirect(BASE_URL.'/modules/roles/index.php');
    }
}

$roles = db()->query("SELECT * FROM roles ORDER BY id")->fetchAll();
$edit = null;
if (isset($_GET['edit'])) {
    $s = db()->prepare("SELECT * FROM roles WHERE id=?");
    $s->execute([(int)$_GET['edit']]);
    $edit = $s->fetch();
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="grid grid-2">
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-key"></i> <?= $edit?'Editar':'Nuevo' ?> Rol</div></div>
    <form method="POST">
      <?= csrf_field() ?>
      <input type="hidden" name="id" value="<?= $edit['id'] ?? 0 ?>">
      <div class="form-group"><label class="form-label">Nombre</label><input name="nombre" class="form-control" required value="<?= h($edit['nombre'] ?? '') ?>"></div>
      <div class="form-group"><label class="form-label">Descripción</label><textarea name="descripcion" class="form-control"><?= h($edit['descripcion'] ?? '') ?></textarea></div>
      <div class="form-group">
        <label class="form-label">Permisos</label>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
          <?php
          $permsEdit = explode(',', $edit['permisos'] ?? '');
          foreach ($permisosDisponibles as $p): ?>
            <label style="display:flex;align-items:center;gap:6px;color:var(--text);font-size:.85rem;">
              <input type="checkbox" name="permisos[]" value="<?= h($p) ?>" <?= in_array($p,$permsEdit)?'checked':'' ?>> <?= h($allPermissions[$p] ?? ucfirst(str_replace('_',' ',$p))) ?>
            </label>
          <?php endforeach; ?>
        </div>
      </div>
      <button class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar</button>
      <?php if ($edit): ?><a href="<?= SITE_URL ?>/modules/roles/index.php" class="btn btn-ghost">Cancelar</a><?php endif; ?>
    </form>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-list"></i> Roles del Sistema</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Descripcion</th><th>Permisos</th><th>Acciones</th></tr></thead>
        <tbody>
        <?php foreach ($roles as $r): ?>
          <tr>
            <td><?= h($r['nombre']) ?></td>
            <td><?= h($r['descripcion']) ?></td>
            <td style="font-size:.75rem;color:var(--muted);"><?= h($r['permisos']) ?></td>
            <td><a href="?edit=<?= $r['id'] ?>" class="btn btn-info btn-sm btn-icon"><i class="fa-solid fa-pen"></i></a></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
