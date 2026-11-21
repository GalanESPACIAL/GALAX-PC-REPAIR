<?php
/**
 * GALAX PC REPAIR — Alta de orden de reparación (panel).
 * El formulario envía POST a save.php, que valida y escribe en MySQL.
 */
require_once __DIR__ . '/../../includes/functions.php';
requirePermission('reparaciones');

$pageTitle = 'Nueva reparación';
$clientes = db()->query('SELECT id, nombre, apellido, email, telefono FROM clientes ORDER BY nombre, apellido')->fetchAll();
$tecnicos = [];
try {
    $tecnicos = db()->query(
        "SELECT u.id, u.nombre, u.apellido
           FROM usuarios u JOIN roles r ON u.rol_id = r.id
          WHERE u.estado = 'activo' AND r.nombre IN ('Técnico','Administrador')
          ORDER BY u.nombre, u.apellido"
    )->fetchAll();
} catch (Throwable $e) {
    $tecnicos = db()->query("SELECT id, nombre, apellido FROM usuarios WHERE estado = 'activo' ORDER BY nombre")->fetchAll();
}
require_once __DIR__ . '/../../includes/header.php';
?>
<div class="card" style="max-width:980px;margin:0 auto;">
  <div class="card-header">
    <div class="card-title"><i class="fa-solid fa-laptop-medical"></i> Registrar orden de reparación</div>
    <a href="<?= BASE_URL ?>/modules/repairs/index.php" class="btn btn-ghost btn-sm"><i class="fa-solid fa-arrow-left"></i> Volver</a>
  </div>
  <p style="color:var(--muted);margin-bottom:20px;">
    El código de orden se genera automáticamente. El presupuesto y la mano de obra podrán ajustarse en el detalle;
    el total se calcula siempre en el servidor.
  </p>

  <form method="POST" action="<?= BASE_URL ?>/modules/repairs/save.php">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="create">

    <div class="form-section-title" style="font-size:1.05rem;font-weight:700;margin:22px 0 14px;display:flex;align-items:center;gap:9px;"><i class="fa-solid fa-user"></i> Cliente</div>
    <div class="grid grid-2">
      <div class="form-group">
        <label class="form-label" for="cliente_id">Cliente registrado</label>
        <select name="cliente_id" id="cliente_id" class="form-control">
          <option value="">-- Cliente nuevo / mostrar en orden --</option>
          <?php foreach ($clientes as $c): ?>
            <option value="<?= (int)$c['id'] ?>" <?= old('cliente_id') == (string)$c['id'] ? 'selected' : '' ?>>
              <?= h(trim($c['nombre'] . ' ' . $c['apellido'])) ?> — <?= h($c['email'] ?: $c['telefono'] ?: 'sin contacto') ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="nombre_cliente">Nombre del cliente *</label>
        <input type="text" name="nombre_cliente" id="nombre_cliente" class="form-control" maxlength="160"
               value="<?= old('nombre_cliente') ?>" placeholder="Nombre y apellido" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="contacto_cliente">Contacto (teléfono o correo)</label>
        <input type="text" name="contacto_cliente" id="contacto_cliente" class="form-control" maxlength="160"
               value="<?= old('contacto_cliente') ?>" placeholder="987654321 / correo@ejemplo.com">
      </div>
      <div class="form-group">
        <label class="form-label" for="tecnico_id">Técnico asignado</label>
        <select name="tecnico_id" id="tecnico_id" class="form-control">
          <option value="">-- Sin asignar --</option>
          <?php foreach ($tecnicos as $t): ?>
            <option value="<?= (int)$t['id'] ?>" <?= old('tecnico_id') == (string)$t['id'] ? 'selected' : '' ?>>
              <?= h(trim($t['nombre'] . ' ' . $t['apellido'])) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>

    <div class="form-section-title" style="font-size:1.05rem;font-weight:700;margin:22px 0 14px;display:flex;align-items:center;gap:9px;"><i class="fa-solid fa-computer"></i> Equipo y problema</div>
    <div class="grid grid-2">
      <div class="form-group">
        <label class="form-label" for="tipo_equipo">Tipo de equipo *</label>
        <input type="text" name="tipo_equipo" id="tipo_equipo" class="form-control" maxlength="100"
               value="<?= old('tipo_equipo') ?>" placeholder="Laptop, desktop, monitor, tablet..." required>
      </div>
      <div class="form-group">
        <label class="form-label" for="marca">Marca</label>
        <input type="text" name="marca" id="marca" class="form-control" maxlength="100" value="<?= old('marca') ?>">
      </div>
      <div class="form-group">
        <label class="form-label" for="modelo">Modelo</label>
        <input type="text" name="modelo" id="modelo" class="form-control" maxlength="100" value="<?= old('modelo') ?>">
      </div>
      <div class="form-group">
        <label class="form-label" for="numero_serie">Número de serie</label>
        <input type="text" name="numero_serie" id="numero_serie" class="form-control" maxlength="120" value="<?= old('numero_serie') ?>">
      </div>
      <div class="form-group">
        <label class="form-label" for="accesorios_recibidos">Accesorios recibidos</label>
        <textarea name="accesorios_recibidos" id="accesorios_recibidos" class="form-control" rows="2"
                  placeholder="Cargador, mochila, mouse, cable HDMI..."><?= old('accesorios_recibidos') ?></textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="estado_fisico">Estado físico del equipo</label>
        <textarea name="estado_fisico" id="estado_fisico" class="form-control" rows="2"
                  placeholder="Golpes, rayaduras, humedad, funcionamiento general..."><?= old('estado_fisico') ?></textarea>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label" for="problema_reportado">Problema reportado *</label>
        <textarea name="problema_reportado" id="problema_reportado" class="form-control" rows="4"
                  placeholder="Describa lo que refiere el cliente y cuándo ocurre." required><?= old('problema_reportado') ?></textarea>
      </div>
    </div>

    <div class="form-section-title" style="font-size:1.05rem;font-weight:700;margin:22px 0 14px;display:flex;align-items:center;gap:9px;"><i class="fa-solid fa-calendar-check"></i> Estimación y presupuesto inicial</div>
    <div class="grid grid-3">
      <div class="form-group">
        <label class="form-label" for="fecha_estimada_entrega">Fecha estimada de entrega</label>
        <input type="date" name="fecha_estimada_entrega" id="fecha_estimada_entrega" class="form-control"
               value="<?= old('fecha_estimada_entrega') ?>">
      </div>
      <div class="form-group">
        <label class="form-label" for="presupuesto">Presupuesto inicial (S/)</label>
        <input type="number" name="presupuesto" id="presupuesto" class="form-control" min="0" step="0.01"
               value="<?= old('presupuesto', '0.00') ?>">
      </div>
      <div class="form-group">
        <label class="form-label" for="garantia">Garantía</label>
        <input type="text" name="garantia" id="garantia" class="form-control" maxlength="120"
               value="<?= old('garantia') ?>" placeholder="Ej.: 30 días por mano de obra">
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label" for="observaciones">Observaciones internas</label>
        <textarea name="observaciones" id="observaciones" class="form-control" rows="2"><?= old('observaciones') ?></textarea>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
      <button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Registrar orden</button>
      <a href="<?= BASE_URL ?>/modules/repairs/index.php" class="btn btn-ghost">Cancelar</a>
    </div>
  </form>
</div>
<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
