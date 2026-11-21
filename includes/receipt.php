<?php
/**
 * Generador de comprobantes PNG sin dependencias (GD no está habilitado).
 * PNG truecolor + zlib + tipografía bitmap 5x7 embebida.
 */
require_once __DIR__ . '/security.php';

const GX_FONT = [
    'A' => ['01110','10001','10001','11111','10001','10001','10001'],
    'B' => ['11110','10001','10001','11110','10001','10001','11110'],
    'C' => ['01111','10000','10000','10000','10000','10000','01111'],
    'D' => ['11110','10001','10001','10001','10001','10001','11110'],
    'E' => ['11111','10000','10000','11110','10000','10000','11111'],
    'F' => ['11111','10000','10000','11110','10000','10000','10000'],
    'G' => ['01111','10000','10000','10111','10001','10001','01111'],
    'H' => ['10001','10001','10001','11111','10001','10001','10001'],
    'I' => ['11111','00100','00100','00100','00100','00100','11111'],
    'J' => ['00111','00010','00010','00010','10010','10010','01100'],
    'K' => ['10001','10010','10100','11000','10100','10010','10001'],
    'L' => ['10000','10000','10000','10000','10000','10000','11111'],
    'M' => ['10001','11011','10101','10101','10001','10001','10001'],
    'N' => ['10001','11001','10101','10011','10001','10001','10001'],
    'O' => ['01110','10001','10001','10001','10001','10001','01110'],
    'P' => ['11110','10001','10001','11110','10000','10000','10000'],
    'Q' => ['01110','10001','10001','10001','10101','10010','01101'],
    'R' => ['11110','10001','10001','11110','10100','10010','10001'],
    'S' => ['01111','10000','10000','01110','00001','00001','11110'],
    'T' => ['11111','00100','00100','00100','00100','00100','00100'],
    'U' => ['10001','10001','10001','10001','10001','10001','01110'],
    'V' => ['10001','10001','10001','10001','10001','01010','00100'],
    'W' => ['10001','10001','10001','10101','10101','11011','10001'],
    'X' => ['10001','10001','01010','00100','01010','10001','10001'],
    'Y' => ['10001','10001','01010','00100','00100','00100','00100'],
    'Z' => ['11111','00001','00010','00100','01000','10000','11111'],
    '0' => ['01110','10011','10101','10101','10101','11001','01110'],
    '1' => ['00100','01100','00100','00100','00100','00100','01110'],
    '2' => ['01110','10001','00001','00010','00100','01000','11111'],
    '3' => ['11110','00001','00001','01110','00001','00001','11110'],
    '4' => ['00010','00110','01010','10010','11111','00010','00010'],
    '5' => ['11111','10000','10000','11110','00001','00001','11110'],
    '6' => ['00110','01000','10000','11110','10001','10001','01110'],
    '7' => ['11111','00001','00010','00100','01000','01000','01000'],
    '8' => ['01110','10001','10001','01110','10001','10001','01110'],
    '9' => ['01110','10001','10001','01111','00001','00010','01100'],
    '.' => ['00000','00000','00000','00000','00000','01100','01100'],
    ',' => ['00000','00000','00000','00000','01100','00100','01000'],
    ':' => ['00000','01100','01100','00000','01100','01100','00000'],
    '-' => ['00000','00000','00000','11111','00000','00000','00000'],
    '/' => ['00001','00010','00010','00100','01000','01000','10000'],
    '(' => ['00010','00100','01000','01000','01000','00100','00010'],
    ')' => ['01000','00100','00010','00010','00010','00100','01000'],
    '#' => ['01010','01010','11111','01010','11111','01010','01010'],
    '%' => ['11001','11010','00010','00100','01000','01011','10011'],
    '+' => ['00000','00100','00100','11111','00100','00100','00000'],
    '=' => ['00000','00000','11111','00000','11111','00000','00000'],
    '?' => ['01110','10001','00001','00010','00100','00000','00100'],
    '!' => ['00100','00100','00100','00100','00100','00000','00100'],
    ' ' => ['00000','00000','00000','00000','00000','00000','00000'],
];

class GxCanvas
{
    private int $width;
    private int $height;
    private string $pixels;

    public function __construct(int $width, int $height, array $color = [255, 255, 255])
    {
        $this->width = max(1, $width);
        $this->height = max(1, $height);
        $this->pixels = str_repeat(pack('C3', ...$color), $this->width * $this->height);
    }

    public function rect(int $x, int $y, int $w, int $h, array $color): void
    {
        $row = pack('C3', ...$color);
        for ($yy = max(0, $y); $yy < min($this->height, $y + $h); $yy++) {
            $offset = ($yy * $this->width + max(0, $x)) * 3;
            $length = min($w, $this->width - max(0, $x)) * 3;
            if ($length > 0) {
                $this->pixels = substr_replace($this->pixels, str_repeat($row, (int)($length / 3)), $offset, $length);
            }
        }
    }

