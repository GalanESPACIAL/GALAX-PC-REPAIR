<?php
/**
 * GALAX PC REPAIR — Inventario, trazabilidad y compras a proveedores.
 * Todas las escrituras se realizan en transacción y con token CSRF.
 */
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('inventario');

$pageTitle = 'Inventario y Compras';

/* ------------------------------------------------------------------ */
/* Utilidades locales (closures: evitan colisiones con otros módulos)  */
/* ------------------------------------------------------------------ */

$gxDate = static function ($value): string {
    $value = trim((string)$value);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return '';
    }
    [$anio, $mes, $dia] = array_map('intval', explode('-', $value));
    return checkdate($mes, $dia, $anio) ? $value : '';
};

$gxPositiveInt = static function ($value, string $campo): int {
    $value = trim((string)$value);
    if (!preg_match('/^\d+$/', $value) || (int)$value <= 0) {
        throw new InvalidArgumentException($campo . ' debe ser un entero positivo.');
    }
    return (int)$value;
};

$gxSignedInt = static function ($value, string $campo): int {
    $value = trim((string)$value);
    if (!preg_match('/^-?\d+$/', $value) || (int)$value === 0) {
        throw new InvalidArgumentException($campo . ' debe ser un entero (use signo - para reducir).');
    }
    return (int)$value;
};

$gxMoney = static function ($value, string $campo, bool $permitirCero = false): float {
    $value = trim(str_replace(',', '.', (string)$value));
    if ($value === '' || !is_numeric($value)) {
        throw new InvalidArgumentException($campo . ' debe ser un monto válido.');
    }
    $numero = (float)$value;
    if ($numero < 0 || (!$permitirCero && $numero <= 0)) {
        throw new InvalidArgumentException($campo . ' debe ser mayor que ' . ($permitirCero ? 'o igual a ' : '') . 'cero.');
    }
    return round($numero, 2);
};

/**
 * Código único para compras: variante local validada contra compras_proveedor
 * para no acoplar este módulo a la lista de tablas de generateCode().
 */
$gxCompraCode = static function (PDO $db): string {
    for ($i = 0; $i < 10; $i++) {
        $codigo = 'CMP-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        $stmt = $db->prepare('SELECT 1 FROM compras_proveedor WHERE codigo = ? LIMIT 1');
        $stmt->execute([$codigo]);
        if (!$stmt->fetch()) {
            return $codigo;
        }
    }
    throw new RuntimeException('No se pudo generar un código de compra único.');
};

/**
 * Aplica un movimiento atómico: bloquea la fila, valida stock y actualiza
 * productos.stock + inventario_movimientos dentro de la transacción activa.
 */
