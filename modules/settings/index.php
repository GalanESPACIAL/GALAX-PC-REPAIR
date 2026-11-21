<?php
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('configuracion');
$pageTitle = 'Configuración';

$configKeys = [
    'empresa_nombre' => ['label' => 'Nombre de la empresa', 'type' => 'text'],
    'empresa_ruc' => ['label' => 'RUC', 'type' => 'text'],
    'empresa_telefono' => ['label' => 'Teléfono', 'type' => 'text'],
    'empresa_email' => ['label' => 'Correo', 'type' => 'email'],
    'empresa_direccion' => ['label' => 'Dirección', 'type' => 'text'],
    'moneda' => ['label' => 'Moneda', 'type' => 'text'],
    'igv_porcentaje' => ['label' => 'IGV (%)', 'type' => 'number'],
    'site_url' => ['label' => 'URL del sitio', 'type' => 'url'],
    'ai_api_url' => ['label' => 'URL del servicio Airi', 'type' => 'url'],
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $db = db();
    $db->beginTransaction();
    try {
        foreach ($configKeys as $key => $meta) {
            if (!array_key_exists('cfg_' . $key, $_POST)) continue;
            $value = trim((string)$_POST['cfg_' . $key]);
            if ($meta['type'] === 'number') {
                $number = (float)$value;
                if ($number < 0 || $number > 100) throw new RuntimeException('El IGV debe estar entre 0 y 100.');
                $value = (string)$number;
            }
            if ($meta['type'] === 'email' && $value !== '' && !valid_email($value)) throw new RuntimeException('Correo inválido.');
            if ($meta['type'] === 'url' && $value !== '' && !filter_var($value, FILTER_VALIDATE_URL)) throw new RuntimeException('URL inválida en ' . $key . '.');
            $stmt = $db->prepare('INSERT INTO configuracion (clave,valor,descripcion) VALUES (?,?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor)');
            $stmt->execute([$key, $value, $meta['label']]);
        }
        $db->commit();
        audit_log('update_settings', 'configuracion');
        flash('success', 'Configuración guardada correctamente.');
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        error_log('[GALAX][SETTINGS] ' . $e->getMessage());
        flash('error', 'No se pudo guardar: ' . $e->getMessage());
    }
    redirect(BASE_URL . '/modules/settings/index.php');
}

$configs = [];
foreach (db()->query('SELECT clave, valor FROM configuracion')->fetchAll(PDO::FETCH_KEY_PAIR) as $k => $v) {
    $configs[$k] = $v;
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="grid grid-2">
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-gear"></i> Configuración del sistema</div></div>
    <form method="POST">
      <?= csrf_field() ?>
      <?php foreach ($configKeys as $key => $meta): ?>
        <div class="form-group">
          <label class="form-label"><?= h($meta['label']) ?></label>
          <input type="<?= h($meta['type']) ?>" step="any" name="cfg_<?= h($key) ?>" class="form-control" value="<?= h($configs[$key] ?? '') ?>">
        </div>
      <?php endforeach; ?>
      <button class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar configuración</button>
    </form>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-shield-halved"></i> Seguridad y despliegue</div></div>
    <div style="color:var(--muted);font-size:.88rem;line-height:1.7;">
      <p><strong>Sesión:</strong> regeneración de ID, bloqueo tras 5 intentos fallidos y cookie HttpOnly/SameSite.</p>
      <p><strong>Precios:</strong> calculados siempre en el servidor; el navegador solo envía cantidades.</p>
      <p><strong>Airi:</strong> el token del modelo solo existe en el servidor PHP. La URL se configura aquí o en <code>config/config.php</code>.</p>
      <p><strong>Backups:</strong> <code>database/backups/</code> contiene la copia previa a las migraciones.</p>
      <p>Para cambiar <code>site_url</code> en un entorno sin escribir BD, use la variable de entorno <code>GALAX_SITE_URL</code>.</p>
    </div>
  </div>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
