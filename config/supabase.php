<?php
/**
 * GALAX PC REPAIR — Cliente Supabase (Auth + Storage + PostgREST).
 *
 * Las credenciales se leen SOLO de variables de entorno (o del archivo .env
 * local, que está excluido del repositorio). La clave service_role nunca se
 * envía al navegador: todas las llamadas de este archivo ocurren en el server.
 */

if (!function_exists('gx_env')) {
    function gx_env(string $key, $default = null)
    {
        $value = getenv($key);
        if ($value !== false && $value !== '') {
            return $value;
        }
        static $fileValues = null;
        if ($fileValues === null) {
            $fileValues = [];
            $path = dirname(__DIR__) . '/.env';
            if (is_file($path)) {
                foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                    $line = trim($line);
                    if ($line === '' || $line[0] === '#') {
                        continue;
                    }
                    [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
                    $fileValues[trim($k)] = trim($v, " \t\r\n\"'");
                }
            }
        }
        return $fileValues[$key] ?? $default;
    }
}

/** Configuración Supabase con valores por defecto seguros. */
function supabase_config(): array
{
    return [
        'url'            => rtrim((string)gx_env('SUPABASE_URL', ''), '/'),
        'anon_key'       => (string)gx_env('SUPABASE_ANON_KEY', ''),
        'service_key'    => (string)gx_env('SUPABASE_SERVICE_ROLE_KEY', ''),
        'db_host'        => (string)gx_env('SUPABASE_DB_HOST', ''),
        'db_port'        => (string)gx_env('SUPABASE_DB_PORT', '6543'),
        'db_name'        => (string)gx_env('SUPABASE_DB_NAME', 'postgres'),
        'db_user'        => (string)gx_env('SUPABASE_DB_USER', 'postgres'),
        'db_pass'        => (string)gx_env('SUPABASE_DB_PASS', ''),
        'storage_bucket' => (string)gx_env('SUPABASE_STORAGE_BUCKET', 'galax-files'),
    ];
}

function supabase_is_configured(): bool
{
    $c = supabase_config();
    return $c['url'] !== '' && $c['service_key'] !== '' && $c['db_host'] !== '';
}

/** Petición HTTP genérica a la API REST de Supabase. */
function supabase_request(string $method, string $path, $payload = null, bool $serviceRole = true, ?string $token = null): array
{
    $cfg = supabase_config();
    if ($cfg['url'] === '') {
        throw new RuntimeException('Supabase no está configurado. Completa el archivo .env (SUPABASE_URL).');
    }
    $key = $serviceRole ? $cfg['service_key'] : $cfg['anon_key'];
    if ($key === '') {
        throw new RuntimeException('Falta la clave de Supabase en el archivo .env.');
    }
    $headers = [
        'apikey: ' . $key,
        'Authorization: Bearer ' . ($token ?: $key),
        'Content-Type: application/json',
        'Accept: application/json',
    ];
    $ch = curl_init($cfg['url'] . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        throw new RuntimeException('Error de conexión con Supabase: ' . $error);
    }
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        $decoded = ['raw' => $body];
    }
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Supabase respondió HTTP ' . $status . ': ' . ($decoded['msg'] ?? $decoded['message'] ?? $body));
    }
    return $decoded;
}

/* --------------------------- Supabase Auth --------------------------- */

function supabase_sign_up(string $email, string $password, array $metadata = []): array
{
    return supabase_request('POST', '/auth/v1/signup', [
        'email'    => $email,
        'password' => $password,
        'data'     => $metadata,
    ], false);
}

function supabase_sign_in(string $email, string $password): array
{
    return supabase_request('POST', '/auth/v1/token?grant_type=password', [
        'email'    => $email,
        'password' => $password,
    ], false);
}

function supabase_recover(string $email): array
{
    return supabase_request('POST', '/auth/v1/recover', [
        'email'    => $email,
        'redirect_to' => rtrim((string)gx_env('GALAX_SITE_URL', ''), '/') . '/auth/login.php',
    ], false);
}

function supabase_user(?string $accessToken): ?array
{
    if (!$accessToken) {
        return null;
    }
    try {
        return supabase_request('GET', '/auth/v1/user', null, false, $accessToken);
    } catch (Throwable $e) {
        return null;
    }
}

function supabase_sign_out(?string $accessToken): void
{
    if (!$accessToken) {
        return;
    }
    try {
        supabase_request('POST', '/auth/v1/logout', null, false, $accessToken);
    } catch (Throwable $e) {
        // El logout local se ejecuta de todas formas.
    }
}

/** Crea un usuario en Supabase Auth (requiere service_role). */
function supabase_admin_create_user(string $email, string $password, array $metadata = []): array
{
    return supabase_request('POST', '/auth/v1/admin/users', [
        'email'           => $email,
        'password'        => $password,
        'email_confirm'   => true,
        'user_metadata'   => $metadata,
    ], true);
}

/** Actualiza un usuario de Supabase Auth (contraseña, metadata, baneo). */
function supabase_admin_update_user(string $uid, array $data): array
{
    return supabase_request('PUT', '/auth/v1/admin/users/' . rawurlencode($uid), $data, true);
}

/* -------------------------- Supabase Storage ------------------------- */

/** Sube un archivo al bucket y devuelve su URL pública. */
function supabase_storage_upload(string $bucket, string $objectPath, string $bytes, string $contentType): string
{
    $cfg = supabase_config();
    $path = '/storage/v1/object/' . rawurlencode($bucket) . '/' . ltrim($objectPath, '/');
    $ch = curl_init($cfg['url'] . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => 'POST',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'apikey: ' . $cfg['service_key'],
            'Authorization: Bearer ' . $cfg['service_key'],
            'Content-Type: ' . $contentType,
            'x-upsert: true',
        ],
        CURLOPT_POSTFIELDS     => $bytes,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        throw new RuntimeException('Error al subir a Supabase Storage: ' . $error);
    }
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Storage respondió HTTP ' . $status . ': ' . $body);
    }
    return $cfg['url'] . '/storage/v1/object/public/' . rawurlencode($bucket) . '/' . ltrim($objectPath, '/');
}

function supabase_storage_remove(string $bucket, string $objectPath): void
{
    supabase_request('DELETE', '/storage/v1/object/' . rawurlencode($bucket) . '/' . ltrim($objectPath, '/'), null, true);
}

function supabase_storage_url(string $bucket, string $objectPath): string
{
    $cfg = supabase_config();
    return $cfg['url'] . '/storage/v1/object/public/' . rawurlencode($bucket) . '/' . ltrim($objectPath, '/');
}