$registrarMovimiento = static function (
    int $productoId,
    string $tipo,
    int $cantidad,
    string $motivo,
    string $documento,
    ?float $costoUnitario,
    ?float $precioCompraFinal = null
) use ($gxPositiveInt): int {
    $tipos = ['entrada', 'salida', 'ajuste'];
    if (!in_array($tipo, $tipos, true)) {
        throw new InvalidArgumentException('Tipo de movimiento no permitido.');
    }
    if ($motivo === '') {
        throw new InvalidArgumentException('El motivo del movimiento es obligatorio.');
    }
    $db = db();
    if (!$db->inTransaction()) {
        throw new RuntimeException('El movimiento debe ejecutarse dentro de una transacción.');
    }

    $stmt = $db->prepare('SELECT stock FROM productos WHERE id = ? FOR UPDATE');
    $stmt->execute([$productoId]);
    $fila = $stmt->fetch();
    if (!$fila) {
        throw new InvalidArgumentException('El producto seleccionado no existe.');
    }
    $anterior = (int)$fila['stock'];

    if ($tipo === 'entrada') {
        $cantidad = $gxPositiveInt($cantidad, 'Cantidad');
        $nuevo = $anterior + $cantidad;
    } elseif ($tipo === 'salida') {
        $cantidad = $gxPositiveInt($cantidad, 'Cantidad');
        $nuevo = $anterior - $cantidad;
    } else {
        // Ajuste con delta firmado: +3 incrementa, -2 decrementa.
        $nuevo = $anterior + $cantidad;
    }

    if ($nuevo < 0) {
        throw new InvalidArgumentException(
            'Stock insuficiente. Disponible: ' . $anterior . '; se solicitó una salida de ' . abs($cantidad) . '.'
        );
    }

    if ($precioCompraFinal !== null) {
        $upd = $db->prepare('UPDATE productos SET stock = ?, precio_compra = ? WHERE id = ?');
        $upd->execute([$nuevo, round($precioCompraFinal, 2), $productoId]);
    } else {
        $upd = $db->prepare('UPDATE productos SET stock = ? WHERE id = ?');
        $upd->execute([$nuevo, $productoId]);
    }

    $ins = $db->prepare(
        'INSERT INTO inventario_movimientos
            (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, documento,
             costo_unitario, usuario_id, creado_en)
         VALUES (?,?,?,?,?,?,?,?,?,NOW())'
    );
    $ins->execute([
        $productoId,
        $tipo,
        $cantidad,
        $anterior,
        $nuevo,
        mb_substr($motivo, 0, 255),
        $documento === '' ? null : mb_substr($documento, 0, 80),
        $costoUnitario,
        $_SESSION['user_id'] ?? null,
    ]);

    return $nuevo;
};

