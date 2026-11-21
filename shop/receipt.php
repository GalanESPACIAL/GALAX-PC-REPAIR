<?php
require_once __DIR__ . '/../includes/receipt.php';
require_once __DIR__ . '/../includes/repository.php';

$orderId = max(0, (int)($_GET['pedido'] ?? 0));
$allowed = false;
$order = null;
if ($orderId > 0) {
    $stmt = db()->prepare('SELECT id, codigo, email_cliente, usuario_id FROM pedidos WHERE id=? LIMIT 1');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();
    if ($order) {
        if (isLoggedIn() && (isStaff() || (int)$order['usuario_id'] === (int)($_SESSION['user_id'] ?? 0))) {
            $allowed = true;
        } elseif (!isLoggedIn() && guest_order_granted($orderId)) {
            $allowed = true;
        } elseif (!isLoggedIn()
            && !empty($_GET['codigo'])
            && !empty($_GET['email'])
            && hash_equals((string)$order['codigo'], (string)$_GET['codigo'])
            && mb_strtolower(trim((string)$order['email_cliente'])) === mb_strtolower(trim((string)$_GET['email']))) {
            $allowed = true;
        }
    }
}
if (!$allowed || !$order) {
    http_response_code(403);
    die('No tiene permiso para ver este comprobante.');
}
$png = gx_order_receipt_png($orderId);
if ($png === null) {
    http_response_code(404);
    die('Pedido no encontrado.');
}
header('Content-Type: image/png');
header('Content-Disposition: inline; filename="comprobante-' . preg_replace('/[^A-Z0-9-]/i', '', (string)$order['codigo']) . '.png"');
header('Cache-Control: private, max-age=3600');
header('X-Content-Type-Options: nosniff');
echo $png;
