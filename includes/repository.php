<?php
/**
 * GALAX PC REPAIR — Capa de dominio.
 * Toda regla de negocio (precios, stock, totales) se resuelve aquí,
 * en el servidor, con consultas preparadas.
 */
require_once __DIR__ . '/functions.php';

/**
 * URL segura de la imagen de un producto.
 *
 * El catálogo heredado guarda rutas relativas reales (`assets/img/productos/…`),
 * mientras que los uploads nuevos usan el prefijo `upload:`. Resolvemos ambos
 * formatos en un solo lugar para no codificar barras ni construir rutas
 * relativas peligrosas en cada vista.
 */
function product_image_url(?string $stored): string
{
    $stored = trim((string)$stored);
    $placeholder = BASE_URL . '/assets/img/product-placeholder.svg';
    if ($stored === '') {
        return $placeholder;
    }
    if (str_starts_with($stored, 'upload:')) {
        $name = substr($stored, 7);
        return preg_match('/^[A-Za-z0-9._-]+$/', $name)
            ? BASE_URL . '/assets/uploads/' . rawurlencode($name)
            : $placeholder;
    }
    if (preg_match('#^[A-Za-z0-9_./-]+$#', $stored) && !str_contains($stored, '..')) {
        $relative = ltrim($stored, '/');
        if (is_file(BASE_PATH . '/' . $relative)) {
            $parts = array_map('rawurlencode', explode('/', $relative));
            return BASE_URL . '/' . implode('/', $parts);
        }
    }
    if (preg_match('/^[A-Za-z0-9._-]+$/', $stored)) {
        return BASE_URL . '/assets/uploads/' . rawurlencode($stored);
    }
    return $placeholder;
}

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

function categories_list(bool $onlyActive = true): array
{
    $sql = 'SELECT c.*, (SELECT COUNT(*) FROM productos p
                         WHERE p.categoria_id=c.id AND p.estado=\'activo\' AND p.publicado=1) AS productos
              FROM categorias c ' . ($onlyActive ? "WHERE c.estado='activo' " : '') . 'ORDER BY c.nombre';
    return db()->query($sql)->fetchAll();
}

function brands_list(): array
{
    return db()->query("SELECT DISTINCT marca FROM productos WHERE marca IS NOT NULL AND marca<>'' AND estado='activo' AND publicado=1 ORDER BY marca")->fetchAll(PDO::FETCH_COLUMN);
}

