<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('productos');
$pageTitle = 'Productos';

// Desactivación (.POST + CSRF; nunca por GET)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'deactivate') {
    require_csrf();
    $id = (int)($_POST['id'] ?? 0);
    db()->prepare("UPDATE productos SET estado='inactivo', publicado=0 WHERE id=?")->execute([$id]);
    audit_log('deactivate_product', 'productos', $id);
    flash('success', 'Producto desactivado y retirado del catálogo público.');
    redirect(BASE_URL . '/modules/products/index.php');
}

$search = trim($_GET['q'] ?? '');
$cat = (int)($_GET['cat'] ?? 0);
$sql = "SELECT p.*, c.nombre as categoria FROM productos p LEFT JOIN categorias c ON p.categoria_id=c.id WHERE p.estado='activo'";
$params = [];
if ($search !== '') { $sql .= " AND (p.nombre LIKE ? OR p.codigo LIKE ?)"; $params[]="%$search%"; $params[]="%$search%"; }
if ($cat > 0) { $sql .= " AND p.categoria_id=?"; $params[]=$cat; }
$sql .= " ORDER BY p.id DESC";
$stmt = db()->prepare($sql);
$stmt->execute($params);
$productos = $stmt->fetchAll();
$categorias = db()->query("SELECT * FROM categorias WHERE estado='activo' ORDER BY nombre")->fetchAll();
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-box"></i> Catalogo de Productos</div>
    <a href="<?= SITE_URL ?>/modules/products/create.php" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Nuevo</a>
  </div>

  <form method="GET" style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
    <input type="text" name="q" class="form-control" placeholder="Buscar por nombre o codigo..." value="<?= h($search) ?>" style="max-width:300px;">
    <select name="cat" class="form-control" style="max-width:220px;">
      <option value="0">Todas las categorias</option>
      <?php foreach ($categorias as $c): ?>
        <option value="<?= $c['id'] ?>" <?= $cat==$c['id']?'selected':'' ?>><?= h($c['nombre']) ?></option>
      <?php endforeach; ?>
    </select>
    <button class="btn btn-ghost btn-sm"><i class="fa-solid fa-filter"></i> Filtrar</button>
  </form>

  <div class="table-wrap">
    <table>
      <thead><tr><th>Codigo</th><th>Producto</th><th>Categoria</th><th>Precio Venta</th><th>Stock</th><th>Acciones</th></tr></thead>
      <tbody>
      <?php if (empty($productos)): ?>
        <tr><td colspan="6" style="text-align:center;color:var(--muted);">Sin productos</td></tr>
      <?php else: foreach ($productos as $p): ?>
        <tr>
          <td><strong><?= h($p['codigo']) ?></strong></td>
          <td>
            <div><?= h($p['nombre']) ?></div>
            <small style="color:var(--muted);"><?= h($p['marca']) ?> <?= h($p['modelo']) ?></small>
          </td>
          <td><?= h($p['categoria']) ?></td>
          <td><?= money($p['precio_venta']) ?></td>
          <td>
            <?php if ($p['stock'] <= $p['stock_minimo']): ?>
              <span style="color:var(--danger);font-weight:700;"><?= $p['stock'] ?></span>
            <?php else: ?>
              <?= $p['stock'] ?>
            <?php endif; ?>
          </td>
          <td style="display:flex;gap:6px;">
            <a href="<?= SITE_URL ?>/modules/products/edit.php?id=<?= $p['id'] ?>" class="btn btn-info btn-sm btn-icon" title="Editar"><i class="fa-solid fa-pen"></i></a>
            <form method="post" onsubmit="return confirm('¿Desactivar este producto?')" style="margin:0;">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="deactivate">
              <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
              <button class="btn btn-danger btn-sm btn-icon" type="submit" title="Desactivar"><i class="fa-solid fa-trash"></i></button>
            </form>
          </td>
        </tr>
      <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