/* ------------------------------------------------------------------ */
/* Procesamiento de POST — CSRF obligatorio en TODOS los POST           */
/* ------------------------------------------------------------------ */

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    require_csrf();
    $db = db();
    $accion = (string)($_POST['action'] ?? '');

    try {
        if ($accion === 'movimiento') {
            $productoId = $gxPositiveInt($_POST['producto_id'] ?? 0, 'Producto');
            $tipo = (string)($_POST['tipo'] ?? '');
            if (!in_array($tipo, ['entrada', 'salida', 'ajuste'], true)) {
                throw new InvalidArgumentException('Tipo de movimiento no válido.');
            }
            $cantidad = $tipo === 'ajuste'
                ? $gxSignedInt($_POST['cantidad'] ?? 0, 'Cantidad')
                : $gxPositiveInt($_POST['cantidad'] ?? 0, 'Cantidad');
            $motivo = trim((string)($_POST['motivo'] ?? ''));
            $documento = trim((string)($_POST['documento'] ?? ''));
            $costoRaw = trim((string)($_POST['costo_unitario'] ?? ''));
            $costo = $costoRaw === '' ? null : $gxMoney($costoRaw, 'Costo unitario', true);

            $db->beginTransaction();
            $stockFinal = $registrarMovimiento(
                $productoId, $tipo, $cantidad, $motivo, $documento, $costo
            );
            $db->commit();

            audit_log(
                'inventario_movimiento',
                'productos',
                $productoId,
                strtoupper($tipo) . ' | cantidad=' . $cantidad . ' | stock_final=' . $stockFinal . ' | ' . $motivo
            );
            flash('success', 'Movimiento registrado. Stock actual: ' . $stockFinal . ' unidades.');
        } elseif ($accion === 'proveedor') {
            $nombre = trim((string)($_POST['nombre'] ?? ''));
            $ruc = trim((string)($_POST['ruc'] ?? ''));
            $contacto = trim((string)($_POST['contacto'] ?? ''));
            $telefono = trim((string)($_POST['telefono'] ?? ''));
            $email = trim((string)($_POST['email'] ?? ''));
            $direccion = trim((string)($_POST['direccion'] ?? ''));

            if ($nombre === '') {
                throw new InvalidArgumentException('El nombre del proveedor es obligatorio.');
            }
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new InvalidArgumentException('El correo del proveedor no es válido.');
            }
            $stmt = $db->prepare(
                'INSERT INTO proveedores (ruc, nombre, contacto, telefono, email, direccion, activo, creado_en)
                 VALUES (?,?,?,?,?,?,1,NOW())'
            );
            $stmt->execute([
                $ruc === '' ? null : mb_substr($ruc, 0, 20),
                mb_substr($nombre, 0, 180),
                $contacto === '' ? null : mb_substr($contacto, 0, 120),
                $telefono === '' ? null : mb_substr($telefono, 0, 40),
                $email === '' ? null : mb_substr($email, 0, 150),
                $direccion === '' ? null : mb_substr($direccion, 0, 255),
            ]);
            $proveedorId = (int)$db->lastInsertId();
            audit_log('proveedor_creado', 'proveedores', $proveedorId, $nombre);
            flash('success', 'Proveedor registrado correctamente.');
        } elseif ($accion === 'compra') {
            $proveedorId = $gxPositiveInt($_POST['proveedor_id'] ?? 0, 'Proveedor');
            $productoId = $gxPositiveInt($_POST['producto_id'] ?? 0, 'Producto');
            $cantidad = $gxPositiveInt($_POST['cantidad'] ?? 0, 'Cantidad');
            $costoUnitario = $gxMoney($_POST['costo_unitario'] ?? 0, 'Costo unitario');
            $fecha = $gxDate($_POST['fecha'] ?? date('Y-m-d'));
            if ($fecha === '') {
                throw new InvalidArgumentException('La fecha de la compra no es válida.');
            }

            $db->beginTransaction();
            $stmt = $db->prepare('SELECT nombre FROM proveedores WHERE id = ? AND activo = 1 LIMIT 1');
            $stmt->execute([$proveedorId]);
            $proveedor = $stmt->fetch();
            if (!$proveedor) {
                throw new InvalidArgumentException('El proveedor seleccionado no existe o está inactivo.');
            }

            $stmt = $db->prepare('SELECT stock, precio_compra FROM productos WHERE id = ? FOR UPDATE');
            $stmt->execute([$productoId]);
            $producto = $stmt->fetch();
            if (!$producto) {
                throw new InvalidArgumentException('El producto seleccionado no existe.');
            }

            $stockActual = (int)$producto['stock'];
            $costoAnterior = (float)$producto['precio_compra'];
            $promedioPonderado = ($stockActual * $costoAnterior + $cantidad * $costoUnitario)
                / ($stockActual + $cantidad);
            $total = round($cantidad * $costoUnitario, 2);
            $codigo = $gxCompraCode($db);

            $ins = $db->prepare(
                'INSERT INTO compras_proveedor
                    (codigo, proveedor_id, producto_id, cantidad, costo_unitario, total, fecha, usuario_id, creado_en)
                 VALUES (?,?,?,?,?,?,?,?,NOW())'
            );
            $ins->execute([
                $codigo, $proveedorId, $productoId, $cantidad, $costoUnitario, $total,
                $fecha, $_SESSION['user_id'] ?? null,
            ]);
            $compraId = (int)$db->lastInsertId();

            $registrarMovimiento(
                $productoId,
                'entrada',
                $cantidad,
                'Compra a proveedor ' . $proveedor['nombre'],
                $codigo,
                $costoUnitario,
                round($promedioPonderado, 2)
            );
            $db->commit();

            audit_log(
                'compra_proveedor_creada',
                'compras_proveedor',
                $compraId,
                $codigo . ' | proveedor=' . $proveedor['nombre'] . ' | total=' . $total
            );
            flash('success', 'Compra ' . $codigo . ' registrada; stock y costo promedio actualizados.');
        } else {
            throw new InvalidArgumentException('Acción desconocida.');
        }
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[GALAX][INVENTARIO] ' . $e->getMessage());
        $mensaje = $e instanceof InvalidArgumentException
            ? 'No se pudo completar la operación: ' . $e->getMessage()
            : 'No se pudo completar la operación. Consulte el registro del sistema.';
        flash('error', $mensaje);
    }

    redirect(BASE_URL . '/modules/inventory/index.php');
}

/* ------------------------------------------------------------------ */
/* Filtros y consultas de solo lectura                                  */
/* ------------------------------------------------------------------ */

