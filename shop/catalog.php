<?php
require_once __DIR__ . '/../includes/repository.php';
$pageTitle = 'Catálogo';
$activeNav = 'catalogo';

$filters = [
    'q' => trim((string)($_GET['q'] ?? '')),
    'cat' => (int)($_GET['cat'] ?? 0),
    'marca' => (string)($_GET['marca'] ?? ''),
    'min' => ($_GET['min'] ?? '') !== '' ? (float)$_GET['min'] : '',
    'max' => ($_GET['max'] ?? '') !== '' ? (float)$_GET['max'] : '',
    'disponibilidad' => (string)($_GET['disponibilidad'] ?? ''),
    'caracteristica' => (string)($_GET['caracteristica'] ?? ''),
    'destacado' => !empty($_GET['destacado']),
    'nuevo' => !empty($_GET['nuevo']),
    'oferta' => !empty($_GET['oferta']),
    'orden' => (string)($_GET['orden'] ?? 'relevancia'),
    'page' => max(1, (int)($_GET['page'] ?? 1)),
    'per_page' => 12,
];
$result = catalog_products($filters);
$rows = $result['rows'];
$info = $result['page'];
$categories = categories_list();
$brands = brands_list();
$baseParams = array_diff_key($_GET, ['page' => 1]);

require_once __DIR__ . '/../includes/store_header.php';
?>
<div class="section-head" style="margin-top:6px;">
  <div>
    <span class="eyebrow">Tienda</span>
    <h1 style="font-size:2rem;">Catálogo de productos</h1>
    <p>Filtra por categoría, marca, precio o disponibilidad. Todos los datos provienen del inventario real.</p>
  </div>
</div>

