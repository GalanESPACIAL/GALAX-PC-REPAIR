<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('soporte');
$pageTitle = 'Nuevo Ticket';
$clientes = db()->query("SELECT * FROM clientes ORDER BY nombre")->fetchAll();
$usuarios = db()->query("SELECT * FROM usuarios WHERE rol_id IN (1,3) AND estado='activo' ORDER BY nombre")->fetchAll();
$errors = [];

if ($_SERVER['REQUEST_METHOD']==='POST') {
    require_csrf();
    $asunto = trim((string)($_POST['asunto'] ?? ''));
    $descripcion = trim((string)($_POST['descripcion'] ?? ''));
    $cliente_id = (int)($_POST['cliente_id'] ?? 0) ?: null;
    $prioridad = (string)($_POST['prioridad'] ?? 'media');
    $categoria = (string)($_POST['categoria'] ?? 'general');
    $asignado_a = (int)($_POST['asignado_a'] ?? 0) ?: null;
    if (!in_array($prioridad, ['baja','media','alta','urgente'], true)) $prioridad = 'media';
    if (!in_array($categoria, ['general','hardware','software','redes','garantia'], true)) $categoria = 'general';
    if ($asunto===''||$descripcion==='') $errors[]='Asunto y descripción son obligatorios';
    if (empty($errors)) {
        $codigo = generateCode('TKT', 'tickets');
        $stmt = db()->prepare("INSERT INTO tickets (codigo,asunto,descripcion,cliente_id,usuario_id,asignado_a,prioridad,estado,categoria) VALUES (?,?,?,?,?,?,?, 'abierto', ?)");
        $stmt->execute([$codigo,$asunto,$descripcion,$cliente_id,(int)$_SESSION['user_id'],$asignado_a,$prioridad,$categoria]);
        audit_log('create_ticket', 'tickets', db()->lastInsertId());
        flash('success','Ticket creado: '.$codigo);
        redirect(BASE_URL.'/modules/support/index.php');
    }
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card" style="max-width:760px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-ticket"></i> Nuevo Ticket de Soporte</div>
    <a href="<?= SITE_URL ?>/modules/support/index.php" class="btn btn-ghost btn-sm"><i class="fa-solid fa-arrow-left"></i> Volver</a>
  </div>
  <?php if ($errors): ?>
    <div class="alert alert-danger"><?= h(implode(', ',$errors)) ?></div>
  <?php endif; ?>
  <form method="POST">
    <?= csrf_field() ?>
    <div class="form-group"><label class="form-label">Asunto *</label><input name="asunto" class="form-control" required value="<?= h($_POST['asunto']??'') ?>"></div>
    <div class="form-group"><label class="form-label">Descripcion *</label><textarea name="descripcion" class="form-control" required><?= h($_POST['descripcion']??'') ?></textarea></div>
    <div class="grid grid-2">
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <select name="cliente_id" class="form-control">
          <option value="">-- Sin cliente --</option>
          <?php foreach ($clientes as $c): ?>
            <option value="<?= $c['id'] ?>"><?= h($c['nombre'].' '.$c['apellido']) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Asignar a</label>
        <select name="asignado_a" class="form-control">
          <option value="">-- Sin asignar --</option>
          <?php foreach ($usuarios as $u): ?>
            <option value="<?= $u['id'] ?>"><?= h($u['nombre'].' '.$u['apellido']) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="form-group">
        <label class="form-label">Prioridad</label>
        <select name="prioridad" class="form-control">
          <option value="baja">Baja</option>
          <option value="media" selected>Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select name="categoria" class="form-control">
          <option value="general">General</option>
          <option value="hardware">Hardware</option>
          <option value="software">Software</option>
          <option value="redes">Redes</option>
          <option value="garantia">Garantia</option>
        </select>
      </div>
    </div>
    <button class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Crear Ticket</button>
  </form>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