    public function text(string $text, int $x, int $y, array $color, int $scale = 1, int $maxWidth = 0): void
    {
        $text = gx_receipt_ascii($text);
        $cursor = $x;
        $limit = $maxWidth > 0 ? $x + $maxWidth : $this->width - 2;
        for ($i = 0; $i < mb_strlen($text, 'UTF-8'); $i++) {
            $char = mb_substr($text, $i, 1, 'UTF-8');
            $glyph = GX_FONT[$char] ?? GX_FONT['?'];
            if ($cursor + 6 * $scale > $limit) {
                break;
            }
            foreach ($glyph as $rowIndex => $bits) {
                for ($col = 0; $col < 5; $col++) {
                    if ($bits[$col] === '1') {
                        $this->rect($cursor + $col * $scale, $y + $rowIndex * $scale, $scale, $scale, $color);
                    }
                }
            }
            $cursor += 6 * $scale;
        }
    }

    public function center(string $text, int $y, array $color, int $scale = 1): void
    {
        $len = mb_strlen(gx_receipt_ascii($text), 'UTF-8') * 6 * $scale - $scale;
        $this->text($text, max(2, (int)(($this->width - $len) / 2)), $y, $color, $scale);
    }

    public function barcode(string $code, int $x, int $y, int $width, int $height): void
    {
        $dark = [12, 18, 38];
        $cursor = $x;
        $bytes = unpack('C*', md5($code));
        foreach ($bytes as $byte) {
            for ($bit = 7; $bit >= 0; $bit--) {
                $w = (($byte >> $bit) & 1) ? 3 : 1;
                if ($cursor + $w > $x + $width) {
                    return;
                }
                if ((($byte >> $bit) & 1)) {
                    $this->rect($cursor, $y, $w, $height, $dark);
                }
                $cursor += $w + 1;
            }
        }
    }

    public function toPng(): string
    {
        $raw = '';
        for ($y = 0; $y < $this->height; $y++) {
            $raw .= chr(0) . substr($this->pixels, $y * $this->width * 3, $this->width * 3);
        }
        $png = "\x89PNG\r\n\x1a\n";
        $png .= gx_png_chunk('IHDR', pack('NNCCCCC', $this->width, $this->height, 8, 2, 0, 0, 0));
        $png .= gx_png_chunk('IDAT', gzcompress($raw, 9));
        $png .= gx_png_chunk('IEND', '');
        return $png;
    }
}

function gx_png_chunk(string $type, string $data): string
{
    return pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
}

function gx_receipt_ascii(string $text): string
{
    $map = [
        'á' => 'A', 'à' => 'A', 'ä' => 'A', 'ã' => 'A', 'â' => 'A',
        'é' => 'E', 'è' => 'E', 'ë' => 'E', 'ê' => 'E',
        'í' => 'I', 'ì' => 'I', 'ï' => 'I', 'î' => 'I',
        'ó' => 'O', 'ò' => 'O', 'ö' => 'O', 'õ' => 'O', 'ô' => 'O',
        'ú' => 'U', 'ù' => 'U', 'ü' => 'U', 'û' => 'U',
        'ñ' => 'N', 'ç' => 'C', '°' => 'o', '•' => '-', '—' => '-', '·' => '.',
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ñ' => 'N',
    ];
    $text = strtr($text, $map);
    $text = preg_replace('/[^\x20-\x7E]/', '?', $text) ?? '';
    return mb_strtoupper($text, 'UTF-8');
}

