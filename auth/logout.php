<?php
require_once __DIR__ . '/../includes/functions.php';

if (isLoggedIn()) {
    audit_log('logout', 'usuarios', (int)($_SESSION['user_id'] ?? 0));
}
logout();
redirect(BASE_URL . '/shop/index.php');
