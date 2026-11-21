<?php
/**
 * GALAX PC REPAIR — Detalle de una orden de reparación.
 * Personal: ve todas y gestiona estados/datos/repuestos.
 * Cliente: ve sólo la orden vinculada a su registro en `clientes`.
 */
require_once __DIR__ . '/../../includes/functions.php';
requireLogin();

$id = (int)($_GET['id'] ?? 0);
$isStaff = hasPermission('reparaciones');

$stmt = db()->prepare(
    'SELECT r.*,
            c.nombre AS cli_nombre, c.apellido AS cli_apellido,
            c.email AS cli_email, c.telefono AS cli_telefono,
            t.nombre AS tec_nombre, t.apellido AS tec_apellido,
            u.nombre AS usr_nombre, u.apellido AS usr_apellido
       FROM reparaciones r
       LEFT JOIN clientes c ON r.cliente_id = c.id
       LEFT JOIN usuarios t ON r.tecnico_id = t.id
       LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ? LIMIT 1'
);
$stmt->execute([$id]);
$r = $stmt->fetch();

if ($r === false) {
    flash('error', 'La orden de reparación no existe.');
    redirect($isStaff
        ? BASE_URL . '/modules/repairs/index.php'
        : BASE_URL . '/shop/repair_request.php');
}

/* Aislamiento estricto del portal del cliente: 403 si intenta ver ajena. */
if (!$isStaff) {
    $stmt = db()->prepare('SELECT id FROM clientes WHERE usuario_id = ? LIMIT 1');
    $stmt->execute([(int)$_SESSION['user_id']]);
    $clienteId = $stmt->fetchColumn();
    if ($clienteId === false || (int)$r['cliente_id'] !== (int)$clienteId) {
        accessDenied();
    }
}

$estados = [
    'recibido' => 'Recibido', 'pendiente_diagnostico' => 'Pendiente de diagnóstico',
    'en_diagnostico' => 'En diagnóstico', 'presupuesto_enviado' => 'Presupuesto enviado',
    'esperando_aprobacion' => 'Esperando aprobación', 'aprobado' => 'Aprobado',
    'en_reparacion' => 'En reparación', 'esperando_repuestos' => 'Esperando repuestos',
    'en_pruebas' => 'En pruebas', 'reparado' => 'Reparado',
    'listo_para_entregar' => 'Listo para entregar', 'entregado' => 'Entregado',
    'cancelado' => 'Cancelado',
];
$transiciones = [
    'recibido' => ['pendiente_diagnostico', 'en_diagnostico', 'presupuesto_enviado', 'cancelado'],
    'pendiente_diagnostico' => ['en_diagnostico', 'presupuesto_enviado', 'cancelado'],
    'en_diagnostico' => ['presupuesto_enviado', 'esperando_repuestos', 'en_reparacion', 'cancelado'],
    'presupuesto_enviado' => ['esperando_aprobacion', 'aprobado', 'cancelado'],
    'esperando_aprobacion' => ['aprobado', 'cancelado'],
    'aprobado' => ['en_reparacion', 'esperando_repuestos', 'cancelado'],
    'en_reparacion' => ['esperando_repuestos', 'en_pruebas', 'cancelado'],
    'esperando_repuestos' => ['en_reparacion', 'cancelado'],
    'en_pruebas' => ['reparado', 'en_reparacion', 'cancelado'],
    'reparado' => ['listo_para_entregar', 'en_pruebas'],
    'listo_para_entregar' => ['entregado'],
    'entregado' => [], 'cancelado' => [],
];
$permitidos = $transiciones[(string)$r['estado']] ?? [];
$puedeEditar = $isStaff && !in_array($r['estado'], ['entregado', 'cancelado'], true);
$puedeResponder = !$isStaff && in_array($r['estado'], ['presupuesto_enviado', 'esperando_aprobacion'], true);

$stmt = db()->prepare(
    'SELECT h.*, u.nombre AS usr_nombre, u.apellido AS usr_apellido
       FROM reparacion_historial h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.reparacion_id = ?
      ORDER BY h.creado_en ASC, h.id ASC'
);
$stmt->execute([$id]);
$historial = $stmt->fetchAll();

$stmt = db()->prepare('SELECT * FROM reparacion_repuestos WHERE reparacion_id = ? ORDER BY id ASC');
$stmt->execute([$id]);
$repuestos = $stmt->fetchAll();

$productos = db()->query(
    "SELECT id, codigo, nombre, precio_venta, stock
       FROM productos WHERE estado = 'activo' ORDER BY nombre"
)->fetchAll();
$tecnicos = db()->query(
    "SELECT id, nombre, apellido FROM usuarios WHERE estado = 'activo' ORDER BY nombre"
)->fetchAll();

