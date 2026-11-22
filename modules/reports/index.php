<?php
/**
 * GALAX PC REPAIR — Reportes administrativos con datos reales de MySQL.
 * Gráficos SVG generados en PHP y exportación CSV con escape de fórmulas.
 */
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('reportes');

$pageTitle = 'Reportes';

/* ------------------------------------------------------------------ */
/* Parámetros y utilidades                                             */
/* ------------------------------------------------------------------ */

$gxDate = static function ($value): string {
    $value = trim((string)$value);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return '';
    }
    [$anio, $mes, $dia] = array_map('intval', explode('-', $value));
    return checkdate($mes, $dia, $anio) ? $value : '';
};

$hoy = date('Y-m-d');
$desde = $gxDate($_GET['desde'] ?? date('Y-m-d', strtotime('-30 days')));
$hasta = $gxDate($_GET['hasta'] ?? $hoy);
if ($desde === '') {
    $desde = date('Y-m-d', strtotime('-30 days'));
}
if ($hasta === '') {
    $hasta = $hoy;
}
if ($desde > $hasta) {
    [$desde, $hasta] = [$hasta, $desde];
}

$reportesValidos = ['ventas', 'pedidos', 'productos', 'margenes', 'stock', 'ingresos'];
$report = (string)($_GET['report'] ?? 'ventas');
if (!in_array($report, $reportesValidos, true)) {
    $report = 'ventas';
}

$runRow = static function (string $sql, array $params = []): array {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $fila = $stmt->fetch();
    return $fila === false ? [] : $fila;
};
$runAll = static function (string $sql, array $params = []): array {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
};
$num = static fn($valor): string => number_format((float)$valor, 2, '.', '');

/** Escapa fórmulas CSV: cualquier valor que empiece por = + - @ (o tab/CR). */
$gxCsvSafe = static function ($valor) use ($num): string {
    $texto = (string)($valor ?? '');
    return preg_match('/^[=+\-@\t\r]/', $texto) ? "'" . $texto : $texto;
};

$gxExport = static function (string $nombre, array $headers, array $rows) use ($gxCsvSafe): void {
    if (headers_sent()) {
        return;
    }
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $nombre . '"');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    $salida = fopen('php://output', 'w');
    fwrite($salida, "\xEF\xBB\xBF"); // BOM UTF-8 para Excel.
    fputcsv($salida, array_map($gxCsvSafe, $headers), ',', '"', '\\');
    foreach ($rows as $fila) {
        fputcsv($salida, array_map($gxCsvSafe, $fila), ',', '"', '\\');
    }
    fclose($salida);
    exit;
};

/* ------------------------------------------------------------------ */
/* Agregaciones                                                        */
/* ------------------------------------------------------------------ */

$diasRango = (int)round((strtotime($hasta . ' 00:00:00') - strtotime($desde . ' 00:00:00')) / 86400);
$porMes = $diasRango > 45;
$bucketVenta = $porMes ? "TO_CHAR(v.created_at,'YYYY-MM')" : "DATE(v.created_at)";
$bucketPedido = $porMes ? "TO_CHAR(pe.creado_en,'YYYY-MM')" : "DATE(pe.creado_en)";

$gxBuckets = static function (string $desde, string $hasta, bool $porMes): array {
    $buckets = [];
    if ($porMes) {
        $actual = (new DateTimeImmutable($desde . ' 00:00:00'))->modify('first day of this month');
        $fin = (new DateTimeImmutable($hasta . ' 00:00:00'))->modify('first day of next month');
        while ($actual < $fin) {
            $buckets[] = $actual->format('Y-m');
            $actual = $actual->modify('+1 month');
        }
        return $buckets;
    }
    $actual = new DateTimeImmutable($desde . ' 00:00:00');
    $fin = new DateTimeImmutable($hasta . ' 00:00:00');
    while ($actual <= $fin) {
        $buckets[] = $actual->format('Y-m-d');
        $actual = $actual->modify('+1 day');
    }
    return $buckets;
};
$buckets = $gxBuckets($desde, $hasta, $porMes);

