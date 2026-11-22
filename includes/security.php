<?php
/**
 * GALAX PC REPAIR — Capa de seguridad y control de acceso.
 * Todas las operaciones sensibles se verifican en el servidor.
 */

require_once __DIR__ . '/../config/database.php';

if (session_status() === PHP_SESSION_NONE) {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_name('GALAXSESSID');
    session_start();
}

/** Cabeceras de seguridad enviadas antes de cualquier salida. */
function security_headers(): void
{
    if (headers_sent()) {
        return;
    }
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header("Content-Security-Policy: default-src 'self' https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src 'self' https: blob:; frame-ancestors 'self'");
    header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
}
security_headers();

/* ------------------------------------------------------------------ */
/* Utilidades básicas                                                  */
/* ------------------------------------------------------------------ */

function h($value): string
{
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function redirect(string $url): void
{
    header('Location: ' . $url);
    exit;
}

function flash(string $key, $message = null)
{
    if ($message === null) {
        $value = $_SESSION['flash'][$key] ?? null;
        unset($_SESSION['flash'][$key]);
        return $value;
    }
    $_SESSION['flash'][$key] = $message;
    return null;
}

function old(string $key, $default = '')
{
    return h($_SESSION['old'][$key] ?? $default);
}

function set_old(array $data): void
{
    $_SESSION['old'] = $data;
}

function clear_old(): void
{
    unset($_SESSION['old']);
}

function random_token(int $bytes = 32): string
{
    return bin2hex(random_bytes($bytes));
}

function uuid4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/* ------------------------------------------------------------------ */
/* CSRF                                                                */
/* ------------------------------------------------------------------ */

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = random_token();
    }
    return $_SESSION['csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . h(csrf_token()) . '">';
}

function verify_csrf_token(?string $token = null): bool
{
    if ($token === null) {
        $token = $_POST['csrf_token']
            ?? $_GET['csrf_token']
            ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null);
    }
    return is_string($token)
        && !empty($_SESSION['csrf_token'])
        && hash_equals($_SESSION['csrf_token'], $token);
}

/** Detiene la petición si el token CSRF no es válido. */
function require_csrf(?string $token = null): void
{
    if (!verify_csrf_token($token)) {
        http_response_code(419);
        die('Solicitud rechazada: token de seguridad inválido o expirado. Recargue la página e inténtelo de nuevo.');
    }
}

/* ------------------------------------------------------------------ */
/* Autenticación y permisos                                            */
/* ------------------------------------------------------------------ */

function isLoggedIn(): bool
{
    return isset($_SESSION['user_id']) && (int)$_SESSION['user_id'] > 0;
}

function currentUser(): ?array
{
    if (!isLoggedIn()) {
        return null;
    }
    static $user = null;
    if ($user === null) {
        $stmt = db()->prepare(
            'SELECT u.*, r.nombre AS rol_nombre, r.descripcion AS rol_descripcion
               FROM usuarios u JOIN roles r ON u.rol_id = r.id
              WHERE u.id = ? LIMIT 1'
        );
        $stmt->execute([(int)$_SESSION['user_id']]);
        $found = $stmt->fetch();
        $user = $found === false ? null : $found;
    }
    return $user;
}

function currentRole(): string
{
    $user = currentUser();
    return $user['rol_nombre'] ?? 'Invitado';
}

function isAdmin(): bool
{
    return currentRole() === 'Administrador';
}

function isStaff(): bool
{
    return in_array(currentRole(), ['Administrador', 'Empleado', 'Técnico', 'Vendedor', 'Soporte'], true);
}

/** Permisos efectivos: tabla relacional si existe, con fallback al CSV histórico. */
function effectivePermissions(): array
{
    static $perms = null;
    if ($perms !== null) {
        return $perms;
    }
    $user = currentUser();
    if (!$user) {
        return $perms = [];
    }
    if (isAdmin()) {
        return $perms = ['*'];
    }
    $items = [];
    try {
        $stmt = db()->prepare(
            'SELECT p.codigo FROM rol_permiso rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = ?'
        );
        $stmt->execute([(int)$user['rol_id']]);
        $items = $stmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
        // Esquema anterior: se respeta el campo CSV sin romper el acceso.
        $items = array_filter(array_map('trim', explode(',', (string)($user['permisos'] ?? ''))));
    }
    if (!$items) {
        $items = array_filter(array_map('trim', explode(',', (string)($user['permisos'] ?? ''))));
    }
    return $perms = array_values(array_unique($items));
}