$pageTitle = 'Reparación ' . $r['codigo'];
if ($isStaff) {
    require_once __DIR__ . '/../../includes/header.php';
} else {
    $activeNav = 'reparacion';
    require_once __DIR__ . '/../../includes/store_header.php';
}
?>
<div class="card" style="margin-bottom:18px;">
  <div class="card-header">
    <div>
      <div class="card-title"><i class="fa-solid fa-laptop-medical"></i> Orden <?= h($r['codigo']) ?></div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <?= badgeEstado($r['estado']) ?>
        <?php if ((int)$r['aprobacion_cliente'] === 1): ?>
          <span class="badge badge-success">Presupuesto aprobado</span>
        <?php elseif ($r['estado'] === 'cancelado'): ?>
          <span class="badge badge-danger">Presupuesto rechazado</span>
        <?php else: ?>
          <span class="badge badge-warning">Aprobación pendiente</span>
        <?php endif; ?>
        <span class="chip"><i class="fa-regular fa-calendar"></i> Recibido: <?= h(fecha($r['fecha_recepcion'])) ?></span>
        <?php if ($r['fecha_estimada_entrega']): ?>
          <span class="chip"><i class="fa-regular fa-clock"></i> Entrega estimada: <?= h(fecha_corta($r['fecha_estimada_entrega'])) ?></span>
        <?php endif; ?>
        <?php if ($r['fecha_entrega']): ?>
          <span class="chip"><i class="fa-solid fa-check"></i> Entregado: <?= h(fecha($r['fecha_entrega'])) ?></span>
        <?php endif; ?>
      </div>
    </div>
    <a class="btn btn-ghost btn-sm" href="<?= BASE_URL ?>/<?= $isStaff ? 'modules/repairs/index.php' : 'shop/repair_request.php' ?>">
      <i class="fa-solid fa-arrow-left"></i> <?= $isStaff ? 'Volver al listado' : 'Mis reparaciones' ?>
    </a>
  </div>

  <div class="grid grid-2">
    <div>
      <h4 style="margin-bottom:10px;"><i class="fa-solid fa-user" style="color:var(--primary);"></i> Cliente</h4>
      <p><strong><?= h($r['cli_nombre'] ? trim($r['cli_nombre'] . ' ' . $r['cli_apellido']) : $r['nombre_cliente']) ?></strong></p>
      <p style="color:var(--muted);">
        Contacto: <?= h($r['contacto_cliente'] ?: ($r['cli_email'] ?: ($r['cli_telefono'] ?: '-'))) ?><br>
        Registrado por: <?= h(trim((string)($r['usr_nombre'] ?? '') . ' ' . (string)($r['usr_apellido'] ?? ''))) ?: 'Sistema' ?>
      </p>
    </div>
    <div>
      <h4 style="margin-bottom:10px;"><i class="fa-solid fa-computer" style="color:var(--primary);"></i> Equipo</h4>
      <p><strong><?= h($r['tipo_equipo']) ?></strong>
        <?= $r['marca'] ? ' · ' . h($r['marca']) : '' ?>
        <?= $r['modelo'] ? ' ' . h($r['modelo']) : '' ?></p>
      <p style="color:var(--muted);">
        Serie: <?= h($r['numero_serie'] ?: '-') ?><br>
        Técnico: <?= h($r['tec_nombre'] ? trim($r['tec_nombre'] . ' ' . $r['tec_apellido']) : 'Sin asignar') ?>
      </p>
    </div>
  </div>

  <div class="grid grid-2" style="margin-top:18px;">
    <div>
      <h4 style="margin-bottom:8px;">Problema reportado</h4>
      <p style="white-space:pre-wrap;color:var(--muted);"><?= h($r['problema_reportado']) ?></p>
    </div>
    <div>
      <h4 style="margin-bottom:8px;">Diagnóstico</h4>
      <p style="white-space:pre-wrap;color:var(--muted);"><?= h($r['diagnostico'] ?: 'Pendiente de diagnóstico.') ?></p>
    </div>
    <?php if ($r['accesorios_recibidos'] || $r['estado_fisico']): ?>
      <div>
        <h4 style="margin-bottom:8px;">Accesorios recibidos</h4>
        <p style="white-space:pre-wrap;color:var(--muted);"><?= h($r['accesorios_recibidos'] ?: '-') ?></p>
      </div>
      <div>
        <h4 style="margin-bottom:8px;">Estado físico</h4>
        <p style="white-space:pre-wrap;color:var(--muted);"><?= h($r['estado_fisico'] ?: '-') ?></p>
      </div>
    <?php endif; ?>
  </div>
</div>

