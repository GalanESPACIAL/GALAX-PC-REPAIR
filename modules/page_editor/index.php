<?php
/**
 * GALAX PC REPAIR — Editor de página web.
 * Todos los textos, banners, secciones y enlaces se guardan en `configuracion`.
 * Solo personal con permiso `configuracion` puede modificarlos.
 */
require_once __DIR__ . '/../../includes/repository.php';
require_once __DIR__ . '/../../includes/uploads.php';
requirePermission('configuracion');
$pageTitle = 'Editor de página web';

$WHATSAPP_DEFAULT = 'https://chat.whatsapp.com/I7Syor85Jia6lfE6oIJ7tX?s=sh&p=a&iam=2//de';

$fields = [
    'Inicio y banner' => [
        'hero_eyebrow'        => ['Etiqueta superior', 'text'],
        'hero_title'          => ['Título principal', 'text'],
        'hero_highlight'      => ['Palabra destacada', 'text'],
        'hero_text'           => ['Texto descriptivo', 'textarea'],
        'hero_primary_text'   => ['Texto del botón principal', 'text'],
        'hero_primary_url'    => ['Enlace del botón principal', 'text'],
        'hero_secondary_text' => ['Texto del botón secundario', 'text'],
        'hero_secondary_url'  => ['Enlace del botón secundario', 'text'],
        'banner_image'        => ['Imagen del banner (Supabase Storage)', 'image'],
        'banner_title'        => ['Título del banner', 'text'],
        'banner_text'         => ['Texto del banner', 'textarea'],
        'banner_button_text'  => ['Texto del botón del banner', 'text'],
        'banner_url'          => ['Enlace del banner', 'text'],
    ],
    'Secciones visibles' => [
        'section_categorias_visible' => ['Mostrar categorías (1/0)', 'text'],
        'section_destacados_visible' => ['Mostrar destacados (1/0)', 'text'],
        'section_ofertas_visible'    => ['Mostrar ofertas (1/0)', 'text'],
        'section_servicios_visible'  => ['Mostrar servicios (1/0)', 'text'],
        'section_whatsapp_visible'   => ['Mostrar WhatsApp (1/0)', 'text'],
        'section_tesis_visible'      => ['Mostrar sección del proyecto (1/0)', 'text'],
    ],
    'Ofertas y promociones' => [
        'ofertas_title' => ['Título de ofertas', 'text'],
        'ofertas_text'  => ['Descripción de ofertas', 'textarea'],
    ],
    'Comunidad' => [
        'whatsapp_title' => ['Título de la invitación', 'text'],
        'whatsapp_text'  => ['Texto de la invitación', 'textarea'],
        'whatsapp_url'   => ['Enlace del grupo de WhatsApp', 'text'],
    ],
    'Sobre el proyecto' => [
        'tesis_intro'               => ['Introducción', 'textarea'],
        'tesis_objetivo'            => ['Objetivo general', 'textarea'],
        'tesis_objetivos_especificos'=> ['Objetivos específicos', 'textarea'],
        'tesis_descripcion'         => ['Descripción de la plataforma', 'textarea'],
        'tesis_tecnologias'         => ['Tecnologías utilizadas', 'textarea'],
        'tesis_conclusion'          => ['Conclusión', 'textarea'],
        'tesis_autor'               => ['Autor', 'text'],
    ],
    'Pie de página' => [
        'eslogan'           => ['Eslogan', 'text'],
        'empresa_direccion' => ['Dirección', 'text'],
        'empresa_telefono'  => ['Teléfono', 'text'],
        'empresa_email'     => ['Correo', 'text'],
    ],
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $db = db();
    $stmt = $db->prepare('INSERT INTO configuracion (clave, valor, descripcion) VALUES (?,?,?) ON CONFLICT (clave) DO UPDATE SET valor=EXCLUDED.valor');
    $count = 0;
    try {
        $db->beginTransaction();
        foreach ($fields as $group => $items) {
            foreach ($items as $key => $def) {
                if (!array_key_exists($key, $_POST)) {
                    continue;
                }
                $value = trim((string)$_POST[$key]);
                if ($def[1] === 'image' && !empty($_FILES[$key]['name'])) {
                    $subida = upload_supabase_image($_FILES[$key], 'banners');
                    if ($subida !== null) {
                        $value = $subida;
                    }
                }
                if ($key === 'whatsapp_url' && $value === '') {
                    $value = $WHATSAPP_DEFAULT;
                }
                $stmt->execute([$key, $value, $group . ' — ' . $def[0]]);
                $count++;
            }
        }
        $db->commit();
        audit_log('page_editor_update', 'configuracion', null, 'Se actualizaron ' . $count . ' valores');
        flash('success', 'Contenido actualizado correctamente (' . $count . ' campos). La tienda ya muestra los cambios.');
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        flash('error', 'No se pudo guardar: ' . mb_substr($e->getMessage(), 0, 160));
    }
    redirect(BASE_URL . '/modules/page_editor/index.php');
}

require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card" style="margin-bottom:18px;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-pen-ruler"></i> Editor de página web</div>
    <a class="btn btn-ghost btn-sm" href="<?= BASE_URL ?>/shop/index.php" target="_blank" rel="noopener"><i class="fa-solid fa-eye"></i> Ver tienda</a>
  </div>
  <p style="color:var(--muted);">Modifique títulos, textos, imágenes, secciones y enlaces. Los cambios se reflejan de inmediato en la tienda pública sin editar archivos de código.</p>
</div>
<form method="POST" enctype="multipart/form-data">
  <?= csrf_field() ?>
  <?php foreach ($fields as $group => $items): ?>
  <div class="card" style="margin-bottom:18px;">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-layer-group"></i> <?= h($group) ?></div></div>
    <div class="grid grid-2">
      <?php foreach ($items as $key => $def): ?>
        <?php $value = config_value($key, $key === 'whatsapp_url' ? $WHATSAPP_DEFAULT : ''); ?>
        <div class="form-group" <?= $def[1] === 'textarea' ? 'style="grid-column:1/-1;"' : '' ?>>
          <label class="form-label"><?= h($def[0]) ?></label>
          <?php if ($def[1] === 'textarea'): ?>
            <textarea name="<?= h($key) ?>" class="form-control" rows="3"><?= h($value) ?></textarea>
          <?php elseif ($def[1] === 'image'): ?>
            <?php if ($value !== ''): ?><img src="<?= h(product_image_url($value)) ?>" alt="Vista previa" style="max-height:100px;border-radius:8px;margin-bottom:8px;display:block;"><?php endif; ?>
            <input type="file" name="<?= h($key) ?>" accept="image/png,image/jpeg,image/webp" class="form-control" style="margin-bottom:6px;">
            <input type="text" name="<?= h($key) ?>" class="form-control" value="<?= h($value) ?>" placeholder="supabase:banners/… o https://…">
          <?php else: ?>
            <input type="text" name="<?= h($key) ?>" class="form-control" value="<?= h($value) ?>">
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
  <?php endforeach; ?>
  <button type="submit" class="btn btn-primary btn-lg"><i class="fa-solid fa-floppy-disk"></i> Guardar cambios</button>
</form>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