function hasPermission(string $permission): bool
{
    if (!isLoggedIn()) {
        return false;
    }
    $perms = effectivePermissions();
    return in_array('*', $perms, true) || in_array($permission, $perms, true);
}

function hasAnyPermission(array $permissions): bool
{
    foreach ($permissions as $permission) {
        if (hasPermission($permission)) {
            return true;
        }
    }
    return false;
}

function requireLogin(): void
{
    if (!isLoggedIn()) {
        flash('error', 'Debe iniciar sesión para continuar.');
        redirect(BASE_URL . '/auth/login.php');
    }
}

function requirePermission(string $permission): void
{
    requireLogin();
    if (!hasPermission($permission)) {
        accessDenied();
    }
}

function requireAnyPermission(array $permissions): void
{
    requireLogin();
    if (!hasAnyPermission($permissions)) {
        accessDenied();
    }
}

function requireRole(string ...$roles): void
{
    requireLogin();
    if (!in_array(currentRole(), $roles, true) && !isAdmin()) {
        accessDenied();
    }
}

function accessDenied(): void
{
    http_response_code(403);
    $pageTitle = 'Acceso denegado';
    if (!defined('GALAX_NO_LAYOUT')) {
        require_once __DIR__ . '/header.php';
    }
    echo '<div class="card"><h2><i class="fa-solid fa-lock"></i> Acceso denegado</h2>'
        . '<p style="color:var(--muted);margin-top:10px;">Su cuenta no tiene permisos para realizar esta operación.</p></div>';
    if (!defined('GALAX_NO_LAYOUT')) {
        require_once __DIR__ . '/footer.php';
    }
    exit;
}

/** Registro de acciones administrativas (tabla creada en migración 001). */
function audit_log(string $action, string $entity, $entityId = null, ?string $details = null): void
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO audit_log (usuario_id, accion, entidad, entidad_id, detalles, ip, created_at)
             VALUES (?,?,?,?,?,?,NOW())'
        );
        $stmt->execute([
            $_SESSION['user_id'] ?? null,
            mb_substr($action, 0, 60),
            mb_substr($entity, 0, 60),
            $entityId === null ? null : (string)$entityId,
            $details === null ? null : mb_substr($details, 0, 1000),
            client_ip_hash(),
        ]);
    } catch (Throwable $e) {
        // La auditoría nunca debe impedir una operación válida.
        error_log('[GALAX][AUDIT] ' . $e->getMessage());
    }
}