$ventasKpi = $runRow(
    "SELECT COUNT(*) AS num,
            COALESCE(SUM(total),0) AS total,
            COALESCE(SUM(CASE WHEN estado IN ('pagado','entregado') THEN total ELSE 0 END),0) AS cobrado
       FROM ventas
      WHERE DATE(created_at) BETWEEN ? AND ?",
    [$desde, $hasta]
);
$pedidosKpi = $runRow(
    "SELECT COUNT(*) AS num,
            COALESCE(SUM(total),0) AS total,
            COALESCE(SUM(CASE WHEN estado = 'completado' THEN total ELSE 0 END),0) AS cobrado
       FROM pedidos
      WHERE DATE(creado_en) BETWEEN ? AND ?",
    [$desde, $hasta]
);
$margenKpi = $runRow(
    "SELECT COALESCE(SUM(margen),0) AS margen FROM (
        SELECT (dv.precio_unitario - p.precio_compra) * dv.cantidad AS margen
          FROM detalle_ventas dv
          JOIN ventas v ON v.id = dv.venta_id
          JOIN productos p ON p.id = dv.producto_id
         WHERE DATE(v.created_at) BETWEEN ? AND ? AND v.estado <> 'cancelado'
        UNION ALL
        SELECT (pd.precio_unitario - COALESCE(p.precio_compra,0)) * pd.cantidad
          FROM pedido_detalles pd
          JOIN pedidos pe ON pe.id = pd.pedido_id
          JOIN productos p ON p.id = pd.producto_id
         WHERE DATE(pe.creado_en) BETWEEN ? AND ? AND pe.estado <> 'cancelado'
     ) x",
    [$desde, $hasta, $desde, $hasta]
);
$stockKpi = $runRow(
    "SELECT COALESCE(SUM(stock),0) AS unidades,
            COALESCE(SUM(stock * precio_compra),0) AS valor_costo,
            COALESCE(SUM(stock * COALESCE(precio_oferta, precio_venta)),0) AS valor_venta
       FROM productos
      WHERE estado='activo'"
);
$ingresosTotales = (float)$ventasKpi['cobrado'] + (float)$pedidosKpi['cobrado'];

$ventasSerie = $runAll(
    "SELECT $bucketVenta AS bucket, COUNT(*) AS num, COALESCE(SUM(total),0) AS total
       FROM ventas v
      WHERE DATE(v.created_at) BETWEEN ? AND ?
      GROUP BY bucket
      ORDER BY bucket",
    [$desde, $hasta]
);
$pedidosSerie = $runAll(
    "SELECT $bucketPedido AS bucket, COUNT(*) AS num, COALESCE(SUM(total),0) AS total
       FROM pedidos pe
      WHERE DATE(pe.creado_en) BETWEEN ? AND ?
      GROUP BY bucket
      ORDER BY bucket",
    [$desde, $hasta]
);

$serieAVentas = [];
foreach ($ventasSerie as $fila) {
    $serieAVentas[$fila['bucket']] = ['num' => (int)$fila['num'], 'total' => (float)$fila['total']];
}
$serieAPedidos = [];
foreach ($pedidosSerie as $fila) {
    $serieAPedidos[$fila['bucket']] = ['num' => (int)$fila['num'], 'total' => (float)$fila['total']];
}
$ventasGrafico = [];
$pedidosGrafico = [];
foreach ($buckets as $bucket) {
    $ventasGrafico[$bucket] = $serieAVentas[$bucket] ?? ['num' => 0, 'total' => 0.0];
    $pedidosGrafico[$bucket] = $serieAPedidos[$bucket] ?? ['num' => 0, 'total' => 0.0];
}

$estadosPedido = $runAll(
    "SELECT estado, COUNT(*) AS num, COALESCE(SUM(total),0) AS total
       FROM pedidos
      WHERE DATE(creado_en) BETWEEN ? AND ?
      GROUP BY estado
      ORDER BY num DESC",
    [$desde, $hasta]
);

