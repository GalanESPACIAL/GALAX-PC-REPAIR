<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('categorias');
$pageTitle = 'Categorias';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'deactivate') {
    require_csrf();
    db()->prepare("UPDATE categorias SET estado='inactivo' WHERE id=?")->execute([(int)($_POST['id'] ?? 0)]);
    audit_log('deactivate_category', 'categorias', (int)($_POST['id'] ?? 0));
    flash('success', 'Categoría desactivada.');
    redirect(BASE_URL . '/modules/categories/index.php');
}
if ($_SERVER['REQUEST_METHOD']==='POST' && isset($_POST['nombre'])) {
    require_csrf();
    $nombre = trim((string)$_POST['nombre']);
    $desc = trim((string)($_POST['descripcion'] ?? ''));
    $icono = (string)$_POST['icono'] ?? 'fa-box';
    $color = (string)$_POST['color'] ?? '#6366f1';
    $id = (int)($_POST['id'] ?? 0);
    if (!preg_match('/^fa-[a-z0-9-]+$/i', $icono)) $icono = 'fa-box';
    if (!preg_match('/^#[0-9a-f]{6}$/i', $color)) $color = '#6366f1';
    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower(trim(strtr($nombre, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n']))));
    if ($nombre !== '') {
        if ($id > 0) {
            db()->prepare("UPDATE categorias SET nombre=?,descripcion=?,icono=?,color=?,slug=? WHERE id=?")->execute([$nombre,$desc,$icono,$color,$slug,$id]);
            audit_log('update_category', 'categorias', $id);
            flash('success','Categoría actualizada');
        } else {
            db()->prepare("INSERT INTO categorias (nombre,descripcion,icono,color,slug) VALUES (?,?,?,?,?)")->execute([$nombre,$desc,$icono,$color,$slug]);
            audit_log('create_category', 'categorias', db()->lastInsertId());
            flash('success','Categoría creada');
        }
        redirect(BASE_URL.'/modules/categories/index.php');
    }
}
$cats = db()->query("SELECT * FROM categorias ORDER BY id DESC")->fetchAll();
$edit = null;
if (isset($_GET['edit'])) {
    $s = db()->prepare("SELECT * FROM categorias WHERE id=?");
    $s->execute([(int)$_GET['edit']]);
    $edit = $s->fetch();
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="grid grid-2">
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fa-solid fa-tags"></i> <?= $edit?'Editar':'Nueva' ?> Categoria</div>
    </div>
    <form method="POST">
      <?= csrf_field() ?>
      <input type="hidden" name="id" value="<?= $edit['id'] ?? 0 ?>">
      <div class="form-group"><label class="form-label">Nombre</label><input name="nombre" class="form-control" required value="<?= h($edit['nombre'] ?? '') ?>"></div>
      <div class="form-group"><label class="form-label">Descripcion</label><textarea name="descripcion" class="form-control"><?= h($edit['descripcion'] ?? '') ?></textarea></div>
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">Icono (FontAwesome)</label><input name="icono" class="form-control" value="<?= h($edit['icono'] ?? 'fa-box') ?>"></div>
        <div class="form-group"><label class="form-label">Color</label><input type="color" name="color" class="form-control" value="<?= h($edit['color'] ?? '#6366f1') ?>" style="height:42px;"></div>
      </div>
      <button class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar</button>
      <?php if ($edit): ?><a href="<?= SITE_URL ?>/modules/categories/index.php" class="btn btn-ghost">Cancelar</a><?php endif; ?>
    </form>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-list"></i> Listado</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Icono</th><th>Nombre</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
        <?php foreach ($cats as $c): ?>
          <tr>
            <td><i class="fa-solid <?= h($c['icono']) ?>" style="color:<?= h($c['color']) ?>;font-size:1.2rem;"></i></td>
            <td><?= h($c['nombre']) ?></td>
            <td><?= badgeEstado($c['estado']) ?></td>
            <td style="display:flex;gap:6px;">
              <a href="?edit=<?= $c['id'] ?>" class="btn btn-info btn-sm btn-icon"><i class="fa-solid fa-pen"></i></a>
              <form method="post" onsubmit="return confirm('¿Desactivar esta categoría?')" style="margin:0;">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="deactivate">
                <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
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
