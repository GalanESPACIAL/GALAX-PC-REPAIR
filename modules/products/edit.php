<?php
require_once __DIR__ . '/../../includes/repository.php';
require_once __DIR__ . '/../../includes/uploads.php';
requirePermission('productos');
$pageTitle = 'Editar Producto';
$id = (int)($_GET['id'] ?? 0);
$stmt = db()->prepare("SELECT * FROM productos WHERE id=?");
$stmt->execute([$id]);
$prod = $stmt->fetch();
if (!$prod) { flash('error','Producto no encontrado'); redirect(BASE_URL.'/modules/products/index.php'); }
$categorias = db()->query("SELECT * FROM categorias WHERE estado='activo' ORDER BY nombre")->fetchAll();
$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $codigo = trim((string)($_POST['codigo'] ?? ''));
    $nombre = trim((string)($_POST['nombre'] ?? ''));
    $descripcion = trim((string)($_POST['descripcion'] ?? ''));
    $categoria_id = (int)($_POST['categoria_id'] ?? 0);
    $marca = trim((string)($_POST['marca'] ?? ''));
    $modelo = trim((string)($_POST['modelo'] ?? ''));
    $precio_compra = (float)($_POST['precio_compra'] ?? 0);
    $precio_venta = (float)($_POST['precio_venta'] ?? 0);
    $stock = (int)($_POST['stock'] ?? 0);
    $stock_minimo = (int)(($_POST['stock_minimo'] ?? 5));
    $estado = (string)($_POST['estado'] ?? 'activo');
    $publicado = isset($_POST['publicado']) ? 1 : 0;
    $destacado = isset($_POST['destacado']) ? 1 : 0;
    $es_nuevo = isset($_POST['es_nuevo']) ? 1 : 0;
    $precio_oferta = (trim((string)($_POST['precio_oferta'] ?? '')) !== '') ? (float)$_POST['precio_oferta'] : null;
    $imagen = (string)($prod['imagen'] ?? '');
    $urlPost = (string)($_POST['imagen'] ?? '');
    if ($urlPost !== '' && preg_match('#^https?://[^\s]+$#i', $urlPost)) $imagen = $urlPost;
    if (!empty($_FILES['imagen_archivo'])) {
        try {
            $subida = upload_supabase_image($_FILES['imagen_archivo'], 'productos');
            if ($subida !== null) $imagen = $subida;
        } catch (Throwable $e) {
            $errors[] = 'No se pudo subir la imagen: ' . mb_substr($e->getMessage(), 0, 120);
        }
    }
    if (!in_array($estado, ['activo','inactivo'], true)) $estado = 'activo';
    if ($codigo===''||$nombre===''||$categoria_id===0) $errors[]='Campos obligatorios';
    if ($precio_venta < $precio_compra) $errors[]='El precio de venta no puede ser menor al de compra';
    if ($stock < 0 || $stock_minimo < 0) $errors[]='El stock no puede ser negativo';
    if (empty($errors)) {
        $stmt = db()->prepare("UPDATE productos SET codigo=?,nombre=?,descripcion=?,categoria_id=?,marca=?,modelo=?,precio_compra=?,precio_venta=?,precio_oferta=?,destacado=?,es_nuevo=?,stock=?,stock_minimo=?,estado=?,publicado=?,imagen=? WHERE id=?");
        $stmt->execute([$codigo,$nombre,$descripcion,$categoria_id,$marca,$modelo,$precio_compra,$precio_venta,$precio_oferta,$destacado,$es_nuevo,$stock,$stock_minimo,$estado,$publicado,$imagen ?: null,$id]);
        audit_log('update_product', 'productos', $id);
        flash('success','Producto actualizado');
        redirect(BASE_URL . '/modules/products/index.php');
    }
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card" style="max-width:800px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-pen"></i> Editar Producto</div>
    <a href="<?= BASE_URL ?>/modules/products/index.php" class="btn btn-ghost btn-sm"><i class="fa-solid fa-arrow-left"></i> Volver</a>
  </div>
  <?php if ($errors): ?><div class="alert alert-danger"><?= h(implode(', ',$errors)) ?></div><?php endif; ?>
  <form method="POST" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <div class="grid grid-2">
      <div class="form-group"><label class="form-label">Código *</label><input name="codigo" class="form-control" required value="<?= h($_POST['codigo'] ?? $prod['codigo']) ?>"></div>
      <div class="form-group"><label class="form-label">Nombre *</label><input name="nombre" class="form-control" required value="<?= h($_POST['nombre'] ?? $prod['nombre']) ?>"></div>
    </div>
    <div class="form-group"><label class="form-label">Descripción</label><textarea name="descripcion" class="form-control"><?= h($_POST['descripcion'] ?? $prod['descripcion']) ?></textarea></div>
    <div class="grid grid-2">
      <div class="form-group">
        <label class="form-label">Categoría *</label>
        <select name="categoria_id" class="form-control" required>
          <?php foreach ($categorias as $c): ?>
            <option value="<?= $c['id'] ?>" <?= (($_POST['categoria_id'] ?? $prod['categoria_id'])==$c['id'])?'selected':'' ?>><?= h($c['nombre']) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Marca</label><input name="marca" class="form-control" value="<?= h($_POST['marca'] ?? $prod['marca']) ?>"></div>
    </div>
    <div class="grid grid-2">
      <div class="form-group"><label class="form-label">Modelo</label><input name="modelo" class="form-control" value="<?= h($_POST['modelo'] ?? $prod['modelo']) ?>"></div>
      <div class="form-group"><label class="form-label">Stock</label><input type="number" name="stock" class="form-control" value="<?= h($_POST['stock'] ?? $prod['stock']) ?>"></div>
    </div>
    <div class="grid grid-3">
      <div class="form-group"><label class="form-label">Precio Compra</label><input type="number" step="0.01" name="precio_compra" class="form-control" value="<?= h($_POST['precio_compra'] ?? $prod['precio_compra']) ?>"></div>
      <div class="form-group"><label class="form-label">Precio Venta</label><input type="number" step="0.01" name="precio_venta" class="form-control" value="<?= h($_POST['precio_venta'] ?? $prod['precio_venta']) ?>"></div>
      <div class="form-group"><label class="form-label">Stock Mínimo</label><input type="number" name="stock_minimo" class="form-control" value="<?= h($_POST['stock_minimo'] ?? $prod['stock_minimo']) ?>"></div>
    </div>
    <div class="grid grid-2">
      <div class="form-group"><label class="form-label">Precio oferta (opcional)</label><input type="number" step="0.01" name="precio_oferta" class="form-control" value="<?= h($_POST['precio_oferta'] ?? $prod['precio_oferta'] ?? '') ?>"></div>
      <div class="form-group" style="display:flex;align-items:center;gap:16px;padding-top:24px;">
        <label style="color:var(--muted);"><input type="checkbox" name="destacado" value="1" <?= !empty($_POST['destacado']) || !empty($prod['destacado']) ? 'checked' : '' ?>> Destacado</label>
        <label style="color:var(--muted);"><input type="checkbox" name="es_nuevo" value="1" <?= !empty($_POST['es_nuevo']) || !empty($prod['es_nuevo']) ? 'checked' : '' ?>> Novedad</label>
      </div>
    </div>
    <?php if (!empty($prod['imagen'])): ?>
      <div class="form-group"><label class="form-label">Imagen actual</label><br><img src="<?= h(product_image_url($prod['imagen'])) ?>" alt="Producto" style="max-height:120px;border-radius:10px;"></div>
    <?php endif; ?>
    <div class="form-group"><label class="form-label">Cambiar fotografía (Supabase Storage)</label><input type="file" name="imagen_archivo" accept="image/png,image/jpeg,image/webp" class="form-control"></div>
    <div class="form-group"><label class="form-label">O URL de imagen externa</label><input type="url" name="imagen" class="form-control" value="<?= h($urlPost ?? '') ?>" placeholder="https://..."></div>
    <div class="grid grid-2">
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select name="estado" class="form-control">
          <option value="activo" <?= $prod['estado']=='activo'?'selected':'' ?>>Activo</option>
          <option value="inactivo" <?= $prod['estado']=='inactivo'?'selected':'' ?>>Inactivo</option>
        </select>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:24px;">
        <input type="checkbox" name="publicado" value="1" <?= !empty($_POST['publicado']) || $prod['publicado'] ? 'checked' : '' ?>>
        <label style="color:var(--muted);">Publicado en la tienda online</label>
      </div>
    </div>
    <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Actualizar</button>
  </form>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