$tiposMovimiento = ['entrada', 'salida', 'ajuste', 'venta', 'cancelacion', 'reparacion'];
$filtros = [
    'producto_id' => (int)($_GET['producto_id'] ?? 0),
    'tipo'        => (string)($_GET['tipo'] ?? ''),
    'desde'       => $gxDate($_GET['desde'] ?? ''),
    'hasta'       => $gxDate($_GET['hasta'] ?? ''),
];
if (!in_array($filtros['tipo'], $tiposMovimiento, true)) {
    $filtros['tipo'] = '';
}

$where = [];
$params = [];
if ($filtros['producto_id'] > 0) {
    $where[] = 'm.producto_id = ?';
    $params[] = $filtros['producto_id'];
}
if ($filtros['tipo'] !== '') {
    $where[] = 'm.tipo = ?';
    $params[] = $filtros['tipo'];
}
if ($filtros['desde'] !== '') {
    $where[] = 'DATE(m.creado_en) >= ?';
    $params[] = $filtros['desde'];
}
if ($filtros['hasta'] !== '') {
    $where[] = 'DATE(m.creado_en) <= ?';
    $params[] = $filtros['hasta'];
}
$sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = db()->prepare('SELECT COUNT(*) FROM inventario_movimientos m ' . $sqlWhere);
foreach ($params as $i => $valor) {
    $stmt->bindValue($i + 1, $valor, is_int($valor) ? PDO::PARAM_INT : PDO::PARAM_STR);
}
$stmt->execute();
$totalMovimientos = (int)$stmt->fetchColumn();
$pagina = paginate($totalMovimientos, 15, (int)($_GET['page'] ?? 1));

$stmt = db()->prepare(
    'SELECT m.*, p.nombre AS producto, p.codigo AS producto_codigo, u.nombre AS usuario_nombre
       FROM inventario_movimientos m
       JOIN productos p ON p.id = m.producto_id
       LEFT JOIN usuarios u ON u.id = m.usuario_id
       ' . $sqlWhere . '
      ORDER BY m.creado_en DESC, m.id DESC
      LIMIT ?, ?'
);
foreach ($params as $i => $valor) {
    $stmt->bindValue($i + 1, $valor, is_int($valor) ? PDO::PARAM_INT : PDO::PARAM_STR);
}
$stmt->bindValue(count($params) + 1, $pagina['offset'], PDO::PARAM_INT);
$stmt->bindValue(count($params) + 2, $pagina['perPage'], PDO::PARAM_INT);
$stmt->execute();
$movimientos = $stmt->fetchAll();

$productos = db()->query(
    "SELECT id, codigo, nombre, stock, stock_minimo, precio_compra, precio_venta,
            COALESCE(precio_oferta, precio_venta) AS precio_efectivo, estado
       FROM productos
      ORDER BY CASE WHEN estado = 'activo' THEN 0 ELSE 1 END, nombre"
)->fetchAll();
$proveedores = db()->query('SELECT * FROM proveedores ORDER BY activo DESC, nombre')->fetchAll();
$compras = db()->query(
    'SELECT c.*, pr.nombre AS proveedor, p.codigo AS producto_codigo, p.nombre AS producto,
            p.precio_venta, p.precio_compra AS costo_actual
       FROM compras_proveedor c
       JOIN proveedores pr ON pr.id = c.proveedor_id
       JOIN productos p ON p.id = c.producto_id
      ORDER BY c.fecha DESC, c.id DESC
      LIMIT 12'
)->fetchAll();

$agotados = (int)db()->query("SELECT COUNT(*) FROM productos WHERE estado='activo' AND stock <= 0")->fetchColumn();
$bajos = (int)db()->query("SELECT COUNT(*) FROM productos WHERE estado='activo' AND stock > 0 AND stock <= stock_minimo")->fetchColumn();
$alertas = db()->query(
    "SELECT id, codigo, nombre, stock, stock_minimo
       FROM productos
      WHERE estado='activo' AND stock <= stock_minimo
      ORDER BY stock ASC, nombre ASC
      LIMIT 10"
)->fetchAll();