/** Búsqueda real en MySQL. Devuelve filas + metadatos de paginación. */
function catalog_products(array $filters = []): array
{
    $where = ["p.estado='activo'", 'p.publicado=1'];
    $params = [];

    $q = trim((string)($filters['q'] ?? ''));
    if ($q !== '') {
        $terms = preg_split('/\s+/u', $q) ?: [];
        foreach (array_slice($terms, 0, 6) as $term) {
            $like = '%' . $term . '%';
            $where[] = '(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.codigo LIKE ? OR p.marca LIKE ? OR p.modelo LIKE ? OR p.especificaciones LIKE ? OR c.nombre LIKE ?)';
            array_push($params, $like, $like, $like, $like, $like, $like, $like);
        }
    }
    if (!empty($filters['cat'])) {
        $where[] = 'p.categoria_id = ?';
        $params[] = (int)$filters['cat'];
    }
    if (!empty($filters['marca'])) {
        $where[] = 'p.marca = ?';
        $params[] = (string)$filters['marca'];
    }
    if (isset($filters['min']) && $filters['min'] !== '') {
        $where[] = 'p.precio_venta >= ?';
        $params[] = max(0, (float)$filters['min']);
    }
    if (isset($filters['max']) && $filters['max'] !== '') {
        $where[] = 'p.precio_venta <= ?';
        $params[] = max(0, (float)$filters['max']);
    }
    if (($filters['disponibilidad'] ?? '') === 'disponible') {
        $where[] = 'p.stock > 0';
    } elseif (($filters['disponibilidad'] ?? '') === 'agotado') {
        $where[] = 'p.stock <= 0';
    }
    if (!empty($filters['caracteristica'])) {
        $where[] = '(p.descripcion LIKE ? OR p.especificaciones LIKE ?)';
        $like = '%' . $filters['caracteristica'] . '%';
        $params[] = $like;
        $params[] = $like;
    }
    if (!empty($filters['destacado'])) {
        $where[] = 'p.destacado = 1';
    }
    if (!empty($filters['nuevo'])) {
        $where[] = 'p.es_nuevo = 1';
    }
    if (!empty($filters['oferta'])) {
        $where[] = 'p.precio_oferta IS NOT NULL';
    }

    $sqlWhere = implode(' AND ', $where);
    $countStmt = db()->prepare("SELECT COUNT(*) FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id WHERE $sqlWhere");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $perPage = max(6, min(48, (int)($filters['per_page'] ?? 12)));
    $pageInfo = paginate($total, $perPage, (int)($filters['page'] ?? 1));

    $orders = [
        'relevancia' => 'p.destacado DESC, p.id DESC',
        'precio_asc' => 'COALESCE(p.precio_oferta,p.precio_venta) ASC',
        'precio_desc' => 'COALESCE(p.precio_oferta,p.precio_venta) DESC',
        'nombre' => 'p.nombre ASC',
        'nuevos' => 'p.id DESC',
    ];
    $order = $orders[$filters['orden'] ?? 'relevancia'] ?? $orders['relevancia'];

    $stmt = db()->prepare(
        "SELECT p.*, c.nombre AS categoria, c.slug AS categoria_slug
           FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id
          WHERE $sqlWhere ORDER BY $order LIMIT ? OFFSET ?"
    );
    foreach ($params as $i => $value) {
        $stmt->bindValue($i + 1, $value);
    }
    $stmt->bindValue(count($params) + 1, $pageInfo['perPage'], PDO::PARAM_INT);
    $stmt->bindValue(count($params) + 2, $pageInfo['offset'], PDO::PARAM_INT);
    $stmt->execute();

    return ['rows' => $stmt->fetchAll(), 'page' => $pageInfo, 'total' => $total];
}