<div class="grid grid-2">
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-file-invoice-dollar"></i> Presupuesto y costos</div></div>
    <div class="summary-row"><span>Presupuesto aprobado / enviado</span><strong><?= h(money($r['presupuesto'])) ?></strong></div>
    <div class="summary-row"><span>Mano de obra</span><span><?= h(money($r['mano_obra'])) ?></span></div>
    <div class="summary-row"><span>Repuestos (<?= count($repuestos) ?>)</span><span><?= h(money($r['costo_repuestos'])) ?></span></div>
    <div class="summary-row" style="border-top:1px solid var(--border);margin-top:8px;padding-top:12px;">
      <strong>Total calculado</strong><strong style="font-size:1.25rem;"><?= h(money($r['costo_total'])) ?></strong>
    </div>
    <p style="color:var(--muted);font-size:.8rem;margin-top:10px;">
      Garantía: <?= h($r['garantia'] ?: 'No registrada') ?>
    </p>
    <?php if ($r['observaciones'] && $isStaff): ?>
      <p style="color:var(--muted);white-space:pre-wrap;margin-top:10px;">Observaciones: <?= h($r['observaciones']) ?></p>
    <?php endif; ?>

    <?php if ($puedeResponder): ?>
      <div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px;">
        <h4 style="margin-bottom:8px;">Responder presupuesto</h4>
        <p style="color:var(--muted);font-size:.85rem;margin-bottom:12px;">
          Si aprueba, la orden continuará con la reparación. Si rechaza, la orden se cancelará.
        </p>
        <form method="POST" action="<?= BASE_URL ?>/modules/repairs/save.php" style="display:flex;gap:10px;flex-wrap:wrap;">
          <?= csrf_field() ?>
          <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
          <button class="btn btn-success" type="submit" name="action" value="approve">
            <i class="fa-solid fa-check"></i> Aprobar presupuesto
          </button>
          <button class="btn btn-danger" type="submit" name="action" value="reject">
            <i class="fa-solid fa-xmark"></i> Rechazar
          </button>
        </form>
      </div>
    <?php endif; ?>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> Historial</div></div>
    <?php if (!$historial): ?>
      <p style="color:var(--muted);">Sin movimientos registrados.</p>
    <?php else: ?>
      <ul class="status-timeline">
        <?php foreach ($historial as $h): ?>
          <li class="done">
            <strong><?= h($estados[$h['estado']] ?? ucfirst(str_replace('_', ' ', $h['estado']))) ?></strong>
            <small><?= h(fecha($h['creado_en'])) ?></small>
            <?php if ($h['nota']): ?><p style="color:var(--muted);font-size:.85rem;margin-top:5px;white-space:pre-wrap;"><?= h($h['nota']) ?></p><?php endif; ?>
            <?php if ($h['usr_nombre']): ?>
              <small>Por <?= h(trim($h['usr_nombre'] . ' ' . $h['usr_apellido'])) ?></small>
            <?php endif; ?>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </div>
</div>

<div class="card" style="margin-top:18px;">
  <div class="card-header"><div class="card-title"><i class="fa-solid fa-screwdriver"></i> Repuestos utilizados</div></div>
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Repuesto</th><th>Cantidad</th><th>Precio unit.</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>
        <?php if (!$repuestos): ?>
          <tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px;">Sin repuestos registrados.</td></tr>
        <?php else: foreach ($repuestos as $rep): ?>
          <tr>
            <td><?= h($rep['nombre']) ?></td>
            <td><?= (int)$rep['cantidad'] ?></td>
            <td><?= h(money($rep['precio_unitario'])) ?></td>
            <td><strong><?= h(money($rep['subtotal'])) ?></strong></td>
            <td>
              <?php if ($puedeEditar): ?>
                <form method="POST" action="<?= BASE_URL ?>/modules/repairs/save.php" onsubmit="return confirm('¿Quitar este repuesto y devolver el stock?');">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="remove_part">
                  <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
                  <input type="hidden" name="item_id" value="<?= (int)$rep['id'] ?>">
                  <button class="btn btn-danger btn-sm" type="submit"><i class="fa-solid fa-trash"></i></button>
                </form>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>

  <?php if ($puedeEditar): ?>
    <form method="POST" action="<?= BASE_URL ?>/modules/repairs/save.php" style="margin-top:18px;">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="add_part">
      <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
      <div class="grid grid-2">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="producto_id">Agregar repuesto del catálogo</label>
          <select name="producto_id" id="producto_id" class="form-control" required>
            <option value="">-- Seleccione un producto --</option>
            <?php foreach ($productos as $p): ?>
              <option value="<?= (int)$p['id'] ?>" <?= (int)$p['stock'] < 1 ? 'disabled' : '' ?>>
                <?= h($p['nombre']) ?> (<?= h($p['codigo']) ?>) — stock: <?= (int)$p['stock'] ?> — <?= h(money($p['precio_venta'])) ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="cantidad">Cantidad</label>
          <div style="display:flex;gap:10px;">
            <input type="number" name="cantidad" id="cantidad" class="form-control" min="1" max="9999" value="1" required>
            <button class="btn btn-primary" type="submit"><i class="fa-solid fa-plus"></i> Agregar</button>
          </div>
        </div>
      </div>
    </form>
    <p style="color:var(--muted);font-size:.8rem;margin-top:10px;">
      El precio se toma del catálogo en el servidor; el stock se descuenta de forma atómica y se registra en inventario.
    </p>
  <?php endif; ?>