$topProductos = $runAll(
    "SELECT codigo, nombre, SUM(unidades) AS unidades, SUM(ingresos) AS ingresos
       FROM (
          SELECT p.codigo, p.nombre, dv.cantidad AS unidades, dv.subtotal AS ingresos
            FROM detalle_ventas dv
            JOIN ventas v ON v.id = dv.venta_id
            JOIN productos p ON p.id = dv.producto_id
           WHERE DATE(v.created_at) BETWEEN ? AND ? AND v.estado <> 'cancelado'
          UNION ALL
          SELECT p.codigo, p.nombre, pd.cantidad, pd.subtotal
            FROM pedido_detalles pd
            JOIN pedidos pe ON pe.id = pd.pedido_id
            JOIN productos p ON p.id = pd.producto_id
           WHERE DATE(pe.creado_en) BETWEEN ? AND ? AND pe.estado <> 'cancelado'
       ) x
      GROUP BY codigo, nombre
      ORDER BY unidades DESC, ingresos DESC
      LIMIT 10",
    [$desde, $hasta, $desde, $hasta]
);

$margenes = $runAll(
    "SELECT codigo, nombre, precio_compra, precio_venta,
            COALESCE(precio_oferta, precio_venta) AS precio_efectivo,
            ROUND(COALESCE(precio_oferta, precio_venta) - precio_compra, 2) AS margen_unitario,
            ROUND(100 * (COALESCE(precio_oferta, precio_venta) - precio_compra)
                  / NULLIF(COALESCE(precio_oferta, precio_venta), 0), 2) AS margen_pct,
            stock
       FROM productos
      WHERE estado='activo'
      ORDER BY margen_unitario DESC, nombre"
);

$stockValorizado = $runAll(
    "SELECT codigo, nombre, stock, stock_minimo, precio_compra, precio_venta,
            COALESCE(precio_oferta, precio_venta) AS precio_efectivo,
            ROUND(stock * precio_compra, 2) AS valor_costo,
            ROUND(stock * COALESCE(precio_oferta, precio_venta), 2) AS valor_venta
       FROM productos
      WHERE estado='activo'
      ORDER BY valor_costo DESC, nombre"
);

$ingresosDetalle = $runAll(
    "SELECT 'Venta' AS tipo, v.codigo, CONCAT(c.nombre, ' ', c.apellido) AS cliente,
            v.created_at AS fecha, v.estado, v.total, NULL AS pedido_id
       FROM ventas v JOIN clientes c ON c.id = v.cliente_id
      WHERE DATE(v.created_at) BETWEEN ? AND ?
      UNION ALL
      SELECT 'Pedido', pe.codigo, pe.nombre_cliente, pe.creado_en, pe.estado, pe.total, pe.id
        FROM pedidos pe
       WHERE DATE(pe.creado_en) BETWEEN ? AND ?
      ORDER BY fecha DESC",
    [$desde, $hasta, $desde, $hasta]
);

/* ------------------------------------------------------------------ */
/* SVG: barras con datos reales (sin librerías externas)               */
/* ------------------------------------------------------------------ */