<div class="catalog-layout">
  <aside class="filter-panel store-form">
    <h3><i class="fa-solid fa-sliders"></i> Filtros</h3>
    <form method="get" action="<?= BASE_URL ?>/shop/catalog.php">
      <div class="filter-group">
        <label for="fcat">Categoría</label>
        <select class="form-control" id="fcat" name="cat">
          <option value="0">Todas las categorías</option>
          <?php foreach ($categories as $cat): ?>
          <option value="<?= (int)$cat['id'] ?>" <?= $filters['cat'] === (int)$cat['id'] ? 'selected' : '' ?>><?= h($cat['nombre']) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="filter-group">
        <label for="fbrand">Marca</label>
        <select class="form-control" id="fbrand" name="marca">
          <option value="">Todas las marcas</option>
          <?php foreach ($brands as $brand): ?>
          <option value="<?= h($brand) ?>" <?= $filters['marca'] === $brand ? 'selected' : '' ?>><?= h($brand) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="filter-group">
        <label>Precio (<?= h(config_value('moneda','S/')) ?>)</label>
        <div class="range-row">
          <input class="form-control" type="number" name="min" min="0" step="0.01" placeholder="Mín" value="<?= h($filters['min']) ?>">
          <input class="form-control" type="number" name="max" min="0" step="0.01" placeholder="Máx" value="<?= h($filters['max']) ?>">
        </div>
      </div>
      <div class="filter-group">
        <label for="fstock">Disponibilidad</label>
        <select class="form-control" id="fstock" name="disponibilidad">
          <option value="">Todos</option>
          <option value="disponible" <?= $filters['disponibilidad']==='disponible'?'selected':'' ?>>Con stock</option>
          <option value="agotado" <?= $filters['disponibilidad']==='agotado'?'selected':'' ?>>Agotados</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="ffeat">Característica</label>
        <input class="form-control" id="ffeat" type="text" name="caracteristica" maxlength="80" placeholder="Ej. SSD, 16GB, RTX" value="<?= h($filters['caracteristica']) ?>">
      </div>
      <div class="filter-group">
        <label><input type="checkbox" name="destacado" value="1" <?= $filters['destacado']?'checked':'' ?>> Destacados</label>
        <label style="margin-top:6px;"><input type="checkbox" name="nuevo" value="1" <?= $filters['nuevo']?'checked':'' ?>> Novedades</label>
        <label style="margin-top:6px;"><input type="checkbox" name="oferta" value="1" <?= $filters['oferta']?'checked':'' ?>> En oferta</label>
      </div>
      <input type="hidden" name="q" value="<?= h($filters['q']) ?>">
      <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;"><i class="fa-solid fa-filter"></i> Aplicar filtros</button>
      <a class="btn btn-outline" style="width:100%;justify-content:center;margin-top:8px;" href="<?= BASE_URL ?>/shop/catalog.php">Limpiar</a>
    </form>
  </aside>

  <div>
    <div class="catalog-toolbar">
      <form method="get" action="<?= BASE_URL ?>/shop/catalog.php">
        <?php foreach ($baseParams as $k => $v): if ($k === 'q') continue; ?>
          <?php if (is_array($v)) continue; ?>
          <input type="hidden" name="<?= h($k) ?>" value="<?= h($v) ?>">
        <?php endforeach; ?>
        <input class="form-control" type="search" name="q" maxlength="120" placeholder="Buscar por nombre, código, marca, modelo o característica…" value="<?= h($filters['q']) ?>">
        <button class="btn btn-primary" type="submit"><i class="fa-solid fa-magnifying-glass"></i></button>
      </form>
      <form method="get" action="<?= BASE_URL ?>/shop/catalog.php">
        <?php foreach ($baseParams as $k => $v): if ($k === 'orden' || is_array($v)) continue; ?>
          <input type="hidden" name="<?= h($k) ?>" value="<?= h($v) ?>">
        <?php endforeach; ?>
        <select class="form-control" name="orden" onchange="this.form.submit()" style="min-width:170px;">
          <option value="relevancia" <?= $filters['orden']==='relevancia'?'selected':'' ?>>Relevancia</option>
          <option value="precio_asc" <?= $filters['orden']==='precio_asc'?'selected':'' ?>>Menor precio</option>
          <option value="precio_desc" <?= $filters['orden']==='precio_desc'?'selected':'' ?>>Mayor precio</option>
          <option value="nombre" <?= $filters['orden']==='nombre'?'selected':'' ?>>Nombre A-Z</option>
          <option value="nuevos" <?= $filters['orden']==='nuevos'?'selected':'' ?>>Más recientes</option>
        </select>
      </form>
    </div>

    <?php
    $activeChips = [];
    if ($filters['q'] !== '') $activeChips[] = 'Búsqueda: ' . $filters['q'];
    if ($filters['cat']) { foreach ($categories as $c) if ((int)$c['id']===$filters['cat']) { $activeChips[] = $c['nombre']; break; } }
    if ($filters['marca'] !== '') $activeChips[] = $filters['marca'];
    if ($filters['destacado']) $activeChips[] = 'Destacados';
    if ($filters['oferta']) $activeChips[] = 'Ofertas';
    if ($activeChips): ?>
    <div class="active-filters">
      <?php foreach ($activeChips as $label): ?><span class="chip active"><i class="fa-solid fa-check"></i> <?= h($label) ?></span><?php endforeach; ?>
      <a class="chip" href="<?= BASE_URL ?>/shop/catalog.php"><i class="fa-solid fa-xmark"></i> Quitar filtros</a>
    </div>
    <?php endif; ?>

    <p class="result-count">Mostrando <?= count($rows) ?> de <?= (int)$info['total'] ?> productos · Página <?= (int)$info['page'] ?> de <?= (int)$info['pages'] ?></p>

    <?php if (!$rows): ?>
      <div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>No encontramos productos con esos filtros</h3><p>Pruebe con otros términos o elimine algunos filtros.</p></div>
    <?php else: ?>
      <div class="products-grid">
        <?php foreach ($rows as $p): ?><?= product_card_html($p) ?><?php endforeach; ?>
      </div>
      <?= pagination_links($info, BASE_URL . '/shop/catalog.php', $baseParams) ?>
    <?php endif; ?>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/store_footer.php'; ?>
