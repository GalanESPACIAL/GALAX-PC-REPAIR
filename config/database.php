<?php
/**
 * GALAX PC REPAIR — Configuración central.
 *
 * Todas las opciones pueden sobreescribirse mediante variables de entorno
 * (útil para XAMPP, Docker o un servidor de producción). No se almacenan
 * secretos en el repositorio.
 */

if (!function_exists('env')) {
    function env(string $key, $default = null) {
        $value = getenv($key);
        if ($value === false || $value === '') {
            return $default;
        }
        return $value;
    }
}

require_once __DIR__ . '/supabase.php';

// Supabase (PostgreSQL) es el destino preferente. Si no hay host configurado
// se mantiene el modo MySQL local para desarrollo/migración gradual.
$gxSupabaseCfg = supabase_config();
$gxUseSupabase = $gxSupabaseCfg['db_host'] !== '';

define('DB_DRIVER', $gxUseSupabase ? 'pgsql' : 'mysql');
define('DB_HOST', $gxUseSupabase ? $gxSupabaseCfg['db_host'] : env('GALAX_DB_HOST', 'localhost'));
define('DB_PORT', $gxUseSupabase ? $gxSupabaseCfg['db_port'] : '3306');
define('DB_NAME', $gxUseSupabase ? $gxSupabaseCfg['db_name'] : env('GALAX_DB_NAME', 'ventas_informatica'));
define('DB_USER', $gxUseSupabase ? $gxSupabaseCfg['db_user'] : env('GALAX_DB_USER', 'root'));
define('DB_PASS', $gxUseSupabase ? $gxSupabaseCfg['db_pass'] : env('GALAX_DB_PASS', ''));
define('DB_CHARSET', 'utf8mb4');

define('SITE_NAME', env('GALAX_SITE_NAME', 'GALAX PC REPAIR'));
define('BASE_URL', rtrim(env('GALAX_SITE_URL', 'http://localhost/galax_pc_repair'), '/'));
// SITE_URL se conserva por compatibilidad con el código existente.
define('SITE_URL', BASE_URL);
define('BASE_PATH', dirname(__DIR__));

define('UPLOAD_DIR', BASE_PATH . '/assets/uploads');
define('MAX_UPLOAD_BYTES', 2 * 1024 * 1024);

date_default_timezone_set(env('GALAX_TIMEZONE', 'America/Lima'));

if (!is_dir(UPLOAD_DIR)) {
    @mkdir(UPLOAD_DIR, 0755, true);
}

class Database
{
    private static ?Database $instance = null;
    private PDO $pdo;

    private function __construct()
    {
        if (DB_DRIVER === 'pgsql') {
            $dsn = 'pgsql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';sslmode=require';
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
        } else {
            $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_STRINGIFY_FETCHES  => false,
            ];
        }
        try {
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
            $this->pdo->exec(DB_DRIVER === 'pgsql' ? "SET TIME ZONE 'UTC'" : "SET time_zone = '+00:00'");
        } catch (PDOException $e) {
            error_log('[GALAX][DB] ' . $e->getMessage());
            http_response_code(500);
            die('No fue posible conectar con la base de datos. Consulte el registro de errores del servidor.');
        }
    }

    public static function getInstance(): Database
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection(): PDO
    {
        return $this->pdo;
    }
}

function db(): PDO
{
    return Database::getInstance()->getConnection();
}

/** Lee un valor de la tabla de configuración (con caché por petición). */
function config_value(string $key, $default = null)
{
    static $cache = [];
    if (!array_key_exists($key, $cache)) {
        try {
            $stmt = db()->prepare('SELECT valor FROM configuracion WHERE clave = ? LIMIT 1');
            $stmt->execute([$key]);
            $row = $stmt->fetch();
            $cache[$key] = $row === false ? $default : $row['valor'];
        } catch (Throwable $e) {
            $cache[$key] = $default;
        }
    }
    return $cache[$key];
}

/** Configuración pública de la empresa, con valores seguros por defecto. */
function company_info(): array
{
    return [
        'nombre'    => config_value('empresa_nombre', SITE_NAME),
        'ruc'       => config_value('empresa_ruc', ''),
        'direccion' => config_value('empresa_direccion', ''),
        'telefono'  => config_value('empresa_telefono', ''),
        'email'     => config_value('empresa_email', ''),
        'whatsapp'  => config_value('whatsapp_numero', ''),
        'moneda'    => config_value('moneda', 'S/'),
        'igv'       => (float)config_value('igv_porcentaje', 18),
    ];
}