/** Genera el PNG del comprobante de un pedido. Devuelve null si no existe. */
function gx_order_receipt_png(int $orderId): ?string
{
    $stmt = db()->prepare('SELECT * FROM pedidos WHERE id=? LIMIT 1');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();
    if (!$order) {
        return null;
    }
    $detailsStmt = db()->prepare('SELECT * FROM pedido_detalles WHERE pedido_id=? ORDER BY id');
    $detailsStmt->execute([$orderId]);
    $details = $detailsStmt->fetchAll();

    $company = company_info();
    $width = 640;
    $height = 760 + count($details) * 26;
    $canvas = new GxCanvas($width, $height);
    $navy = [9, 16, 38];
    $muted = [90, 104, 133];
    $accent = [79, 70, 229];
    $light = [238, 242, 255];

    $canvas->rect(0, 0, $width, 118, $navy);
    $canvas->rect(0, 114, $width, 4, $accent);
    $canvas->center(gx_receipt_ascii($company['nombre']), 26, [255, 255, 255], 2);
    $canvas->center('COMPROBANTE DE PEDIDO', 62, [165, 180, 252], 1);
    $canvas->center('VENTA Y REPARACION DE EQUIPOS', 82, $muted, 1);

    $canvas->text('PEDIDO:', 36, 140, $muted, 1);
    $canvas->text((string)$order['codigo'], 120, 140, $navy, 1);
    $canvas->text('FECHA:', 36, 160, $muted, 1);
    $canvas->text(date('d/m/Y H:i', strtotime($order['creado_en'])), 120, 160, $navy, 1);
    $canvas->text('ESTADO:', 36, 180, $muted, 1);
    $canvas->text(mb_strtoupper($order['estado']), 120, 180, $accent, 1);

    $canvas->rect(36, 208, $width - 72, 1, [214, 220, 235]);
    $canvas->text('CLIENTE', 36, 222, $accent, 1);
    $canvas->text((string)$order['nombre_cliente'], 36, 242, $navy, 1, $width - 72);
    if ($order['documento']) {
        $canvas->text('DOC: ' . $order['documento'], 36, 262, $muted, 1);
    }
    $canvas->text('CORREO: ' . $order['email_cliente'], 36, 282, $muted, 1, $width - 72);
    $canvas->text('TELEFONO: ' . $order['telefono_cliente'], 36, 302, $muted, 1);
    $canvas->text('ENTREGA: ' . mb_strtoupper($order['metodo_entrega']), 36, 322, $muted, 1);
    $canvas->text('PAGO: ' . mb_strtoupper($order['metodo_pago']), 320, 322, $muted, 1);

    $y = 356;
    $canvas->rect(36, $y, $width - 72, 26, $navy);
    $canvas->text('DESCRIPCION', 46, $y + 8, [255,255,255], 1);
    $canvas->text('CANT', 392, $y + 8, [255,255,255], 1);
    $canvas->text('P. UNIT', 448, $y + 8, [255,255,255], 1);
    $canvas->text('SUBTOTAL', 530, $y + 8, [255,255,255], 1);
    $y += 30;
    foreach ($details as $d) {
        $canvas->text($d['nombre_producto'], 46, $y + 4, $navy, 1, 330);
        $canvas->text((string)$d['cantidad'], 400, $y + 4, $navy, 1);
        $canvas->text(number_format((float)$d['precio_unitario'], 2), 448, $y + 4, $navy, 1);
        $canvas->text(number_format((float)$d['subtotal'], 2), 530, $y + 4, $navy, 1);
        $canvas->rect(36, $y + 20, $width - 72, 1, [226, 232, 242]);
        $y += 26;
    }
    $y += 12;
    $canvas->rect(340, $y, $width - 376, 1, [214, 220, 235]);
    $canvas->text('SUBTOTAL', 380, $y + 12, $muted, 1);
    $canvas->text(number_format((float)$order['subtotal'], 2), 520, $y + 12, $navy, 1);
    $y += 24;
    if ((float)$order['descuento'] > 0) {
        $canvas->text('DESCUENTO', 380, $y + 12, $muted, 1);
        $canvas->text('-' . number_format((float)$order['descuento'], 2), 520, $y + 12, [16,185,129], 1);
        $y += 24;
    }
    $canvas->text('IMPUESTOS', 380, $y + 12, $muted, 1);
    $canvas->text(number_format((float)$order['impuestos'], 2), 520, $y + 12, $navy, 1);
    $y += 24;
    $canvas->text('ENVIO', 380, $y + 12, $muted, 1);
    $canvas->text(number_format((float)$order['envio'], 2), 520, $y + 12, $navy, 1);
    $y += 34;
    $canvas->rect(340, $y, $width - 376, 34, $light);
    $canvas->text('TOTAL', 380, $y + 11, $navy, 1);
    $canvas->text(number_format((float)$order['total'], 2), 500, $y + 9, $accent, 2);
    $y += 58;

    if (!empty($order['direccion'])) {
        $canvas->text('DIRECCION: ' . $order['direccion'], 36, $y, $muted, 1, $width - 72);
        $y += 22;
    }
    if (!empty($order['notas'])) {
        $canvas->text('NOTAS: ' . $order['notas'], 36, $y, $muted, 1, $width - 72);
        $y += 22;
    }

    $canvas->rect(36, $height - 112, $width - 72, 1, [214, 220, 235]);
    $canvas->text('GRACIAS POR CONFIAR EN NOSOTROS', 36, $height - 94, $navy, 1);
    if ($company['telefono']) {
        $canvas->text('TEL: ' . $company['telefono'], 36, $height - 74, $muted, 1);
    }
    if ($company['direccion']) {
        $canvas->text(gx_receipt_ascii($company['direccion']), 36, $height - 56, $muted, 1, $width - 72);
    }
    $canvas->barcode((string)$order['codigo'], 36, $height - 40, 300, 28);
    return $canvas->toPng();
}