$badgesMovimiento = [
    'entrada' => 'success', 'salida' => 'danger', 'ajuste' => 'warning',
    'venta' => 'info', 'cancelacion' => 'secondary', 'reparacion' => 'primary',
];

require_once __DIR__ . '/../../includes/header.php';
// theme.css se carga después del panel heredado (no se modifica header.php).
echo '<link rel="stylesheet" href="' . h(BASE_URL . '/assets/css/theme.css') . '">';
?>
<div class="stats-grid">
  <div class="stat-card"><div class="label">Productos activos</div><div class="value"><?= count(array_filter($productos, fn($p) => $p['estado'] === 'activo')) ?></div><i class="fa-solid fa-boxes-stacked"></i></div>
  <div class="stat-card"><div class="label">Stock bajo mínimo</div><div class="value"><?= $bajos ?></div><i class="fa-solid fa-triangle-exclamation"></i></div>
  <div class="stat-card"><div class="label">Agotados</div><div class="value"><?= $agotados ?></div><i class="fa-solid fa-circle-xmark"></i></div>
  <div class="stat-card"><div class="label">Movimientos</div><div class="value"><?= $totalMovimientos ?></div><i class="fa-solid fa-arrow-right-arrow-left"></i></div>
</div>

<?php if ($alertas): ?>
<div class="card" style="margin-bottom:18px;border-left:3px solid var(--warning);">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-triangle-exclamation"></i> Alertas de stock</div>
    <span class="chip"><?= $agotados ?> agotados · <?= $bajos ?> por debajo del mínimo</span>
  </div>
  <div class="grid grid-auto">
    <?php foreach ($alertas as $a): ?>
      <div class="feature" style="padding:13px;">
        <strong><?= h($a['nombre']) ?></strong>
        <div class="product-code"><?= h($a['codigo']) ?></div>
        <div class="summary-row"><span>Stock actual</span><strong class="<?= (int)$a['stock'] <= 0 ? 'stock-out' : 'stock-low' ?>"><?= (int)$a['stock'] ?></strong></div>
        <div class="summary-row"><span>Mínimo</span><span><?= (int)$a['stock_minimo'] ?></span></div>
      </div>
    <?php endforeach; ?>
  </div>
</div>
<?php endif; ?>

