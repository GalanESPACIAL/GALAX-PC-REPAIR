<?php
/**
 * GALAX PC REPAIR — Solicitud pública de reparación (cliente autenticado).
 * El cliente sólo puede consultar las órdenes vinculadas a su registro.
 */
require_once __DIR__ . '/../includes/repository.php';
requireLogin();

$pageTitle = 'Solicitar reparación';
$activeNav = 'reparacion';
$errors = [];

/* Cliente vinculado al usuario: se crea una ficha mínima si aún no existe. */
$stmt = db()->prepare('SELECT * FROM clientes WHERE usuario_id = ? LIMIT 1');
$stmt->execute([(int)$_SESSION['user_id']]);
$cliente = $stmt->fetch();
if ($cliente === false) {
    $usuario = currentUser();
    if ($usuario) {
        $stmt = db()->prepare(
            'INSERT INTO clientes (nombre, apellido, email, telefono, direccion, usuario_id)
             VALUES (?,?,?,?,?,?)'
        );
        $stmt->execute([
            mb_substr((string)$usuario['nombre'], 0, 100),
            mb_substr((string)$usuario['apellido'], 0, 100),
            mb_substr((string)$usuario['email'], 0, 150) ?: null,
            mb_substr((string)($usuario['telefono'] ?? ''), 0, 20) ?: null,
            mb_substr((string)($usuario['direccion'] ?? ''), 0, 255) ?: null,
            (int)$_SESSION['user_id'],
        ]);
        $stmt = db()->prepare('SELECT * FROM clientes WHERE id = ? LIMIT 1');
        $stmt->execute([(int)db()->lastInsertId()]);
        $cliente = $stmt->fetch();
        audit_log('cliente_autoregistro', 'clientes', $cliente['id'] ?? null, 'Desde solicitud de reparación');
    }
}
$clienteId = $cliente === false ? null : (int)$cliente['id'];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    require_csrf();

    $tipo = trim((string)($_POST['tipo_equipo'] ?? ''));
    $marca = trim((string)($_POST['marca'] ?? ''));
    $modelo = trim((string)($_POST['modelo'] ?? ''));
    $serie = trim((string)($_POST['numero_serie'] ?? ''));
    $accesorios = trim((string)($_POST['accesorios_recibidos'] ?? ''));
    $fisico = trim((string)($_POST['estado_fisico'] ?? ''));
    $problema = trim((string)($_POST['problema_reportado'] ?? ''));

    if ($tipo === '') {
        $errors[] = 'Indique el tipo de equipo.';
    }
    if ($problema === '') {
        $errors[] = 'Describa el problema reportado.';
    }
    if (mb_strlen($tipo) > 100) {
        $errors[] = 'El tipo de equipo es demasiado largo.';
    }
    if ($clienteId === null) {
        $errors[] = 'No se pudo asociar su cuenta con un cliente. Comuníquese con atención al cliente.';
    }

    if (!$errors) {
        $db = db();
        $db->beginTransaction();
        try {
            $codigo = generateCode('REP', 'reparaciones');
            $nombreCliente = trim($cliente['nombre'] . ' ' . $cliente['apellido']);
            $contacto = trim((string)($cliente['email'] ?: $cliente['telefono']));
            $stmt = $db->prepare(
                'INSERT INTO reparaciones
                 (codigo, cliente_id, usuario_id, nombre_cliente, contacto_cliente, tipo_equipo, marca, modelo,
                  numero_serie, accesorios_recibidos, estado_fisico, problema_reportado, diagnostico, presupuesto,
                  aprobacion_cliente, tecnico_id, fecha_recepcion, fecha_estimada_entrega, mano_obra,
                  costo_repuestos, costo_total, garantia, observaciones, estado)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,0,0,NULL,NOW(),NULL,0,0,0,NULL,?,\'recibido\')'
            );
            $stmt->execute([
                $codigo, $clienteId, (int)$_SESSION['user_id'], mb_substr($nombreCliente, 0, 160),
                mb_substr($contacto, 0, 160) ?: null, mb_substr($tipo, 0, 100),
                mb_substr($marca, 0, 100) ?: null, mb_substr($modelo, 0, 100) ?: null,
                mb_substr($serie, 0, 120) ?: null, $accesorios ?: null, $fisico ?: null,
                $problema, 'Solicitud enviada desde la tienda web.',
            ]);
            $nuevoId = (int)$db->lastInsertId();
            $stmt = $db->prepare(
                'INSERT INTO reparacion_historial (reparacion_id, estado, nota, usuario_id) VALUES (?,?,?,?)'
            );
            $stmt->execute([$nuevoId, 'recibido', 'Solicitud de reparación recibida desde la tienda web.', (int)$_SESSION['user_id']]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('[GALAX][REPARACIONES][PUBLIC] ' . $e->getMessage());
            $errors[] = 'No se pudo registrar la solicitud. Intente nuevamente.';
        }
    }

    if (!$errors) {
        audit_log('reparacion_solicitud', 'reparaciones', $nuevoId ?? null, $codigo . ' | ' . $tipo);
        flash('success', 'Solicitud registrada con código ' . $codigo . '. Puede seguir su estado aquí.');
        redirect(BASE_URL . '/modules/repairs/view.php?id=' . $nuevoId);
    }
}

/* Sólo las suyas: filtro estricto por clientes.usuario_id. */
$misReparaciones = [];
if ($clienteId !== null) {
    $stmt = db()->prepare(
        'SELECT id, codigo, tipo_equipo, marca, modelo, estado, presupuesto, costo_total,
                fecha_recepcion, fecha_estimada_entrega
           FROM reparaciones WHERE cliente_id = ?
          ORDER BY creado_en DESC, id DESC LIMIT 25'
    );
    $stmt->execute([$clienteId]);
    $misReparaciones = $stmt->fetchAll();
}