function product_by_id(int $id): ?array
{
    $stmt = db()->prepare(
        "SELECT p.*, c.nombre AS categoria, c.slug AS categoria_slug
           FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id
          WHERE p.id=? AND p.estado='activo' AND p.publicado=1 LIMIT 1"
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function product_by_slug(string $slug): ?array
{
    $stmt = db()->prepare(
        "SELECT p.*, c.nombre AS categoria, c.slug AS categoria_slug
           FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id
          WHERE p.slug=? AND p.estado='activo' AND p.publicado=1 LIMIT 1"
    );
    $stmt->execute([$slug]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function effective_price(array $product): float
{
    return (float)($product['precio_oferta'] !== null ? $product['precio_oferta'] : $product['precio_venta']);
}

function related_products(array $product, int $limit = 4): array
{
    $stmt = db()->prepare(
        "SELECT p.*, c.nombre AS categoria FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id
          WHERE p.estado='activo' AND p.publicado=1 AND p.id<>? AND p.categoria_id=?
          ORDER BY p.destacado DESC, p.id DESC LIMIT " . $limit
    );
    $stmt->execute([(int)$product['id'], (int)$product['categoria_id']]);
    return $stmt->fetchAll();
}

function services_list(): array
{
    return db()->query('SELECT * FROM servicios WHERE activo=1 ORDER BY orden, id')->fetchAll();
}

/** Tarjeta reusable de producto para el catálogo público. */
function product_card_html(array $p): string
{
    $id = (int)$p['id'];
    $slug = (string)($p['slug'] ?? '');
    $url = BASE_URL . '/shop/product.php?id=' . $id . ($slug !== '' ? '&slug=' . rawurlencode($slug) : '');
    $price = effective_price($p);
    $hasOffer = $p['precio_oferta'] !== null && (float)$p['precio_oferta'] < (float)$p['precio_venta'];
    $stock = (int)$p['stock'];
    $stockClass = $stock > 5 ? 'stock-ok' : ($stock > 0 ? 'stock-low' : 'stock-out');
    $stockLabel = $stock > 5 ? 'Disponible' : ($stock > 0 ? 'Últimas unidades' : 'Agotado');
    $media = '<img src="' . h(product_image_url($p['imagen'] ?? '')) . '" alt="' . h($p['nombre']) . '" loading="lazy">';
    $html = '<article class="product-card">';
    $html .= '<div class="product-media">' . $media . ($hasOffer ? '<span class="offer">OFERTA</span>' : '') . '</div>';
    $html .= '<div class="product-body">';
    $html .= '<span class="product-code">' . h($p['codigo']) . (!empty($p['marca']) ? ' · ' . h($p['marca']) : '') . '</span>';
    $html .= '<h3 class="product-title"><a href="' . h($url) . '">' . h($p['nombre']) . '</a></h3>';
    $html .= '<span class="product-meta">' . h($p['categoria'] ?? 'Producto') . '</span>';
    $html .= '<div class="product-price"><span class="now">' . h(money($price)) . '</span>'
        . ($hasOffer ? '<span class="before">' . h(money($p['precio_venta'])) . '</span>' : '') . '</div>';
    $html .= '<span class="stock-line ' . $stockClass . '"><i class="fa-solid fa-circle"></i> ' . $stockLabel . '</span>';
    $html .= '<div class="product-actions">';
    $html .= '<a class="btn btn-outline" href="' . h($url) . '"><i class="fa-solid fa-eye"></i> Ver</a>';
    if ($stock > 0) {
        $html .= '<button class="btn btn-primary" type="button" data-cart-action="add" data-product-id="' . $id . '" data-qty="1"><i class="fa-solid fa-cart-plus"></i> Agregar</button>';
    }
    $html .= '</div></div></article>';
    return $html;
}

/* ------------------------------------------------------------------ */
/* Carrito                                                             */
/* ------------------------------------------------------------------ */

function cart_session_token(): string
{
    if (empty($_SESSION['cart_token'])) {
        $_SESSION['cart_token'] = random_token(32);
    }
    return $_SESSION['cart_token'];
}

/** Obtiene (o crea) el carrito asociado a la sesión o al usuario. */
function cart_id(): int
{
    static $cartId = null;
    if ($cartId !== null) {
        return $cartId;
    }
    $db = db();
    if (isLoggedIn()) {
        $stmt = $db->prepare('SELECT id FROM carritos WHERE usuario_id=? LIMIT 1');
        $stmt->execute([(int)$_SESSION['user_id']]);
        $row = $stmt->fetch();
        if ($row) {
            return $cartId = (int)$row['id'];
        }
        $token = 'u_' . (int)$_SESSION['user_id'] . '_' . cart_session_token();
        $stmt = $db->prepare('INSERT INTO carritos (usuario_id, session_token) VALUES (?,?)');
        $stmt->execute([(int)$_SESSION['user_id'], substr($token, 0, 64)]);
        return $cartId = (int)$db->lastInsertId();
    }
    $token = cart_session_token();
    $stmt = $db->prepare('SELECT id FROM carritos WHERE session_token=? AND usuario_id IS NULL LIMIT 1');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if ($row) {
        return $cartId = (int)$row['id'];
    }
    $stmt = $db->prepare('INSERT INTO carritos (usuario_id, session_token) VALUES (NULL,?)');
    $stmt->execute([$token]);
    return $cartId = (int)$db->lastInsertId();
}

function cart_items(): array
{
    $stmt = db()->prepare(
        "SELECT ci.producto_id, ci.cantidad, p.codigo, p.nombre, p.slug, p.imagen, p.stock,
                p.precio_venta, p.precio_oferta, p.marca, p.modelo,
                COALESCE(p.precio_oferta,p.precio_venta) AS precio
           FROM carrito_items ci JOIN productos p ON p.id=ci.producto_id
          WHERE ci.carrito_id=? AND p.estado='activo' AND p.publicado=1
          ORDER BY p.nombre"
    );
    $stmt->execute([cart_id()]);
    return $stmt->fetchAll();
}

function cart_count(): int
{
    $stmt = db()->prepare('SELECT COALESCE(SUM(cantidad),0) FROM carrito_items WHERE carrito_id=?');
    $stmt->execute([cart_id()]);
    return (int)$stmt->fetchColumn();
}

function cart_totals(string $metodoEntrega = 'tienda'): array
{
    $items = cart_items();
    $subtotal = 0.0;
    foreach ($items as $item) {
        $subtotal += (float)$item['precio'] * (int)$item['cantidad'];
    }
    $discountPct = max(0, min(100, (float)config_value('descuento_promocional', 0)));
    $discount = round($subtotal * $discountPct / 100, 2);
    $taxable = $subtotal - $discount;
    $tax = round($taxable * ((float)config_value('igv_porcentaje', 18)) / 100, 2);
    // El envío lo fija el servidor con la misma regla que place_order().
    $shipping = $metodoEntrega === 'domicilio' && $items
        ? max(0, (float)config_value('envio_costo', 12))
        : 0.0;
    return [
        'items' => $items,
        'subtotal' => round($subtotal, 2),
        'descuento' => $discount,
        'descuento_pct' => $discountPct,
        'impuestos' => $tax,
        'envio' => $shipping,
        'total' => round($taxable + $tax + $shipping, 2),
    ];
}

function cart_snapshot(): array
{
    $stmt = db()->prepare('SELECT producto_id, cantidad FROM carrito_items WHERE carrito_id=? ORDER BY producto_id');
    $stmt->execute([cart_id()]);
    return $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
}

function cart_push_history(string $action): void
{
    $stmt = db()->prepare('INSERT INTO carrito_historial (carrito_id, accion, snapshot) VALUES (?,?,?)');
    $stmt->execute([cart_id(), mb_substr($action, 0, 40), json_encode(cart_snapshot(), JSON_UNESCAPED_UNICODE)]);
    $db = db();
    $db->prepare('DELETE FROM carrito_historial WHERE carrito_id=? AND id NOT IN (SELECT id FROM (SELECT id FROM carrito_historial WHERE carrito_id=? ORDER BY id DESC LIMIT 10) x)')
       ->execute([cart_id(), cart_id()]);
}

function cart_apply_snapshot(array $snapshot): void
{
    $db = db();
    $db->prepare('DELETE FROM carrito_items WHERE carrito_id=?')->execute([cart_id()]);
    $stmt = $db->prepare('INSERT INTO carrito_items (carrito_id, producto_id, cantidad) VALUES (?,?,?)');
    foreach ($snapshot as $productId => $qty) {
        $qty = max(1, min(99, (int)$qty));
        $stmt->execute([cart_id(), (int)$productId, $qty]);
    }
}

/** Devuelve ['ok'=>bool, 'error'=>string|null] */
function cart_add(int $productId, int $qty): array
{
    $product = product_by_id($productId);
    if (!$product) {
        return ['ok' => false, 'error' => 'Producto no disponible'];
    }
    $qty = max(1, min(99, $qty));
    $stmt = db()->prepare('SELECT cantidad FROM carrito_items WHERE carrito_id=? AND producto_id=?');
    $stmt->execute([cart_id(), $productId]);
    $current = (int)$stmt->fetchColumn();
    $desired = $current + $qty;
    if ($desired > (int)$product['stock']) {
        return ['ok' => false, 'error' => 'Stock disponible: ' . (int)$product['stock']];
    }
    cart_push_history('agregar');
    db()->prepare(
        'INSERT INTO carrito_items (carrito_id, producto_id, cantidad) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad)'
    )->execute([cart_id(), $productId, min(99, $desired)]);
    return ['ok' => true, 'error' => null];
}

function cart_set_qty(int $productId, int $qty): array
{
    $product = product_by_id($productId);
    if (!$product) {
        return ['ok' => false, 'error' => 'Producto no disponible'];
    }
    $qty = max(0, min(99, $qty));
    if ($qty > (int)$product['stock']) {
        return ['ok' => false, 'error' => 'Stock disponible: ' . (int)$product['stock']];
    }
    cart_push_history('cantidad');
    if ($qty === 0) {
        db()->prepare('DELETE FROM carrito_items WHERE carrito_id=? AND producto_id=?')->execute([cart_id(), $productId]);
    } else {
        db()->prepare('UPDATE carrito_items SET cantidad=? WHERE carrito_id=? AND producto_id=?')->execute([$qty, cart_id(), $productId]);
    }
    return ['ok' => true, 'error' => null];
}

function cart_remove(int $productId): array
{
    cart_push_history('eliminar');
    db()->prepare('DELETE FROM carrito_items WHERE carrito_id=? AND producto_id=?')->execute([cart_id(), $productId]);
    return ['ok' => true, 'error' => null];
}

function cart_clear(): void
{
    cart_push_history('vaciar');
    db()->prepare('DELETE FROM carrito_items WHERE carrito_id=?')->execute([cart_id()]);
}

/** Restaura el estado anterior. Nunca afecta a pedidos confirmados. */
function cart_undo(): array
{
    $db = db();
    $stmt = $db->prepare('SELECT id, snapshot FROM carrito_historial WHERE carrito_id=? ORDER BY id DESC LIMIT 1');
    $stmt->execute([cart_id()]);
    $rows = $stmt->fetchAll();
    if (count($rows) < 1) {
        return ['ok' => false, 'error' => 'No hay una acción anterior para deshacer'];
    }
    $snapshot = json_decode($rows[0]['snapshot'], true);
    if (!is_array($snapshot)) {
        return ['ok' => false, 'error' => 'No se pudo restaurar el carrito'];
    }
    cart_push_history('deshacer');
    cart_apply_snapshot($snapshot);
    return ['ok' => true, 'error' => null];
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

function validate_checkout(array $data): array
{
    $errors = [];
    $nombre = trim((string)($data['nombre'] ?? ''));
    $email = trim((string)($data['email'] ?? ''));
    $telefono = trim((string)($data['telefono'] ?? ''));
    $direccion = trim((string)($data['direccion'] ?? ''));
    $entrega = (string)($data['metodo_entrega'] ?? 'tienda');
    $pago = (string)($data['metodo_pago'] ?? 'efectivo');
    if (mb_strlen($nombre) < 3 || mb_strlen($nombre) > 160) {
        $errors[] = 'Ingrese un nombre válido';
    }
    if (!valid_email($email)) {
        $errors[] = 'Ingrese un correo válido';
    }
    if (!preg_match('/^[0-9+\s()-]{7,32}$/', $telefono)) {
        $errors[] = 'Ingrese un teléfono válido';
    }
    if ($entrega === 'domicilio' && mb_strlen($direccion) < 6) {
        $errors[] = 'La dirección de entrega es obligatoria';
    }
    if (!in_array($entrega, ['tienda', 'domicilio'], true)) {
        $errors[] = 'Método de entrega inválido';
    }
    if (!in_array($pago, ['efectivo', 'tarjeta', 'transferencia', 'yape', 'plin'], true)) {
        $errors[] = 'Método de pago inválido';
    }
    return $errors;
}

/** Confirmación transaccional: vuelve a leer precios y stock desde MySQL. */
function place_order(array $data): array
{
    $errors = validate_checkout($data);
    if ($errors) {
        return ['ok' => false, 'error' => implode('. ', $errors)];
    }
    $db = db();
    $db->beginTransaction();
    try {
        $stmt = $db->prepare(
            "SELECT ci.producto_id, ci.cantidad, p.codigo, p.nombre, p.precio_venta, p.precio_oferta, p.stock, p.garantia
               FROM carrito_items ci JOIN productos p ON p.id=ci.producto_id
              WHERE ci.carrito_id=? FOR UPDATE"
        );
        $stmt->execute([cart_id()]);
        $items = $stmt->fetchAll();
        if (!$items) {
            throw new RuntimeException('El carrito está vacío');
        }
        $subtotal = 0.0;
        foreach ($items as $item) {
            $qty = (int)$item['cantidad'];
            if ($qty < 1 || $qty > (int)$item['stock']) {
                throw new RuntimeException('Stock insuficiente para ' . $item['nombre']);
            }
            $unit = (float)($item['precio_oferta'] !== null ? $item['precio_oferta'] : $item['precio_venta']);
            $subtotal += $unit * $qty;
        }
        $subtotal = round($subtotal, 2);
        $discountPct = max(0, min(100, (float)config_value('descuento_promocional', 0)));
        $discount = round($subtotal * $discountPct / 100, 2);
        $tax = round(($subtotal - $discount) * ((float)config_value('igv_porcentaje', 18)) / 100, 2);
        $shipping = ($data['metodo_entrega'] ?? 'tienda') === 'domicilio'
            ? max(0, (float)config_value('envio_costo', 12)) : 0.0;
        $total = round($subtotal - $discount + $tax + $shipping, 2);

        $clienteId = null;
        if (isLoggedIn()) {
            $stmt = $db->prepare('SELECT id FROM clientes WHERE usuario_id=? LIMIT 1');
            $stmt->execute([(int)$_SESSION['user_id']]);
            $found = $stmt->fetchColumn();
            $clienteId = $found === false ? null : (int)$found;
        }

        $code = generateCode('PED', 'pedidos');
        $stmt = $db->prepare(
            "INSERT INTO pedidos
             (codigo, usuario_id, cliente_id, nombre_cliente, documento, email_cliente, telefono_cliente,
              direccion, referencia, metodo_entrega, metodo_pago, subtotal, descuento, impuestos, envio, total, estado, notas)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pendiente',?)"
        );
        $stmt->execute([
            $code,
            isLoggedIn() ? (int)$_SESSION['user_id'] : null,
            $clienteId,
            trim((string)$data['nombre']),
            trim((string)($data['documento'] ?? '')) ?: null,
            trim((string)$data['email']),
            trim((string)$data['telefono']),
            trim((string)($data['direccion'] ?? '')) ?: null,
            trim((string)($data['referencia'] ?? '')) ?: null,
            (string)$data['metodo_entrega'],
            (string)$data['metodo_pago'],
            $subtotal, $discount, $tax, $shipping, $total,
            mb_substr(trim((string)($data['notas'] ?? '')), 0, 1000) ?: null,
        ]);
        $orderId = (int)$db->lastInsertId();

        $detailStmt = $db->prepare(
            'INSERT INTO pedido_detalles (pedido_id, producto_id, sku, nombre_producto, cantidad, precio_unitario, descuento, subtotal)
             VALUES (?,?,?,?,?,?,?,?)'
        );
        $stockStmt = $db->prepare('UPDATE productos SET stock=stock-? WHERE id=? AND stock>=?');
        $movStmt = $db->prepare(
            'INSERT INTO inventario_movimientos (producto_id,tipo,cantidad,stock_anterior,stock_nuevo,motivo,documento,usuario_id)
             VALUES (?,\'venta\',?,?,?,?,?,?)'
        );
        $warrantyStmt = $db->prepare(
            'INSERT INTO garantias (pedido_id, detalle_id, descripcion, valido_hasta) VALUES (?,?,?,DATE_ADD(CURDATE(), INTERVAL 12 MONTH))'
        );
        foreach ($items as $item) {
            $qty = (int)$item['cantidad'];
            $unit = (float)($item['precio_oferta'] !== null ? $item['precio_oferta'] : $item['precio_venta']);
            $lineDiscount = round($subtotal > 0 ? ($discount * $unit * $qty / $subtotal) : 0, 2);
            $lineSubtotal = round($unit * $qty - $lineDiscount, 2);
            $detailStmt->execute([$orderId, (int)$item['producto_id'], $item['codigo'], $item['nombre'], $qty, $unit, $lineDiscount, $lineSubtotal]);

            $before = (int)$item['stock'];
            $stockStmt->execute([$qty, (int)$item['producto_id'], $qty]);
            if ($stockStmt->rowCount() !== 1) {
                throw new RuntimeException('El stock cambió durante la compra. Intente nuevamente.');
            }
            $movStmt->execute([(int)$item['producto_id'], -$qty, $before, $before - $qty, 'Venta online ' . $code, $code, isLoggedIn() ? (int)$_SESSION['user_id'] : null]);
            if (!empty($item['garantia'])) {
                $warrantyStmt->execute([$orderId, (int)$db->lastInsertId(), $item['garantia']]);
            }
        }
        $db->prepare('DELETE FROM carrito_items WHERE carrito_id=?')->execute([cart_id()]);
        $db->prepare('INSERT INTO carrito_historial (carrito_id,accion,snapshot) VALUES (?,?,?)')
           ->execute([cart_id(), 'checkout_' . $code, json_encode([])]);
        $db->commit();
        audit_log('checkout', 'pedidos', $orderId, $code);
        if (!isLoggedIn()) {
            // Permite al invitado ver su comprobante sin exponer el pedido a terceros.
            $_SESSION['ultimo_pedido_invitado'] = [
                'id' => $orderId,
                'codigo' => $code,
                'email' => mb_strtolower(trim((string)$data['email'])),
                'expira' => time() + 24 * 60 * 60,
            ];
        }
        return ['ok' => true, 'id' => $orderId, 'codigo' => $code];
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[GALAX][CHECKOUT] ' . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

function order_by_id(int $id, ?int $ownerUserId = null): ?array
{
    $sql = 'SELECT * FROM pedidos WHERE id=?';
    $params = [$id];
    if ($ownerUserId !== null) {
        $sql .= ' AND usuario_id=?';
        $params[] = $ownerUserId;
    }
    $stmt = db()->prepare($sql . ' LIMIT 1');
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function order_details(int $orderId): array
{
    $stmt = db()->prepare('SELECT * FROM pedido_detalles WHERE pedido_id=? ORDER BY id');
    $stmt->execute([$orderId]);
    return $stmt->fetchAll();
}

function orders_for_user(int $userId): array
{
    $stmt = db()->prepare('SELECT * FROM pedidos WHERE usuario_id=? ORDER BY id DESC');
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

/** Autorización de un pedido de invitado, válida sólo en su sesión y por 24 h. */
function guest_order_granted(int $orderId): bool
{
    $grant = $_SESSION['ultimo_pedido_invitado'] ?? null;
    if (!is_array($grant) || (int)($grant['id'] ?? 0) !== $orderId) {
        return false;
    }
    if ((int)($grant['expira'] ?? 0) < time()) {
        unset($_SESSION['ultimo_pedido_invitado']);
        return false;
    }
    return true;
}

/** Conversación persistente del asistente para usuarios autenticados. */
function ai_conversation_id(): ?int
{
    if (!isLoggedIn()) {
        return null;
    }
    $db = db();
    $token = cart_session_token();
    $stmt = $db->prepare('SELECT id FROM ai_conversaciones WHERE usuario_id=? ORDER BY actualizado_en DESC LIMIT 1');
    $stmt->execute([(int)$_SESSION['user_id']]);
    $id = $stmt->fetchColumn();
    if ($id !== false) {
        return (int)$id;
    }
    $stmt = $db->prepare('INSERT INTO ai_conversaciones (session_token, usuario_id, titulo) VALUES (?,?,?)');
    $stmt->execute([$token, (int)$_SESSION['user_id'], 'Asistente GALAX']);
    return (int)$db->lastInsertId();
}

function ai_store_message(string $role, string $message, array $products = []): void
{
    $conversationId = ai_conversation_id();
    if ($conversationId === null) {
        return;
    }
    $db = db();
    $stmt = $db->prepare('INSERT INTO ai_mensajes (conversacion_id, rol, mensaje, productos_json) VALUES (?,?,?,?)');
    $stmt->execute([
        $conversationId,
        $role === 'user' ? 'usuario' : 'asistente',
        mb_substr($message, 0, 8000),
        $products ? json_encode($products, JSON_UNESCAPED_UNICODE) : null,
    ]);
    $days = max(1, min(365, (int)config_value('chat_historial_dias', 30)));
    $db->prepare('DELETE FROM ai_mensajes WHERE creado_en < DATE_SUB(NOW(), INTERVAL ? DAY)')
       ->execute([$days]);
    $db->prepare('UPDATE ai_conversaciones SET actualizado_en=NOW() WHERE id=?')->execute([$conversationId]);
}

/** Búsqueda para el asistente: términos seguros, sin SQL del modelo. */
function ai_catalog_search(string $query, int $limit = 6): array
{
    $query = trim(mb_substr($query, 0, 160));
    if ($query === '') {
        return [];
    }
    $synonyms = [
        'portatil' => 'laptop', 'portátil' => 'laptop', 'ordenador' => 'computadora',
        'pc' => 'computadora', 'gpu' => 'tarjeta gráfica', 'ram' => 'memoria',
        'disco' => 'ssd', 'almacenamiento' => 'ssd', 'teclado' => 'teclado',
    ];
    $normalized = mb_strtolower($query);
    foreach ($synonyms as $from => $to) {
        $normalized = str_replace($from, $to, $normalized);
    }
    $terms = preg_split('/[^\p{L}\p{N}]+/u', $normalized) ?: [];
    $stopwords = [
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
        'para', 'por', 'con', 'sin', 'que', 'en', 'y', 'o', 'a', 'mi', 'me', 'te',
        'se', 'lo', 'le', 'les', 'es', 'son', 'esta', 'está', 'tengo', 'tiene',
        'tienen', 'quiero', 'quisiera', 'necesito', 'busco', 'busca', 'buscar',
        'dame', 'favor', 'porfa', 'hola', 'buenos', 'buenas', 'dias', 'días',
        'tardes', 'noches', 'usted', 'tu', 'su', 'sus', 'algo', 'alguna', 'algun',
        'cosa', 'mas', 'más', 'menos', 'muy', 'como', 'cual', 'cuál', 'cuanto',
        'cuánto', 'donde', 'dónde', 'cuando', 'cuándo', 'hay', 'venden', 'vender',
        'comprar', 'cuesta', 'precio', 'barato', 'barata', 'economica', 'económica',
        'recomienda', 'recomiendas', 'recomendacion', 'recomendación', 'ayuda',
        'puedo', 'puedes', 'tienen', 'tiene', 'alguno', 'alguna', 'ninguno',
        'alguna', 'favor', 'por', 'favor', 'gracias', 'ok', 'si', 'sí', 'no',
    ];
    $terms = array_values(array_filter($terms, function ($t) use ($stopwords) {
        return mb_strlen($t) > 2 && !in_array($t, $stopwords, true);
    }));
    if (!$terms) {
        return [];
    }
    $where = ["p.estado='activo'", 'p.publicado=1'];
    $matchParts = [];
    $scoreParts = [];
    $likesByTerm = [];
    foreach (array_slice($terms, 0, 6) as $term) {
        $like = '%' . $term . '%';
        $likesByTerm[] = array_fill(0, 7, $like);
        $match = '(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.codigo LIKE ? OR p.marca LIKE ? OR p.modelo LIKE ? OR p.especificaciones LIKE ? OR c.nombre LIKE ?)';
        $matchParts[] = $match;
        $scoreParts[] = "($match)";
    }
    // OR entre términos (lenguaje natural) con ranking por nº de coincidencias.
    $termClause = '(' . implode(' OR ', $matchParts) . ')';
    $baseWhere = implode(' AND ', $where);
    $scoreExpr = '(' . implode(' + ', $scoreParts) . ')';
    // Orden de placeholders en el SQL: primero _score (SELECT), luego el WHERE.
    $params = [];
    foreach ($likesByTerm as $likes) {
        array_push($params, ...$likes);
    }
    foreach ($likesByTerm as $likes) {
        array_push($params, ...$likes);
    }
    $stmt = db()->prepare(
        "SELECT p.id, p.codigo, p.nombre, p.marca, p.modelo, p.descripcion, p.precio_venta, p.precio_oferta,
                p.stock, p.imagen, p.slug, p.especificaciones, p.garantia, c.nombre AS categoria,
                $scoreExpr AS _score
           FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id
          WHERE $baseWhere AND $termClause
          ORDER BY _score DESC, p.destacado DESC, p.stock DESC, p.id DESC LIMIT " . max(1, min(12, $limit))
    );
    $stmt->execute($params);
    return $stmt->fetchAll();
}