<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-bottom:18px;">
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-arrows-rotate"></i> Movimiento de stock</div></div>
    <form method="POST" class="store-form">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="movimiento">
      <div class="form-group">
        <label class="form-label">Producto</label>
        <select name="producto_id" class="form-control" required>
          <option value="">Seleccione…</option>
          <?php foreach ($productos as $p): ?>
            <option value="<?= (int)$p['id'] ?>" data-stock="<?= (int)$p['stock'] ?>"><?= h($p['codigo'] . ' · ' . $p['nombre']) ?> (stock: <?= (int)$p['stock'] ?>)</option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="grid grid-2">
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select name="tipo" class="form-control" required>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste (±)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Cantidad</label>
          <input type="number" name="cantidad" class="form-control" step="1" required placeholder="Ej. 10 o -3">
          <small style="color:var(--muted);">En ajustes, use signo negativo para reducir.</small>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Motivo</label>
        <input type="text" name="motivo" class="form-control" maxlength="255" required placeholder="Ej. Reposición, merma, corrección de conteo">
      </div>
      <div class="grid grid-2">
        <div class="form-group">
          <label class="form-label">Documento (opcional)</label>
          <input type="text" name="documento" class="form-control" maxlength="80" placeholder="Factura, guía, orden…">
        </div>
        <div class="form-group">
          <label class="form-label">Costo unitario (opcional)</label>
          <input type="number" name="costo_unitario" class="form-control" step="0.01" min="0" placeholder="0.00">
        </div>
      </div>
      <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-floppy-disk"></i> Registrar movimiento</button>
    </form>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-truck"></i> Registrar compra</div></div>
    <form method="POST" class="store-form">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="compra">
      <div class="form-group">
        <label class="form-label">Proveedor</label>
        <select name="proveedor_id" class="form-control" required>
          <option value="">Seleccione…</option>
          <?php foreach ($proveedores as $prov): ?>
            <option value="<?= (int)$prov['id'] ?>" <?= (int)$prov['activo'] === 1 ? '' : 'disabled' ?>><?= h($prov['nombre']) ?><?= (int)$prov['activo'] === 1 ? '' : ' (inactivo)' ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Producto</label>
        <select name="producto_id" class="form-control" required>
          <option value="">Seleccione…</option>
          <?php foreach ($productos as $p): ?>
            <option value="<?= (int)$p['id'] ?>"><?= h($p['codigo'] . ' · ' . $p['nombre']) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="grid grid-3">
        <div class="form-group">
          <label class="form-label">Cantidad</label>
          <input type="number" name="cantidad" class="form-control" min="1" step="1" required>
        </div>
        <div class="form-group">
          <label class="form-label">Costo unitario</label>
          <input type="number" name="costo_unitario" class="form-control" min="0.01" step="0.01" required>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha</label>
          <input type="date" name="fecha" class="form-control" value="<?= date('Y-m-d') ?>" required>
        </div>
      </div>
      <p style="color:var(--muted);font-size:.8rem;">El stock aumenta, se inserta un movimiento «entrada» y el precio de compra se recalcula como promedio ponderado.</p>
      <button class="btn btn-success btn-block" type="submit"><i class="fa-solid fa-cart-plus"></i> Registrar compra</button>
    </form>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-address-card"></i> Nuevo proveedor</div></div>
    <form method="POST" class="store-form">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="proveedor">
      <div class="grid grid-2">
        <div class="form-group">
          <label class="form-label">Nombre / Razón social</label>
          <input type="text" name="nombre" class="form-control" maxlength="180" required>
        </div>
        <div class="form-group">
          <label class="form-label">RUC</label>
          <input type="text" name="ruc" class="form-control" maxlength="20">
        </div>
      </div>
      <div class="grid grid-2">
        <div class="form-group">
          <label class="form-label">Contacto</label>
          <input type="text" name="contacto" class="form-control" maxlength="120">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="text" name="telefono" class="form-control" maxlength="40">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Correo</label>
        <input type="email" name="email" class="form-control" maxlength="150">
      </div>
      <div class="form-group">
        <label class="form-label">Dirección</label>
        <input type="text" name="direccion" class="form-control" maxlength="255">
      </div>
      <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-plus"></i> Guardar proveedor</button>
    </form>
  </div>
</div>

