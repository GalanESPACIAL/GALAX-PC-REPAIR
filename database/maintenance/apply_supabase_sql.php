<?php
/**
 * Aplica archivos SQL de PostgreSQL/Supabase usando la conexión PDO del proyecto.
 * Uso:
 *   C:\xampp\php\php.exe database\maintenance\apply_supabase_sql.php database/supabase/001_schema_postgres.sql
 *   C:\xampp\php\php.exe database\maintenance\apply_supabase_sql.php database/supabase/002_seed_postgres.sql database/migrations/005_supabase_page_editor.sql
 */
require_once __DIR__ . '/../../config/database.php';

if (DB_DRIVER !== 'pgsql') {
    fwrite(STDERR, "ERROR: DB_DRIVER no es 'pgsql'. Configura SUPABASE_DB_* en el archivo .env.\n");
    exit(1);
}
$files = array_slice($argv, 1);
if (!$files) {
    fwrite(STDERR, "Uso: php apply_supabase_sql.php <archivo.sql> [archivo2.sql ...]\n");
    exit(1);
}

/** Divide en sentencias respetando comillas, comentarios y bloques $$ ... $$. */
function gx_split_sql(string $sql): array
{
    $statements = [];
    $current = '';
    $length = strlen($sql);
    $quote = null;
    $dollarTag = null;
    $lineComment = false;
    $blockComment = false;

    for ($i = 0; $i < $length; $i++) {
        $ch = $sql[$i];
        $next = $i + 1 < $length ? $sql[$i + 1] : '';

        if ($lineComment) {
            $current .= $ch;
            if ($ch === "\n") {
                $lineComment = false;
            }
            continue;
        }
        if ($blockComment) {
            $current .= $ch;
            if ($ch === '*' && $next === '/') {
                $current .= $next;
                $i++;
                $blockComment = false;
            }
            continue;
        }
        if ($quote === null && $dollarTag === null) {
            if ($ch === '-' && $next === '-') {
                $lineComment = true;
                $current .= $ch . $next;
                $i++;
                continue;
            }
            if ($ch === '/' && $next === '*') {
                $blockComment = true;
                $current .= $ch . $next;
                $i++;
                continue;
            }
            if ($ch === "'") {
                $quote = "'";
            } elseif ($ch === '"') {
                $quote = '"';
            } elseif ($ch === '$' && preg_match('/^\$[A-Za-z0-9_]*\$/', substr($sql, $i), $m)) {
                $dollarTag = $m[0];
                $current .= $dollarTag;
                $i += strlen($dollarTag) - 1;
                continue;
            } elseif ($ch === ';') {
                if (trim($current) !== '') {
                    $statements[] = trim($current);
                }
                $current = '';
                continue;
            }
        } else {
            if ($quote !== null) {
                if ($ch === $quote) {
                    if ($quote === "'" && $next === "'") {
                        $current .= $ch . $next;
                        $i++;
                        continue;
                    }
                    $quote = null;
                }
            } elseif ($dollarTag !== null && str_starts_with(substr($sql, $i), $dollarTag)) {
                $current .= $dollarTag;
                $i += strlen($dollarTag) - 1;
                $dollarTag = null;
                continue;
            }
        }
        $current .= $ch;
    }
    if (trim($current) !== '') {
        $statements[] = trim($current);
    }
    return $statements;
}

$db = db();
$total = 0;
foreach ($files as $file) {
    $path = $file;
    if (!is_file($path)) {
        $path = dirname(__DIR__, 2) . '/' . ltrim($file, '/');
    }
    if (!is_file($path)) {
        fwrite(STDERR, "No existe: $file\n");
        exit(1);
    }
    $sql = file_get_contents($path);
    $statements = gx_split_sql($sql);
    $ok = 0;
    try {
        $db->beginTransaction();
        foreach ($statements as $statement) {
            $db->exec($statement);
            $ok++;
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        fwrite(STDERR, "ERROR en $file: " . $e->getMessage() . "\n");
        exit(1);
    }
    echo basename($path) . ": $ok sentencias ejecutadas\n";
    $total += $ok;
}
echo "TOTAL=$total OK\n";