$svgBarras = static function (array $buckets, array $datos, string $color, string $titulo): string {
    $ancho = 760;
    $alto = 250;
    $padIzq = 58;
    $padDer = 18;
    $padArr = 20;
    $padAba = 52;
    $interiorAncho = $ancho - $padIzq - $padDer;
    $interiorAlto = $alto - $padArr - $padAba;
    $n = max(1, count($buckets));
    $maximo = 1.0;
    foreach ($buckets as $bucket) {
        $maximo = max($maximo, (float)($datos[$bucket]['total'] ?? 0));
    }
    $paso = $interiorAncho / $n;
    $anchoBarra = max(2.0, min(36.0, $paso * 0.62));
    $saltoEtiqueta = max(1, (int)ceil($n / 12));

    $svg = '<svg viewBox="0 0 ' . $ancho . ' ' . $alto . '" width="100%" height="250" role="img" aria-label="' . h($titulo) . '" style="overflow:visible;">';
    for ($i = 0; $i <= 4; $i++) {
        $y = $padArr + $interiorAlto * ($i / 4);
        $valor = $maximo * (1 - $i / 4);
        $svg .= '<line x1="' . $padIzq . '" y1="' . $y . '" x2="' . ($ancho - $padDer) . '" y2="' . $y . '" stroke="rgba(148,163,184,.20)" stroke-width="1"/>';
        $svg .= '<text x="' . ($padIzq - 8) . '" y="' . ($y + 4) . '" text-anchor="end" fill="#9aa8c7" font-size="10">' . h(number_format($valor, 0)) . '</text>';
    }
    foreach ($buckets as $i => $bucket) {
        $total = (float)($datos[$bucket]['total'] ?? 0);
        $numero = (int)($datos[$bucket]['num'] ?? 0);
        $altura = $interiorAlto * ($total / $maximo);
        $x = $padIzq + $paso * $i + ($paso - $anchoBarra) / 2;
        $y = $padArr + $interiorAlto - $altura;
        $svg .= '<rect x="' . round($x, 2) . '" y="' . round($y, 2) . '" width="' . round($anchoBarra, 2)
            . '" height="' . round(max(1.0, $altura), 2) . '" rx="3" fill="' . h($color) . '">'
            . '<title>' . h($bucket . ' · ' . $numero . ' registros · ' . money($total)) . '</title></rect>';
        if ($n <= 16 || $i % $saltoEtiqueta === 0) {
            $esMes = (bool)preg_match('/^\d{4}-\d{2}$/', $bucket);
            $etiqueta = $esMes ? substr($bucket, 2) : substr($bucket, 5);
            $svg .= '<text x="' . round($x + $anchoBarra / 2, 2) . '" y="' . ($alto - $padAba + 18)
                . '" text-anchor="end" fill="#9aa8c7" font-size="9" transform="rotate(-40 '
                . round($x + $anchoBarra / 2, 2) . ' ' . ($alto - $padAba + 18) . ')">' . h($etiqueta) . '</text>';
        }
    }
    $svg .= '<line x1="' . $padIzq . '" y1="' . ($padArr + $interiorAlto) . '" x2="' . ($ancho - $padDer)
        . '" y2="' . ($padArr + $interiorAlto) . '" stroke="rgba(148,163,184,.45)" stroke-width="1"/>';
    $svg .= '</svg>';
    return $svg;
};

/* ------------------------------------------------------------------ */
/* Exportación CSV (mismo archivo, ?export=csv&...)                    */
/* ------------------------------------------------------------------ */