<div class="card">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> Historial de movimientos</div>
    <span class="chip"><?= $totalMovimientos ?> registros</span>
  </div>
  <form method="GET" class="grid grid-4" style="margin-bottom:14px;">
    <div class="form-group">
      <label class="form-label">Producto</label>
      <select name="producto_id" class="form-control">
        <option value="0">Todos</option>
        <?php foreach ($productos as $p): ?>
          <option value="<?= (int)$p['id'] ?>" <?= $filtros['producto_id'] === (int)$p['id'] ? 'selected' : '' ?>><?= h($p['nombre']) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <select name="tipo" class="form-control">
        <option value="">Todos</option>
        <?php foreach ($tiposMovimiento as $tipo): ?>
          <option value="<?= $tipo ?>" <?= $filtros['tipo'] === $tipo ? 'selected' : '' ?>><?= ucfirst($tipo) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Desde</label>
      <input type="date" name="desde" class="form-control" value="<?= h($filtros['desde']) ?>">
    </div>
    <div class="form-group">
      <label class="form-label">Hasta</label>
      <input type="date" name="hasta" class="form-control" value="<?= h($filtros['hasta']) ?>">
    </div>
    <div style="grid-column:1/-1;">
      <button class="btn btn-ghost btn-sm" type="submit"><i class="fa-solid fa-filter"></i> Filtrar</button>
      <a class="btn btn-ghost btn-sm" href="<?= h(BASE_URL . '/modules/inventory/index.php') ?>"><i class="fa-solid fa-rotate"></i> Limpiar</a>
    </div>
  </form>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Stock anterior</th><th>Stock nuevo</th><th>Costo unit.</th><th>Documento</th><th>Motivo</th><th>Usuario</th></tr></thead>
      <tbody>
      <?php if (!$movimientos): ?>
        <tr><td colspan="10" style="text-align:center;color:var(--muted);">No hay movimientos con estos filtros.</td></tr>
      <?php else: foreach ($movimientos as $m): ?>
        <tr>
          <td><?= fecha($m['creado_en']) ?></td>
          <td><strong><?= h($m['producto_codigo']) ?></strong><br><small style="color:var(--muted);"><?= h($m['producto']) ?></small></td>
          <td><span class="badge badge-<?= $badgesMovimiento[$m['tipo']] ?? 'secondary' ?>"><?= ucfirst(h($m['tipo'])) ?></span></td>
          <td><?= (int)$m['cantidad'] > 0 ? '+' : '' ?><?= (int)$m['cantidad'] ?></td>
          <td><?= (int)$m['stock_anterior'] ?></td>
          <td><strong><?= (int)$m['stock_nuevo'] ?></strong></td>
          <td><?= $m['costo_unitario'] !== null ? money($m['costo_unitario']) : '-' ?></td>
          <td><?= h($m['documento'] ?: '-') ?></td>
          <td><?= h($m['motivo'] ?: '-') ?></td>
          <td><?= h($m['usuario_nombre'] ?: 'Sistema') ?></td>
        </tr>
      <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>
  <?= pagination_links($pagina, BASE_URL . '/modules/inventory/index.php', $filtros) ?>
</div>

<div class="grid grid-2" style="margin-top:18px;">
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-file-invoice-dollar"></i> Últimas compras</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Código</th><th>Proveedor</th><th>Producto</th><th>Cant.</th><th>Costo</th><th>Total</th><th>Margen</th><th>Fecha</th></tr></thead>
        <tbody>
        <?php if (!$compras): ?>
          <tr><td colspan="8" style="text-align:center;color:var(--muted);">Sin compras registradas.</td></tr>
        <?php else: foreach ($compras as $c): ?>
          <?php
            $margen = (float)$c['precio_venta'] - (float)$c['costo_unitario'];
            $margenPct = (float)$c['precio_venta'] > 0 ? ($margen / (float)$c['precio_venta']) * 100 : 0;
          ?>
          <tr>
            <td><strong><?= h($c['codigo']) ?></strong></td>
            <td><?= h($c['proveedor']) ?></td>
            <td><?= h($c['producto']) ?></td>
            <td><?= (int)$c['cantidad'] ?></td>
            <td><?= money($c['costo_unitario']) ?></td>
            <td><?= money($c['total']) ?></td>
            <td><?= money($margen) ?> <small style="color:var(--muted);">(<?= number_format($margenPct, 1) ?>%)</small></td>
            <td><?= fecha_corta($c['fecha']) ?></td>
          </tr>
        <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-users-gear"></i> Proveedores</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>RUC</th><th>Contacto</th><th>Teléfono</th><th>Correo</th><th>Estado</th></tr></thead>
        <tbody>
        <?php if (!$proveedores): ?>
          <tr><td colspan="6" style="text-align:center;color:var(--muted);">Registre el primer proveedor.</td></tr>
        <?php else: foreach ($proveedores as $prov): ?>
          <tr>
            <td><strong><?= h($prov['nombre']) ?></strong></td>
            <td><?= h($prov['ruc'] ?: '-') ?></td>
            <td><?= h($prov['contacto'] ?: '-') ?></td>
            <td><?= h($prov['telefono'] ?: '-') ?></td>
            <td><?= h($prov['email'] ?: '-') ?></td>
            <td><span class="badge badge-<?= (int)$prov['activo'] === 1 ? 'success' : 'secondary' ?>"><?= (int)$prov['activo'] === 1 ? 'Activo' : 'Inactivo' ?></span></td>
          </tr>
        <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
