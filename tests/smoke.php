<?php
/**
 * GALAX PC REPAIR — Prueba de humo HTTP.
 *
 * Uso:
 *   C:\xampp\php\php.exe tests\smoke.php http://127.0.0.1:8000
 *
 * Requiere el servidor PHP en marcha (php -S o Apache) y la BD migrada.
 * No modifica datos: solo GET públicos y health checks.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit(1);
}

$base = rtrim($argv[1] ?? 'http://127.0.0.1:8000', '/');
$fail = 0;
$pass = 0;

function gx_get(string $url): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $type = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);
    return ['code' => $code, 'body' => (string)$body, 'type' => $type];
}

function check(string $name, bool $ok, string $detail = ''): void
{
    global $pass, $fail;
    if ($ok) {
        $pass++;
        echo "PASS  $name" . ($detail !== '' ? "  ($detail)" : '') . "\n";
    } else {
        $fail++;
        echo "FAIL  $name" . ($detail !== '' ? "  ($detail)" : '') . "\n";
    }
}

/* --- Rutas públicas de la tienda (deben ser 200) --- */
$public = [
    '/shop/index.php',
    '/shop/catalog.php',
    '/shop/catalog.php?q=ssd',
    '/shop/catalog.php?cat=1',
    '/shop/catalog.php?orden=precio_asc',
    '/shop/product.php?id=1',
    '/shop/cart.php',
    '/auth/login.php',
    '/api/ai.php?health=1',
];
foreach ($public as $path) {
    $r = gx_get($base . $path);
    check("GET $path", $r['code'] === 200, "HTTP {$r['code']}");
}

/* --- Rutas protegidas sin sesión (deben redirigir 302 a login) --- */
$protected = [
    '/dashboard/index.php',
    '/shop/portal.php',
    '/shop/repair_request.php',
    '/modules/products/index.php',
    '/modules/repairs/index.php',
    '/modules/inventory/index.php',
    '/modules/reports/index.php',
    '/modules/orders/index.php',
];
foreach ($protected as $path) {
    $r = gx_get($base . $path);
    check("GET $path (sin sesión)", $r['code'] === 302, "HTTP {$r['code']}");
}

/* --- Contenido mínimo de la home --- */
$r = gx_get($base . '/shop/index.php');
check('Home contiene marca', str_contains($r['body'], 'GALAX'));
check('Home sin errores PHP', !str_contains($r['body'], 'Fatal error') && !str_contains($r['body'], 'Parse error'));

/* --- Catálogo devuelve productos reales --- */
$r = gx_get($base . '/shop/catalog.php');
check('Catálogo lista productos', str_contains($r['body'], 'LAP-') || str_contains($r['body'], 'producto-card') || str_contains($r['body'], 'S/'));

/* --- Búsqueda del catálogo (regresión HY093) --- */
$r = gx_get($base . '/shop/catalog.php?q=ssd');
check('Búsqueda ?q=ssd sin error SQL', $r['code'] === 200 && !str_contains($r['body'], 'Fatal error') && !str_contains($r['body'], 'HY093'));

/* --- Health del servicio IA (puede estar unavailable; nunca debe romper) --- */
$r = gx_get($base . '/api/ai.php?health=1');
$health = json_decode($r['body'], true);
check('AI health responde JSON', $r['code'] === 200 && is_array($health) && isset($health['ready']));

echo "\n== RESULTADO: $pass PASS / $fail FAIL ==\n";
exit($fail > 0 ? 1 : 0);