$csvHeaders = [];
$csvRows = [];
switch ($report) {
    case 'pedidos':
        $csvHeaders = ['Código', 'Cliente', 'Estado', 'Fecha', 'Total'];
        foreach ($ingresosDetalle as $fila) {
            if ($fila['tipo'] !== 'Pedido') {
                continue;
            }
            $csvRows[] = [$fila['codigo'], $fila['cliente'], $fila['estado'], $fila['fecha'], $num($fila['total'])];
        }
        break;
    case 'productos':
        $csvHeaders = ['Código', 'Producto', 'Unidades vendidas', 'Ingresos'];
        foreach ($topProductos as $fila) {
            $csvRows[] = [$fila['codigo'], $fila['nombre'], (int)$fila['unidades'], $num($fila['ingresos'])];
        }
        break;
    case 'margenes':
        $csvHeaders = ['Código', 'Producto', 'Precio compra', 'Precio venta', 'Precio efectivo', 'Margen unitario', 'Margen %', 'Stock'];
        foreach ($margenes as $fila) {
            $csvRows[] = [
                $fila['codigo'], $fila['nombre'], $num($fila['precio_compra']), $num($fila['precio_venta']),
                $num($fila['precio_efectivo']), $num($fila['margen_unitario']), $num($fila['margen_pct']), (int)$fila['stock'],
            ];
        }
        break;
    case 'stock':
        $csvHeaders = ['Código', 'Producto', 'Stock', 'Stock mínimo', 'Precio compra', 'Precio venta', 'Valor costo', 'Valor venta'];
        foreach ($stockValorizado as $fila) {
            $csvRows[] = [
                $fila['codigo'], $fila['nombre'], (int)$fila['stock'], (int)$fila['stock_minimo'],
                $num($fila['precio_compra']), $num($fila['precio_efectivo']), $num($fila['valor_costo']), $num($fila['valor_venta']),
            ];
        }
        break;
    case 'ingresos':
        $csvHeaders = ['Tipo', 'Código', 'Cliente', 'Fecha', 'Estado', 'Total'];
        foreach ($ingresosDetalle as $fila) {
            $csvRows[] = [$fila['tipo'], $fila['codigo'], $fila['cliente'], $fila['fecha'], $fila['estado'], $num($fila['total'])];
        }
        break;
    case 'ventas':
    default:
        $csvHeaders = ['Código', 'Cliente', 'Estado', 'Fecha', 'Total'];
        foreach ($ingresosDetalle as $fila) {
            if ($fila['tipo'] !== 'Venta') {
                continue;
            }
            $csvRows[] = [$fila['codigo'], $fila['cliente'], $fila['estado'], $fila['fecha'], $num($fila['total'])];
        }
        break;
}

if (($_GET['export'] ?? '') === 'csv') {
    $nombreArchivo = 'reporte_' . $report . '_' . $desde . '_' . $hasta . '.csv';
    $gxExport($nombreArchivo, $csvHeaders, $csvRows);
}

$urlExport = static function (string $rep) use ($desde, $hasta): string {
    return h(BASE_URL . '/modules/reports/index.php?' . http_build_query([
        'export' => 'csv', 'report' => $rep, 'desde' => $desde, 'hasta' => $hasta,
    ]));
};
$urlReporte = static function (string $rep) use ($desde, $hasta): string {
    return h(BASE_URL . '/modules/reports/index.php?' . http_build_query([
        'report' => $rep, 'desde' => $desde, 'hasta' => $hasta,
    ]));
};

require_once __DIR__ . '/../../includes/header.php';
echo '<link rel="stylesheet" href="' . h(BASE_URL . '/assets/css/theme.css') . '">';
?>
<div class="card" style="margin-bottom:18px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-chart-pie"></i> Reportes del negocio</div>
    <a class="btn btn-success btn-sm" href="<?= $urlExport($report) ?>"><i class="fa-solid fa-file-csv"></i> Exportar CSV</a>
  </div>
  <form method="GET" class="grid grid-4">
    <div class="form-group">
      <label class="form-label">Desde</label>
      <input type="date" name="desde" class="form-control" value="<?= h($desde) ?>" required>
    </div>
    <div class="form-group">
      <label class="form-label">Hasta</label>
      <input type="date" name="hasta" class="form-control" value="<?= h($hasta) ?>" required>
    </div>
    <div class="form-group">
      <label class="form-label">Reporte</label>
      <select name="report" class="form-control">
        <?php foreach ($reportesValidos as $rep): ?>
          <option value="<?= $rep ?>" <?= $report === $rep ? 'selected' : '' ?>><?= ucfirst($rep) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="form-group" style="display:flex;align-items:flex-end;gap:8px;">
      <button class="btn btn-primary" type="submit"><i class="fa-solid fa-filter"></i> Aplicar</button>
      <a class="btn btn-ghost" href="<?= h(BASE_URL . '/modules/reports/index.php') ?>"><i class="fa-solid fa-rotate"></i></a>
    </div>
  </form>
  <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:6px;">
    <?php foreach ($reportesValidos as $rep): ?>
      <a class="chip <?= $report === $rep ? 'active' : '' ?>" href="<?= $urlReporte($rep) ?>"><?= ucfirst($rep) ?></a>
    <?php endforeach; ?>
  </div>
</div>

