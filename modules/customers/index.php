<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('clientes');
$pageTitle = 'Clientes';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $action = (string)($_POST['action'] ?? 'save');
    $id = (int)($_POST['id'] ?? 0);

    if ($action === 'delete') {
        $checks = [
            'ventas' => 'SELECT COUNT(*) FROM ventas WHERE cliente_id=?',
            'pedidos' => 'SELECT COUNT(*) FROM pedidos WHERE cliente_id=?',
            'reparaciones' => 'SELECT COUNT(*) FROM reparaciones WHERE cliente_id=?',
            'tickets' => 'SELECT COUNT(*) FROM tickets WHERE cliente_id=?',
        ];
        $blocked = [];
        foreach ($checks as $label => $sql) {
            $stmt = db()->prepare($sql);
            $stmt->execute([$id]);
            if ((int)$stmt->fetchColumn() > 0) $blocked[] = $label;
        }
        if ($blocked) {
            flash('error', 'No se puede eliminar: el cliente tiene ' . implode(', ', $blocked) . ' asociados. conserve el registro para mantener la integridad.');
        } else {
            db()->prepare("DELETE FROM clientes WHERE id=?")->execute([$id]);
            audit_log('delete_customer', 'clientes', $id);
            flash('success', 'Cliente eliminado.');
        }
        redirect(BASE_URL . '/modules/customers/index.php');
    }

    $nombre = trim((string)($_POST['nombre'] ?? ''));
    $apellido = trim((string)($_POST['apellido'] ?? ''));
    $email = mb_strtolower(trim((string)($_POST['email'] ?? '')));
    $telefono = trim((string)($_POST['telefono'] ?? ''));
    $direccion = trim((string)($_POST['direccion'] ?? ''));
    $dni = trim((string)($_POST['dni'] ?? ''));
    if ($nombre === '' || $apellido === '' || ($email !== '' && !valid_email($email))) {
        flash('error', 'Nombre, apellido y correo válido son obligatorios.');
        redirect(BASE_URL . '/modules/customers/index.php');
    }
    if ($id > 0) {
        db()->prepare("UPDATE clientes SET nombre=?,apellido=?,email=?,telefono=?,direccion=?,dni=? WHERE id=?")
          ->execute([$nombre, $apellido, $email ?: null, $telefono, $direccion, $dni, $id]);
        audit_log('update_customer', 'clientes', $id);
        flash('success', 'Cliente actualizado.');
    } else {
        db()->prepare("INSERT INTO clientes (nombre,apellido,email,telefono,direccion,dni) VALUES (?,?,?,?,?,?)")
          ->execute([$nombre, $apellido, $email ?: null, $telefono, $direccion, $dni]);
        audit_log('create_customer', 'clientes', db()->lastInsertId());
        flash('success', 'Cliente creado.');
    }
    redirect(BASE_URL . '/modules/customers/index.php');
}

$clientes = db()->query("SELECT * FROM clientes ORDER BY id DESC")->fetchAll();
$edit = null;
if (isset($_GET['edit'])) {
    $s = db()->prepare("SELECT * FROM clientes WHERE id=?");
    $s->execute([(int)$_GET['edit']]);
    $edit = $s->fetch();
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="grid grid-2">
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-user-plus"></i> <?= $edit?'Editar':'Nuevo' ?> Cliente</div></div>
    <form method="POST">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="save">
      <input type="hidden" name="id" value="<?= (int)($edit['id'] ?? 0) ?>">
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">Nombre *</label><input name="nombre" class="form-control" required value="<?= h($edit['nombre'] ?? '') ?>"></div>
        <div class="form-group"><label class="form-label">Apellido *</label><input name="apellido" class="form-control" required value="<?= h($edit['apellido'] ?? '') ?>"></div>
      </div>
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">Email</label><input type="email" name="email" class="form-control" value="<?= h($edit['email'] ?? '') ?>"></div>
        <div class="form-group"><label class="form-label">Teléfono</label><input name="telefono" class="form-control" value="<?= h($edit['telefono'] ?? '') ?>"></div>
      </div>
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">DNI</label><input name="dni" class="form-control" value="<?= h($edit['dni'] ?? '') ?>"></div>
        <div class="form-group"><label class="form-label">Dirección</label><input name="direccion" class="form-control" value="<?= h($edit['direccion'] ?? '') ?>"></div>
      </div>
      <button class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar</button>
      <?php if ($edit): ?><a href="<?= BASE_URL ?>/modules/customers/index.php" class="btn btn-ghost">Cancelar</a><?php endif; ?>
    </form>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-users"></i> Listado de Clientes</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>DNI</th><th>Acciones</th></tr></thead>
        <tbody>
        <?php foreach ($clientes as $c): ?>
          <tr>
            <td><?= h($c['nombre'].' '.$c['apellido']) ?></td>
            <td><?= h($c['email']) ?></td>
            <td><?= h($c['telefono']) ?></td>
            <td><?= h($c['dni']) ?></td>
            <td style="display:flex;gap:6px;">
              <a href="?edit=<?= (int)$c['id'] ?>" class="btn btn-info btn-sm btn-icon"><i class="fa-solid fa-pen"></i></a>
              <form method="post" onsubmit="return confirm('¿Eliminar este cliente?')" style="margin:0;">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
                <button class="btn btn-danger btn-sm btn-icon" type="submit" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
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
