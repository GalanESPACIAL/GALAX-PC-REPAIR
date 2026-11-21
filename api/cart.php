<?php
require_once __DIR__ . '/../includes/repository.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Método no permitido', 405);
}
require_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null);

$action = (string)($_POST['action'] ?? '');
$productId = (int)($_POST['product_id'] ?? 0);
$qty = (int)($_POST['qty'] ?? 1);

try {
    switch ($action) {
        case 'add':
            $result = cart_add($productId, $qty);
            $message = $result['ok'] ? 'Producto agregado al carrito' : $result['error'];
            break;
        case 'update':
            $result = cart_set_qty($productId, $qty);
            $message = $result['ok'] ? ($qty > 0 ? 'Cantidad actualizada' : 'Producto eliminado') : $result['error'];
            break;
        case 'remove':
            $result = cart_remove($productId);
            $message = 'Producto eliminado del carrito';
            break;
        case 'clear':
            cart_clear();
            $result = ['ok' => true, 'error' => null];
            $message = 'Carrito vaciado';
            break;
        case 'undo':
            $result = cart_undo();
            $message = $result['ok'] ? 'Carrito restaurado' : $result['error'];
            break;
        default:
            api_error('Acción desconocida', 400);
    }
    if (!$result['ok']) {
        api_error($result['error'], 422);
    }
    json_response([
        'ok' => true,
        'message' => $message,
        'count' => cart_count(),
        'total' => money_format_local(cart_totals()['total']),
        'reload' => $action === 'undo',
    ]);
} catch (Throwable $e) {
    error_log('[GALAX][CART_API] ' . $e->getMessage());
    api_error('No se pudo actualizar el carrito', 500);
}