<div class="stats-grid">
  <div class="stat-card"><div class="label">Ventas en rango</div><div class="value"><?= money($ventasKpi['total']) ?></div><small class="trend"><?= (int)$ventasKpi['num'] ?> comprobantes</small><i class="fa-solid fa-cash-register"></i></div>
  <div class="stat-card"><div class="label">Pedidos en rango</div><div class="value"><?= money($pedidosKpi['total']) ?></div><small class="trend"><?= (int)$pedidosKpi['num'] ?> pedidos</small><i class="fa-solid fa-bag-shopping"></i></div>
  <div class="stat-card"><div class="label">Ingresos cobrados</div><div class="value"><?= money($ingresosTotales) ?></div><small class="trend">Ventas pagadas + pedidos completados</small><i class="fa-solid fa-sack-dollar"></i></div>
  <div class="stat-card"><div class="label">Margen realizado</div><div class="value"><?= money($margenKpi['margen']) ?></div><small class="trend">Venta − costo, ítems no cancelados</small><i class="fa-solid fa-chart-line"></i></div>
  <div class="stat-card"><div class="label">Stock valorizado (costo)</div><div class="value"><?= money($stockKpi['valor_costo']) ?></div><small class="trend"><?= (int)$stockKpi['unidades'] ?> unidades activas</small><i class="fa-solid fa-warehouse"></i></div>
  <div class="stat-card"><div class="label">Stock valorizado (venta)</div><div class="value"><?= money($stockKpi['valor_venta']) ?></div><small class="trend">Precio oferta o precio venta</small><i class="fa-solid fa-coins"></i></div>
</div>

<div class="grid grid-2">
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fa-solid fa-chart-column"></i> Ventas por <?= $porMes ? 'mes' : 'día' ?></div>
      <a class="btn btn-ghost btn-sm" href="<?= $urlExport('ventas') ?>"><i class="fa-solid fa-file-csv"></i> CSV</a>
    </div>
    <?= $svgBarras($buckets, $ventasGrafico, '#6366f1', 'Ventas por fecha') ?>
  </div>
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fa-solid fa-chart-column"></i> Pedidos por <?= $porMes ? 'mes' : 'día' ?></div>
      <a class="btn btn-ghost btn-sm" href="<?= $urlExport('pedidos') ?>"><i class="fa-solid fa-file-csv"></i> CSV</a>
    </div>
    <?= $svgBarras($buckets, $pedidosGrafico, '#22d3ee', 'Pedidos por fecha') ?>
  </div>
</div>

<div class="grid grid-2" style="margin-top:18px;">
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-fire"></i> Productos más vendidos</div>
      <a class="btn btn-ghost btn-sm" href="<?= $urlExport('productos') ?>"><i class="fa-solid fa-file-csv"></i> CSV</a>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Ingresos</th></tr></thead>
        <tbody>
        <?php if (!$topProductos): ?>
          <tr><td colspan="4" style="text-align:center;color:var(--muted);">Sin ventas en el rango.</td></tr>
        <?php else: foreach ($topProductos as $i => $p): ?>
          <tr>
            <td><?= $i + 1 ?></td>
            <td><strong><?= h($p['nombre']) ?></strong><br><small class="product-code"><?= h($p['codigo']) ?></small></td>
            <td><?= (int)$p['unidades'] ?></td>
            <td><?= money($p['ingresos']) ?></td>
          </tr>
        <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-list-check"></i> Pedidos por estado</div></div>
    <?php if (!$estadosPedido): ?>
      <p style="color:var(--muted);">Sin pedidos en el rango.</p>
    <?php else: ?>
      <?php $maxEstado = max(1, (int)$estadosPedido[0]['num']); ?>
      <?php foreach ($estadosPedido as $e): ?>
        <div style="margin-bottom:12px;">
          <div class="summary-row"><span><?= badgeEstado($e['estado']) ?></span><strong><?= (int)$e['num'] ?> · <?= money($e['total']) ?></strong></div>
          <div style="height:8px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden;">
            <div style="height:100%;width:<?= round(((int)$e['num'] / $maxEstado) * 100, 2) ?>%;background:linear-gradient(90deg,#6366f1,#22d3ee);"></div>
          </div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>
