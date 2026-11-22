<?php
/**
 * Subida de imágenes a Supabase Storage.
 * La base de datos guarda solo la referencia (`supabase:carpeta/archivo.ext`),
 * nunca bytes binarios.
 */
require_once __DIR__ . '/../config/supabase.php';

/** Sube una imagen validada y devuelve la referencia para guardar en BD. */
function upload_supabase_image(array $file, string $folder = 'productos'): ?string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return null;
    }
    if (($file['size'] ?? 0) > MAX_UPLOAD_BYTES) {
        return null;
    }
    if (!is_uploaded_file($file['tmp_name'])) {
        return null;
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $allowed = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];
    if (!isset($allowed[$mime])) {
        return null;
    }
    $folder = preg_replace('/[^a-z0-9_-]/i', '', $folder) ?: 'productos';
    $name = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
    $path = $folder . '/' . $name;
    $bytes = file_get_contents($file['tmp_name']);
    if ($bytes === false) {
        return null;
    }
    supabase_storage_upload(supabase_config()['storage_bucket'], $path, $bytes, $mime);
    return 'supabase:' . $path;
}
