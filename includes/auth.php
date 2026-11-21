<?php
/**
 * Compatibilidad hacia atrás: el código heredado incluía este archivo.
 * La implementación real vive en includes/security.php.
 */
require_once __DIR__ . '/security.php';

if (!function_exists('csrfToken')) {
    function csrfToken(): string { return csrf_token(); }
}
if (!function_exists('verifyCsrf')) {
    function verifyCsrf(?string $token = null): bool { return verify_csrf_token($token); }
}
if (!function_exists('generateCode')) {
    /** Código único y atómico, basado en secuencia + timestamp + aleatorio. */
    function generateCode(string $prefix, string $table, string $column = 'codigo'): string
    {
        $allowed = ['ventas', 'tickets', 'pedidos', 'reparaciones', 'compras_proveedor', 'proveedores'];
        if (!in_array($table, $allowed, true)) {
            throw new InvalidArgumentException('Tabla no permitida para generación de código');
        }
        $prefix = preg_replace('/[^A-Z0-9]/i', '', strtoupper($prefix));
        for ($i = 0; $i < 5; $i++) {
            $code = $prefix . '-' . date('ymd') . '-' . strtoupper(substr(random_token(3), 0, 5));
            $stmt = db()->prepare("SELECT 1 FROM $table WHERE $column = ? LIMIT 1");
            $stmt->execute([$code]);
            if (!$stmt->fetch()) {
                return $code;
            }
        }
        throw new RuntimeException('No se pudo generar un código único');
    }
}