</div>

<div class="card" style="margin-top:18px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-receipt"></i> Ingresos detallados (ventas y pedidos)</div>
    <a class="btn btn-ghost btn-sm" href="<?= $urlExport('ingresos') ?>"><i class="fa-solid fa-file-csv"></i> CSV</a>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tipo</th><th>Código</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th>Total</th><th>Pedido</th></tr></thead>
      <tbody>
      <?php if (!$ingresosDetalle): ?>
        <tr><td colspan="7" style="text-align:center;color:var(--muted);">Sin ingresos en el rango.</td></tr>
      <?php else: foreach (array_slice($ingresosDetalle, 0, 20) as $fila): ?>
        <tr>
          <td><span class="badge badge-<?= $fila['tipo'] === 'Venta' ? 'primary' : 'info' ?>"><?= h($fila['tipo']) ?></span></td>
          <td><strong><?= h($fila['codigo']) ?></strong></td>
          <td><?= h($fila['cliente']) ?></td>
          <td><?= fecha($fila['fecha']) ?></td>
          <td><?= badgeEstado($fila['estado']) ?></td>
          <td><?= money($fila['total']) ?></td>
          <td>
            <?php if ($fila['tipo'] === 'Pedido' && (int)$fila['pedido_id'] > 0): ?>
              <a class="btn btn-info btn-sm btn-icon" href="<?= h(BASE_URL . '/modules/orders/view.php?id=' . (int)$fila['pedido_id']) ?>" title="Ver pedido"><i class="fa-solid fa-eye"></i></a>
            <?php else: ?>—<?php endif; ?>
          </td>
        </tr>
      <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>
</div>

<div class="card" style="margin-top:18px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-percent"></i> Márgenes por producto</div>
    <a class="btn btn-ghost btn-sm" href="<?= $urlExport('margenes') ?>"><i class="fa-solid fa-file-csv"></i> CSV</a>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Código</th><th>Producto</th><th>Compra</th><th>Venta</th><th>Precio efectivo</th><th>Margen unitario</th><th>Margen %</th><th>Stock</th></tr></thead>
      <tbody>
      <?php foreach (array_slice($margenes, 0, 20) as $m): ?>
        <tr>
          <td><strong><?= h($m['codigo']) ?></strong></td>
          <td><?= h($m['nombre']) ?></td>
          <td><?= money($m['precio_compra']) ?></td>
          <td><?= money($m['precio_venta']) ?></td>
          <td><?= money($m['precio_efectivo']) ?></td>
          <td><?= money($m['margen_unitario']) ?></td>
          <td><?= number_format((float)$m['margen_pct'], 2) ?>%</td>
          <td><?= (int)$m['stock'] ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<div class="card" style="margin-top:18px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-warehouse"></i> Stock valorizado</div>
    <a class="btn btn-ghost btn-sm" href="<?= $urlExport('stock') ?>"><i class="fa-solid fa-file-csv"></i> CSV</a>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Código</th><th>Producto</th><th>Stock</th><th>Mínimo</th><th>Valor costo</th><th>Valor venta</th><th>Utilidad potencial</th></tr></thead>
      <tbody>
      <?php foreach (array_slice($stockValorizado, 0, 20) as $s): ?>
        <tr>
          <td><strong><?= h($s['codigo']) ?></strong></td>
          <td><?= h($s['nombre']) ?></td>
          <td <?= (int)$s['stock'] <= (int)$s['stock_minimo'] ? 'style="color:var(--danger);font-weight:700;"' : '' ?>><?= (int)$s['stock'] ?></td>
          <td><?= (int)$s['stock_minimo'] ?></td>
          <td><?= money($s['valor_costo']) ?></td>
          <td><?= money($s['valor_venta']) ?></td>
          <td><?= money((float)$s['valor_venta'] - (float)$s['valor_costo']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
