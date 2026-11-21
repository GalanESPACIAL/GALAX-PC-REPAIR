<?php
/**
 * Aplica un archivo SQL respetando bytes UTF-8 y la conexión utf8mb4.
 * Evita la pérdida de acentos que ocurre al canalizar archivos SQL desde
 * PowerShell 5.1 (consola ANSI) directamente al cliente de MySQL.
 *
 * Uso:
 *   C:\xampp\php\php.exe database\maintenance\apply_sql_utf8.php database\migrations\004_repair_utf8_text.sql
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit(1);
}

$file = $argv[1] ?? '';
if ($file === '' || !is_file($file)) {
    fwrite(STDERR, "Uso: php apply_sql_utf8.php <archivo.sql>\n");
    exit(1);
}

require_once dirname(__DIR__, 2) . '/config/database.php';

/** Divide por ';' sin romper literales de cadena, comillas ni comentarios. */
function gx_split_sql(string $sql): array
{
    // Soporta directivas DELIMITER (p. ej. CREATE PROCEDURE ... END$$).
    // Cada bloque delimitado se sustituye por un placeholder opaco para que
    // los ';' internos del cuerpo no se dividan; luego se reexpande.
    $delimited = [];
    $sql = preg_replace_callback(
        '/^[ \t]*DELIMITER[ \t]+(\S+)[ \t\r\n]+(.*?)^[ \t]*DELIMITER[ \t]+;[ \t\r\n]*/ms',
        function (array $m) use (&$delimited): string {
            $delim = $m[1];
            $body = trim($m[2]);
            $parts = array_values(array_filter(array_map('trim', explode($delim, $body))));
            $delimited[] = $parts;
            return '__GX_DELIMITED_' . (count($delimited) - 1) . "__;\n";
        },
        $sql
    ) ?? $sql;
    $sql = preg_replace('/^[ \t]*--[^\r\n]*$/m', '', $sql) ?? $sql;
    $statements = [];
    $buffer = '';
    $quote = null;
    $length = strlen($sql);
    for ($i = 0; $i < $length; $i++) {
        $ch = $sql[$i];
        if ($quote !== null) {
            $buffer .= $ch;
            if ($ch === '\\' && $quote !== '`' && $i + 1 < $length) {
                $buffer .= $sql[++$i];
            } elseif ($ch === $quote) {
                if ($i + 1 < $length && $sql[$i + 1] === $quote) {
                    $buffer .= $sql[++$i];
                } else {
                    $quote = null;
                }
            }
            continue;
        }
        if ($ch === "'" || $ch === '"' || $ch === '`') {
            $quote = $ch;
            $buffer .= $ch;
        } elseif ($ch === ';') {
            $statement = trim($buffer);
            if ($statement !== '') {
                $statements[] = $statement;
            }
            $buffer = '';
        } else {
            $buffer .= $ch;
        }
    }
    $statement = trim($buffer);
    if ($statement !== '') {
        $statements[] = $statement;
    }
    // Reexpande los placeholders de bloques DELIMITER en sus statements reales.
    $expanded = [];
    foreach ($statements as $statement) {
        if (preg_match('/^__GX_DELIMITED_(\d+)__$/', $statement, $m)) {
            foreach ($delimited[(int)$m[1]] as $part) {
                $expanded[] = $part;
            }
        } else {
            $expanded[] = $statement;
        }
    }
    return $expanded;
}

$db = db();
$db->exec('SET NAMES utf8mb4');
$statements = gx_split_sql((string)file_get_contents($file));
$db->beginTransaction();
try {
    foreach ($statements as $statement) {
        $db->exec($statement);
    }
    // El DDL de MySQL confirma de forma implícita; solo se confirma si sigue activa.
    if ($db->inTransaction()) {
        $db->commit();
    }
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, 'Error al aplicar ' . $file . ': ' . $e->getMessage() . "\n");
    exit(1);
}
echo 'APPLIED=' . count($statements) . ' FILE=' . basename($file) . "\n";