require_once __DIR__ . '/../includes/store_header.php';
?>
<section class="section" style="margin-top:10px;">
  <div class="section-head">
    <div>
      <span class="eyebrow">Servicio técnico</span>
      <h2>Solicitar reparación</h2>
      <p>Registre su equipo y describa la falla. Le asignaremos un código para hacer seguimiento.</p>
    </div>
  </div>

  <div class="portal-layout">
    <aside class="portal-nav">
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;"><i class="fa-solid fa-circle-info"></i> Cómo funciona</div>
        <ol style="color:var(--gx-muted);font-size:.85rem;line-height:1.9;padding-left:18px;">
          <li>Registramos su equipo y problema.</li>
          <li>Nuestro técnico realiza el diagnóstico.</li>
          <li>Recibirá un presupuesto para aprobar o rechazar.</li>
          <li>Reparamos, probamos y entregamos con garantía.</li>
        </ol>
        <p style="color:var(--gx-muted);font-size:.8rem;margin-top:12px;">
          El presupuesto y el total se calculan en el servidor; nunca se solicitan pagos por este formulario.
        </p>
      </div>
    </aside>

    <div>
      <div class="card" style="margin-bottom:18px;">
        <div class="card-header"><div class="card-title"><i class="fa-solid fa-laptop-medical"></i> Datos de la solicitud</div></div>
        <?php if ($errors): ?>
          <div class="alert alert-danger"><i class="fa-solid fa-circle-xmark"></i>
            <?= h(implode(' ', $errors)) ?>
          </div>
        <?php endif; ?>
        <form method="POST" class="store-form">
          <?= csrf_field() ?>
          <div class="form-section-title"><i class="fa-solid fa-computer"></i> Equipo</div>
          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label" for="tipo_equipo">Tipo de equipo *</label>
              <input type="text" id="tipo_equipo" name="tipo_equipo" class="form-control" maxlength="100"
                     value="<?= h($_POST['tipo_equipo'] ?? '') ?>" placeholder="Laptop, PC, monitor..." required>
            </div>
            <div class="form-group">
              <label class="form-label" for="marca">Marca</label>
              <input type="text" id="marca" name="marca" class="form-control" maxlength="100" value="<?= h($_POST['marca'] ?? '') ?>">
            </div>
            <div class="form-group">
              <label class="form-label" for="modelo">Modelo</label>
              <input type="text" id="modelo" name="modelo" class="form-control" maxlength="100" value="<?= h($_POST['modelo'] ?? '') ?>">
            </div>
            <div class="form-group">
              <label class="form-label" for="numero_serie">Número de serie</label>
              <input type="text" id="numero_serie" name="numero_serie" class="form-control" maxlength="120" value="<?= h($_POST['numero_serie'] ?? '') ?>">
            </div>
            <div class="form-group">
              <label class="form-label" for="accesorios_recibidos">Accesorios que entrega</label>
              <textarea id="accesorios_recibidos" name="accesorios_recibidos" class="form-control" rows="2"
                        placeholder="Cargador, funda, mouse..."><?= h($_POST['accesorios_recibidos'] ?? '') ?></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="estado_fisico">Estado físico del equipo</label>
              <textarea id="estado_fisico" name="estado_fisico" class="form-control" rows="2"
                        placeholder="Golpes, humedad, no enciende..."><?= h($_POST['estado_fisico'] ?? '') ?></textarea>
            </div>
          </div>

          <div class="form-section-title"><i class="fa-solid fa-triangle-exclamation"></i> Falla</div>
          <div class="form-group">
            <label class="form-label" for="problema_reportado">Problema reportado *</label>
            <textarea id="problema_reportado" name="problema_reportado" class="form-control" rows="5"
                      placeholder="Cuéntenos qué ocurre, desde cuándo y en qué circunstancias." required><?= h($_POST['problema_reportado'] ?? '') ?></textarea>
          </div>

          <button class="btn btn-glow" type="submit"><i class="fa-solid fa-paper-plane"></i> Enviar solicitud</button>
        </form>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fa-solid fa-list-check"></i> Mis reparaciones</div>
          <span class="result-count"><?= count($misReparaciones) ?> registradas</span>
        </div>
        <?php if (!$misReparaciones): ?>
          <div class="empty-state"><i class="fa-solid fa-screwdriver-wrench"></i> Aún no tiene solicitudes de reparación.</div>
        <?php else: ?>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Código</th><th>Equipo</th><th>Estado</th><th>Presupuesto</th><th></th></tr></thead>
              <tbody>
                <?php foreach ($misReparaciones as $rep): ?>
                  <tr>
                    <td><strong><?= h($rep['codigo']) ?></strong></td>
                    <td><?= h($rep['tipo_equipo']) ?><?= $rep['marca'] ? ' · ' . h($rep['marca']) : '' ?></td>
                    <td><?= badgeEstado($rep['estado']) ?></td>
                    <td><?= h(money($rep['presupuesto'])) ?></td>
                    <td><a class="btn btn-outline btn-sm" href="<?= BASE_URL ?>/modules/repairs/view.php?id=<?= (int)$rep['id'] ?>">
                      <i class="fa-solid fa-eye"></i> Ver detalle</a></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</section>
<?php require_once __DIR__ . '/../includes/store_footer.php'; ?>