function client_ip_hash(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return substr(hash('sha256', $ip . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 24);
}

/** Control de intentos de acceso basado en sesión (5 intentos / 15 min). */
function login_attempts(string $email, bool $failed = false): array
{
    $key = '_login_attempts_' . hash('sha256', mb_strtolower($email));
    $state = $_SESSION[$key] ?? ['count' => 0, 'first' => time(), 'until' => 0];
    if (($state['until'] ?? 0) > time()) {
        return $state;
    }
    if ($failed) {
        $state['count'] = ($state['count'] ?? 0) + 1;
        $state['first'] = $state['first'] ?? time();
        if ($state['count'] >= 5) {
            $state['until'] = time() + 15 * 60;
            $state['count'] = 0;
        }
    } else {
        $state = ['count' => 0, 'first' => time(), 'until' => 0];
    }
    $_SESSION[$key] = $state;
    return $state;
}

function is_login_locked(string $email): bool
{
    $state = login_attempts($email);
    return ($state['until'] ?? 0) > time();
}

/**
 * Busca (o crea) el usuario local vinculado a un uid de Supabase Auth.
 * El usuario local conserva rol/permisos usados por todos los módulos.
 */
function supabase_local_user(array $authUser, string $accessToken = ''): ?int
{
    $uid = (string)($authUser['id'] ?? '');
    if ($uid === '') {
        return null;
    }
    $db = db();
    $stmt = $db->prepare('SELECT id FROM usuarios WHERE supabase_uid = ? LIMIT 1');
    $stmt->execute([$uid]);
    $found = $stmt->fetch();
    if ($found !== false) {
        return (int)$found['id'];
    }
    $email = mb_strtolower(trim((string)($authUser['email'] ?? '')));
    $meta = is_array($authUser['user_metadata'] ?? null) ? $authUser['user_metadata'] : [];
    $nombre = trim((string)($meta['nombre'] ?? $meta['nombre_completo'] ?? explode('@', $email)[0]));
    $apellido = trim((string)($meta['apellido'] ?? ''));
    if ($nombre === '') {
        $nombre = 'Cliente';
    }
    try {
        $db->beginTransaction();
        $stmt = $db->prepare(
            'INSERT INTO usuarios (nombre, apellido, email, password, telefono, avatar, rol_id, estado, supabase_uid)
             VALUES (?,?,?,?,?,?,4,\'activo\',?)'
        );
        $stmt->execute([
            mb_substr($nombre, 0, 100),
            mb_substr($apellido, 0, 100),
            $email,
            password_hash(random_token(24), PASSWORD_DEFAULT),
            '',
            'neutro',
            $uid,
        ]);
        $localId = (int)$db->lastInsertId();
        $stmt = $db->prepare('INSERT INTO clientes (nombre, apellido, email, telefono, usuario_id) VALUES (?,?,?,?,?)');
        $stmt->execute([mb_substr($nombre, 0, 100), mb_substr($apellido, 0, 100), $email, '', $localId]);
        $db->commit();
        return $localId;
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        // Si otra petición creó el usuario entre tanto, lo reutilizamos.
        $stmt = $db->prepare('SELECT id FROM usuarios WHERE supabase_uid = ? LIMIT 1');
        $stmt->execute([$uid]);
        $found = $stmt->fetch();
        return $found === false ? null : (int)$found['id'];
    }
}

function login(string $email, string $password): bool
{
    $email = mb_strtolower(trim($email));
    if (is_login_locked($email)) {
        return false;
    }
    if (supabase_is_configured()) {
        try {
            $auth = supabase_sign_in($email, $password);
            $authUser = is_array($auth['user'] ?? null) ? $auth['user'] : [];
            $localId = supabase_local_user($authUser, (string)($auth['access_token'] ?? ''));
            if ($localId === null) {
                throw new RuntimeException('No se pudo vincular el perfil local.');
            }
            session_regenerate_id(true);
            $_SESSION['user_id']             = $localId;
            $_SESSION['user_email']          = $email;
            $_SESSION['supabase_uid']        = (string)($authUser['id'] ?? '');
            $_SESSION['supabase_access']     = (string)($auth['access_token'] ?? '');
            $_SESSION['supabase_refresh']    = (string)($auth['refresh_token'] ?? '');
            unset($_SESSION['csrf_token'], $_SESSION['_ai_messages'], $_SESSION['_cart_undo']);
            csrf_token();
            login_attempts($email, false);
            audit_log('login_supabase', 'usuarios', $localId, 'Inicio de sesión con Supabase Auth');
            return true;
        } catch (Throwable $e) {
            login_attempts($email, true);
            audit_log('login_failed', 'usuarios', null, 'Error Supabase para ' . $email . ': ' . mb_substr($e->getMessage(), 0, 160));
            return false;
        }
    }
    $stmt = db()->prepare('SELECT * FROM usuarios WHERE email = ? AND estado = \'activo\' LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password'])) {
        login_attempts($email, true);
        audit_log('login_failed', 'usuarios', null, 'Intento fallido para ' . $email);
        return false;
    }
    if (password_needs_rehash($user['password'], PASSWORD_DEFAULT)) {
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        db()->prepare('UPDATE usuarios SET password = ? WHERE id = ?')->execute([$newHash, $user['id']]);
    }
    session_regenerate_id(true);
    $_SESSION['user_id']   = (int)$user['id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role']  = (int)$user['rol_id'];
    unset($_SESSION['csrf_token'], $_SESSION['_ai_messages'], $_SESSION['_cart_undo']);
    csrf_token();
    login_attempts($email, false);
    db()->prepare('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?')->execute([$user['id']]);
    audit_log('login', 'usuarios', $user['id'], 'Inicio de sesión correcto');
    return true;
}