</div>

<?php if ($isStaff): ?>
<div class="grid grid-2" style="margin-top:18px;">
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-sliders"></i> Datos técnicos</div></div>
    <?php if ($puedeEditar): ?>
      <form method="POST" action="<?= BASE_URL ?>/modules/repairs/save.php">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="update_details">
        <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
        <div class="form-group">
          <label class="form-label" for="diagnostico">Diagnóstico</label>
          <textarea name="diagnostico" id="diagnostico" class="form-control" rows="3"><?= h($r['diagnostico']) ?></textarea>
        </div>
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label" for="presupuesto">Presupuesto (S/)</label>
            <input type="number" name="presupuesto" id="presupuesto" class="form-control" min="0" step="0.01"
                   value="<?= number_format((float)$r['presupuesto'], 2, '.', '') ?>">
          </div>
          <div class="form-group">
            <label class="form-label" for="mano_obra">Mano de obra (S/)</label>
            <input type="number" name="mano_obra" id="mano_obra" class="form-control" min="0" step="0.01"
                   value="<?= number_format((float)$r['mano_obra'], 2, '.', '') ?>">
          </div>
          <div class="form-group">
            <label class="form-label" for="tecnico_id">Técnico</label>
            <select name="tecnico_id" id="tecnico_id" class="form-control">
              <option value="">-- Sin asignar --</option>
              <?php foreach ($tecnicos as $t): ?>
                <option value="<?= (int)$t['id'] ?>" <?= (int)$r['tecnico_id'] === (int)$t['id'] ? 'selected' : '' ?>>
                  <?= h(trim($t['nombre'] . ' ' . $t['apellido'])) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="fecha_estimada_entrega">Entrega estimada</label>
            <input type="date" name="fecha_estimada_entrega" id="fecha_estimada_entrega" class="form-control"
                   value="<?= h($r['fecha_estimada_entrega']) ?>">
          </div>
          <div class="form-group">
            <label class="form-label" for="garantia">Garantía</label>
            <input type="text" name="garantia" id="garantia" class="form-control" maxlength="120" value="<?= h($r['garantia']) ?>">
          </div>
          <div class="form-group">
            <label class="form-label" for="estado_fisico">Estado físico</label>
            <input type="text" name="estado_fisico" id="estado_fisico" class="form-control" value="<?= h($r['estado_fisico']) ?>">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="observaciones">Observaciones</label>
          <textarea name="observaciones" id="observaciones" class="form-control" rows="2"><?= h($r['observaciones']) ?></textarea>
        </div>
        <button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Guardar datos técnicos</button>
      </form>
    <?php else: ?>
      <p style="color:var(--muted);">La orden está finalizada; sus datos técnicos son de solo lectura.</p>
    <?php endif; ?>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fa-solid fa-arrow-right-arrow-left"></i> Cambiar estado</div></div>
    <?php if ($permitidos): ?>
      <form method="POST" action="<?= BASE_URL ?>/modules/repairs/save.php">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="update_status">
        <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
        <div class="form-group">
          <label class="form-label" for="estado">Nuevo estado</label>
          <select name="estado" id="estado" class="form-control" required>
            <?php foreach ($permitidos as $est): ?>
              <option value="<?= h($est) ?>"><?= h($estados[$est] ?? $est) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="nota">Nota del cambio (opcional)</label>
          <textarea name="nota" id="nota" class="form-control" rows="3" placeholder="Detalle técnico de este avance..."></textarea>
        </div>
        <button class="btn btn-success" type="submit"><i class="fa-solid fa-check"></i> Aplicar cambio de estado</button>
      </form>
      <p style="color:var(--muted);font-size:.8rem;margin-top:12px;">
        Sólo se muestran las transiciones válidas desde «<?= h($estados[(string)$r['estado']] ?? $r['estado']) ?>».
        Cada cambio queda en el historial y en la bitácora de auditoría.
      </p>
    <?php else: ?>
      <p style="color:var(--muted);">Esta orden se encuentra en un estado final: no hay transiciones disponibles.</p>
    <?php endif; ?>
  </div>
</div>
<?php endif; ?>

<?php
if ($isStaff) {
    require_once __DIR__ . '/../../includes/footer.php';
} else {
    require_once __DIR__ . '/../../includes/store_footer.php';
}
