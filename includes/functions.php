<?php
/** Helpers de presentación y formato (sobre la capa de seguridad). */
require_once __DIR__ . '/auth.php';

function money($n, ?string $currency = null): string
{
    return money_format_local($n, $currency);
}

/** Alias histórico usado por módulos heredados. */
function getConfig(string $key, $default = null)
{
    return config_value($key, $default);
}

function fecha($d): string
{
    if (!$d) {
        return '-';
    }
    return date('d/m/Y H:i', strtotime((string)$d));
}

function fecha_corta($d): string
{
    if (!$d) {
        return '-';
    }
    return date('d/m/Y', strtotime((string)$d));
}

function badgeEstado($estado): string
{
    $map = [
        'activo' => 'success', 'inactivo' => 'secondary', 'bloqueado' => 'danger',
        'pendiente' => 'warning', 'pagado' => 'success', 'cancelado' => 'danger',
        'entregado' => 'info', 'confirmado' => 'success', 'preparando' => 'info',
        'completado' => 'success', 'abierto' => 'primary', 'en_proceso' => 'warning',
        'resuelto' => 'success', 'cerrado' => 'secondary', 'baja' => 'secondary',
        'media' => 'info', 'alta' => 'warning', 'urgente' => 'danger',
        'recibido' => 'info', 'en_diagnostico' => 'warning', 'presupuesto_enviado' => 'info',
        'esperando_aprobacion' => 'warning', 'aprobado' => 'success', 'en_reparacion' => 'primary',
        'esperando_repuestos' => 'warning', 'en_pruebas' => 'info', 'reparado' => 'success',
        'listo_para_entregar' => 'success', 'nueva' => 'primary',
    ];
    $cls = $map[$estado] ?? 'secondary';
    $label = ucfirst(str_replace('_', ' ', (string)$estado));
    return '<span class="badge badge-' . $cls . '">' . h($label) . '</span>';
}

function paginate(int $total, int $perPage = 10, int $page = 1): array
{
    $perPage = max(1, $perPage);
    $pages = max(1, (int)ceil($total / $perPage));
    $page = max(1, min($page, $pages));
    return [
        'page' => $page, 'pages' => $pages,
        'offset' => ($page - 1) * $perPage,
        'perPage' => $perPage, 'total' => $total,
    ];
}

/** Enlaces de paginación que conservan todos los filtros de la URL. */
function pagination_links(array $info, string $base, array $params = []): string
{
    if ($info['pages'] <= 1) {
        return '';
    }
    $params = array_diff_key($params, ['page' => 1]);
    $link = function (int $page) use ($base, $params) {
        return h($base . '?' . http_build_query(array_merge($params, ['page' => $page])));
    };
    $html = '<nav class="pagination" aria-label="Paginación">';
    $html .= '<a href="' . $link(1) . '" aria-label="Primera página"><i class="fa-solid fa-angles-left"></i></a>';
    $html .= '<a href="' . $link(max(1, $info['page'] - 1)) . '" aria-label="Anterior"><i class="fa-solid fa-angle-left"></i></a>';
    $start = max(1, $info['page'] - 3);
    $end = min($info['pages'], $info['page'] + 3);
    for ($i = $start; $i <= $end; $i++) {
        $html .= $i === $info['page']
            ? '<span class="active" aria-current="page">' . $i . '</span>'
            : '<a href="' . $link($i) . '">' . $i . '</a>';
    }
    $html .= '<a href="' . $link(min($info['pages'], $info['page'] + 1)) . '" aria-label="Siguiente"><i class="fa-solid fa-angle-right"></i></a>';
    $html .= '<a href="' . $link($info['pages']) . '" aria-label="Última página"><i class="fa-solid fa-angles-right"></i></a>';
    $html .= '</nav>';
    return $html;
}

function getStats(): array
{
    $db = db();
    $q = fn(string $sql) => (float)$db->query($sql)->fetchColumn();
    $stats = [
        'productos'      => (int)$q("SELECT COUNT(*) FROM productos WHERE estado='activo'"),
        'clientes'       => (int)$q('SELECT COUNT(*) FROM clientes'),
        'ventas_mes'     => $q("SELECT COALESCE(SUM(total),0) FROM ventas WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())"),
        'ventas_hoy'     => $q("SELECT COALESCE(SUM(total),0) FROM ventas WHERE DATE(created_at)=CURDATE()"),
        'ventas_total'   => $q("SELECT COALESCE(SUM(total),0) FROM ventas WHERE estado IN ('pagado','entregado')"),
        'pedidos'        => (int)$q('SELECT COUNT(*) FROM pedidos'),
        'pedidos_pendientes' => (int)$q("SELECT COUNT(*) FROM pedidos WHERE estado IN ('pendiente','confirmado','preparando')"),
        'tickets_abiertos' => (int)$q("SELECT COUNT(*) FROM tickets WHERE estado IN ('abierto','en_proceso')"),
        'stock_bajo'     => (int)$q("SELECT COUNT(*) FROM productos WHERE stock <= stock_minimo AND estado='activo'"),
        'agotados'       => (int)$q("SELECT COUNT(*) FROM productos WHERE stock <= 0 AND estado='activo'"),
        'usuarios'       => (int)$q("SELECT COUNT(*) FROM usuarios WHERE estado='activo'"),
        'reparaciones_activas' => (int)$q("SELECT COUNT(*) FROM reparaciones WHERE estado NOT IN ('entregado','cancelado')"),
        'reparaciones_finalizadas' => (int)$q("SELECT COUNT(*) FROM reparaciones WHERE estado IN ('entregado','cancelado')"),
        'ingresos'       => $q("SELECT COALESCE(SUM(total),0) FROM pedidos WHERE estado='completado'") + $q("SELECT COALESCE(SUM(total),0) FROM ventas WHERE estado IN ('pagado','entregado')"),
    ];
    return $stats;
}

/** Consulta segura de características JSON del producto. */
function product_specs(array $product): array
{
    $raw = $product['especificaciones'] ?? null;
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}