function logout(): void
{
    if (isLoggedIn()) {
        audit_log('logout', 'usuarios', $_SESSION['user_id']);
    }
    if (function_exists('supabase_sign_out')) {
        supabase_sign_out($_SESSION['supabase_access'] ?? null);
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    redirect(BASE_URL . '/auth/login.php');
}

/* ------------------------------------------------------------------ */
/* Avatares (rutas fijas y validadas)                                  */
/* ------------------------------------------------------------------ */

const AVATAR_FILES = [
    'administrador' => 'modules/users/avatar ico/Administrador.png',
    'mujer'         => 'modules/users/avatar ico/mujer.png',
    'hombre'        => 'modules/users/avatar ico/hombre.png',
];

function avatar_candidates(): array
{
    return array_keys(AVATAR_FILES);
}

function normalize_avatar(?string $avatar): string
{
    $value = mb_strtolower(trim((string)$avatar));
    $aliases = [
        'admin' => 'administrador', 'administrator' => 'administrador', 'administradora' => 'mujer',
        'femenino' => 'mujer', 'femenina' => 'mujer', 'female' => 'mujer', 'woman' => 'mujer',
        'masculino' => 'hombre', 'masculina' => 'hombre', 'male' => 'hombre', 'man' => 'hombre',
    ];
    $value = $aliases[$value] ?? $value;
    return isset(AVATAR_FILES[$value]) ? $value : 'neutro';
}

function avatar_url($user = null, ?string $assistant = null): string
{
    if ($assistant) {
        return BASE_URL . '/assets/img/sanara-avatar.svg';
    }
    if (!$user) {
        return BASE_URL . '/assets/img/neutral-avatar.svg';
    }
    $role = is_array($user) ? ($user['rol_nombre'] ?? '') : '';
    if ($role === 'Administrador') {
        return BASE_URL . '/' . AVATAR_FILES['administrador'];
    }
    $avatar = is_array($user) ? ($user['avatar'] ?? null) : null;
    $key = normalize_avatar($avatar);
    if ($key === 'neutro') {
        return BASE_URL . '/assets/img/neutral-avatar.svg';
    }
    return BASE_URL . '/' . AVATAR_FILES[$key];
}

/** Valida y mueve una imagen subida; devuelve la clave de avatar normalizada. */
function handle_avatar_upload(array $file): ?string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return null;
    }
    if (($file['size'] ?? 0) > MAX_UPLOAD_BYTES) {
        return null;
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $allowed = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];
    if (!isset($allowed[$mime])) {
        return null;
    }
    $name = random_token(12) . '.' . $allowed[$mime];
    if (!move_uploaded_file($file['tmp_name'], UPLOAD_DIR . '/' . $name)) {
        return null;
    }
    return 'upload:' . $name;
}

function avatar_url_from_stored(?string $stored): string
{
    $stored = (string)$stored;
    if (str_starts_with($stored, 'upload:')) {
        $name = substr($stored, 7);
        if (preg_match('/^[a-f0-9]{24}\.(png|jpg|webp)$/', $name)) {
            return BASE_URL . '/assets/uploads/' . rawurlencode($name);
        }
        return BASE_URL . '/assets/img/neutral-avatar.svg';
    }
    return avatar_url(['avatar' => $stored]);
}

/* ------------------------------------------------------------------ */
/* Validación y respuestas API                                         */
/* ------------------------------------------------------------------ */

function valid_email(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false && mb_strlen($email) <= 254;
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function api_error(string $message, int $status = 400, array $extra = []): void
{
    json_response(array_merge(['ok' => false, 'error' => $message], $extra), $status);
}

function safe_int($value, int $min = PHP_INT_MIN, int $max = PHP_INT_MAX): int
{
    return max($min, min($max, (int)$value));
}

function money_format_local($amount, ?string $currency = null): string
{
    $currency = $currency ?? config_value('moneda', 'S/');
    return $currency . ' ' . number_format((float)$amount, 2, '.', ',');
}
