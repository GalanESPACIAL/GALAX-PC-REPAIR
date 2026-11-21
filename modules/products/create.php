<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('productos');
$pageTitle = 'Nuevo Producto';
$errors = [];
$categorias = db()->query("SELECT * FROM categorias WHERE estado='activo' ORDER BY nombre")->fetchAll();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $codigo = trim((string)($_POST['codigo'] ?? ''));
    $nombre = trim($_POST['nombre'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $categoria_id = (int)($_POST['categoria_id'] ?? 0);
    $marca = trim($_POST['marca'] ?? '');
    $modelo = trim($_POST['modelo'] ?? '');
    $precio_compra = (float)($_POST['precio_compra'] ?? 0);
    $precio_venta = (float)($_POST['precio_venta'] ?? 0);
    $stock = (int)($_POST['stock'] ?? 0);
    $stock_minimo = (int)($_POST['stock_minimo'] ?? 5);
    $publicado = isset($_POST['publicado']) ? 1 : 0;
    $imagen = (string)($_POST['imagen'] ?? '');
    if ($imagen !== '' && !preg_match('#^https?://[^\s]+$#i', $imagen)) $imagen = '';

    if ($codigo===''||$nombre===''||$categoria_id===0) $errors[]='Código, nombre y categoría son obligatorios';
    if ($precio_venta < $precio_compra) $errors[]='El precio de venta no puede ser menor al de compra';
    if ($stock < 0 || $stock_minimo < 0) $errors[]='El stock no puede ser negativo';
    $s = db()->prepare("SELECT id FROM productos WHERE codigo=?");
    $s->execute([$codigo]);
    if ($s->fetch()) $errors[]='El codigo ya existe';

    if (empty($errors)) {
        $stmt = db()->prepare("INSERT INTO productos (codigo,nombre,descripcion,categoria_id,marca,modelo,precio_compra,precio_venta,stock,stock_minimo,publicado,imagen) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$codigo,$nombre,$descripcion,$categoria_id,$marca,$modelo,$precio_compra,$precio_venta,$stock,$stock_minimo,$publicado,$imagen ?: null]);
        audit_log('create_product', 'productos', db()->lastInsertId());
        flash('success','Producto creado correctamente');
        redirect(SITE_URL . '/modules/products/index.php');
    }
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card" style="max-width:800px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-plus"></i> Nuevo Producto</div>
    <a href="<?= SITE_URL ?>/modules/products/index.php" class="btn btn-ghost btn-sm"><i class="fa-solid fa-arrow-left"></i> Volver</a>
  </div>
  <?php if ($errors): ?>
    <div class="alert alert-danger"><i class="fa-solid fa-circle-xmark"></i> <?= h(implode(', ', $errors)) ?></div>
  <?php endif; ?>
  <form method="POST">
    <?= csrf_field() ?>
    <div class="grid grid-2">
      <div class="form-group"><label class="form-label">Codigo *</label><input name="codigo" class="form-control" required value="<?= h($_POST['codigo']??'') ?>"></div>
      <div class="form-group"><label class="form-label">Nombre *</label><input name="nombre" class="form-control" required value="<?= h($_POST['nombre']??'') ?>"></div>
    </div>
    <div class="form-group"><label class="form-label">Descripcion</label><textarea name="descripcion" class="form-control"><?= h($_POST['descripcion']??'') ?></textarea></div>
    <div class="grid grid-2">
      <div class="form-group">
        <label class="form-label">Categoria *</label>
        <select name="categoria_id" class="form-control" required>
          <option value="">Seleccionar...</option>
          <?php foreach ($categorias as $c): ?>
            <option value="<?= $c['id'] ?>" <?= (($_POST['categoria_id']??0)==$c['id'])?'selected':'' ?>><?= h($c['nombre']) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Marca</label><input name="marca" class="form-control" value="<?= h($_POST['marca']??'') ?>"></div>
    </div>
    <div class="grid grid-2">
      <div class="form-group"><label class="form-label">Modelo</label><input name="modelo" class="form-control" value="<?= h($_POST['modelo']??'') ?>"></div>
      <div class="form-group"><label class="form-label">Stock inicial</label><input type="number" name="stock" class="form-control" value="<?= h($_POST['stock']??0) ?>"></div>
    </div>
    <div class="grid grid-3">
      <div class="form-group"><label class="form-label">Precio Compra</label><input type="number" step="0.01" name="precio_compra" class="form-control" value="<?= h($_POST['precio_compra']??0) ?>"></div>
      <div class="form-group"><label class="form-label">Precio Venta</label><input type="number" step="0.01" name="precio_venta" class="form-control" value="<?= h($_POST['precio_venta']??0) ?>"></div>
      <div class="form-group"><label class="form-label">Stock Minimo</label><input type="number" name="stock_minimo" class="form-control" value="<?= h($_POST['stock_minimo']??5) ?>"></div>
    </div>
    <div class="form-group"><label class="form-label">URL de imagen (opcional)</label><input name="imagen" class="form-control" type="url" placeholder="https://..."></div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:8px;color:var(--text);">
        <input type="checkbox" name="publicado" value="1" checked> Publicar en la tienda online
      </label>
    </div>
    <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar Producto</button>
  </form>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
