<?php
/**
 * GALAX PC REPAIR — Controlador POST del módulo de reparaciones.
 *
 * Todas las escrituras (alta, cambios de estado, datos técnicos, repuestos y
 * aprobación del cliente) pasan por aquí. Nunca se confía en precios enviados
 * por el navegador: los importes se leen/calculan siempre desde MySQL.
 */
require_once __DIR__ . '/../../includes/functions.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit('Método no permitido.');
}
require_csrf();

const GX_REP_STATES = [
    'recibido', 'pendiente_diagnostico', 'en_diagnostico', 'presupuesto_enviado',
    'esperando_aprobacion', 'aprobado', 'en_reparacion', 'esperando_repuestos',
    'en_pruebas', 'reparado', 'listo_para_entregar', 'entregado', 'cancelado',
];

/** Transiciones permitidas. Un estado final no tiene salidas. */
function gxRepTransitions(): array
{
    return [
        'recibido'             => ['pendiente_diagnostico', 'en_diagnostico', 'presupuesto_enviado', 'cancelado'],
        'pendiente_diagnostico'=> ['en_diagnostico', 'presupuesto_enviado', 'cancelado'],
        'en_diagnostico'       => ['presupuesto_enviado', 'esperando_repuestos', 'en_reparacion', 'cancelado'],
        'presupuesto_enviado'  => ['esperando_aprobacion', 'aprobado', 'cancelado'],
        'esperando_aprobacion' => ['aprobado', 'cancelado'],
        'aprobado'             => ['en_reparacion', 'esperando_repuestos', 'cancelado'],
        'en_reparacion'        => ['esperando_repuestos', 'en_pruebas', 'cancelado'],
        'esperando_repuestos'  => ['en_reparacion', 'cancelado'],
        'en_pruebas'           => ['reparado', 'en_reparacion', 'cancelado'],
        'reparado'             => ['listo_para_entregar', 'en_pruebas'],
        'listo_para_entregar'  => ['entregado'],
        'entregado'            => [],
        'cancelado'            => [],
    ];
}

function gxRepStateLabel(string $state): string
{
    $labels = [
        'recibido' => 'Recibido', 'pendiente_diagnostico' => 'Pendiente de diagnóstico',
        'en_diagnostico' => 'En diagnóstico', 'presupuesto_enviado' => 'Presupuesto enviado',
        'esperando_aprobacion' => 'Esperando aprobación', 'aprobado' => 'Aprobado',
        'en_reparacion' => 'En reparación', 'esperando_repuestos' => 'Esperando repuestos',
        'en_pruebas' => 'En pruebas', 'reparado' => 'Reparado',
        'listo_para_entregar' => 'Listo para entregar', 'entregado' => 'Entregado',
        'cancelado' => 'Cancelado',
    ];
    return $labels[$state] ?? ucfirst(str_replace('_', ' ', $state));
}

/** Normaliza un importe recibido por POST a un float no negativo. */
function gxRepMoney($value): float
{
    $clean = preg_replace('/[^0-9.\-]/', '', trim((string)$value));
    $amount = round((float)$clean, 2);
    return max(0.0, min(9999999999.99, $amount));
}

/** Devuelve una fecha Y-m-d válida o null. */
function gxRepDate($value): ?string
{
    $value = trim((string)$value);
    if ($value === '') {
        return null;
    }
    $d = DateTime::createFromFormat('!Y-m-d', $value);
    return ($d && $d->format('Y-m-d') === $value) ? $value : null;
}

function gxRepFind(int $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM reparaciones WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

/** Orden.propiedad del usuario autenticado. Devuelve null si no es suya. */
function gxRepOwned(int $id): ?array
{
    requireLogin();
    $stmt = db()->prepare('SELECT id FROM clientes WHERE usuario_id = ? LIMIT 1');
    $stmt->execute([(int)$_SESSION['user_id']]);
    $clienteId = $stmt->fetchColumn();
    if ($clienteId === false) {
        return null;
    }
    $stmt = db()->prepare('SELECT * FROM reparaciones WHERE id = ? AND cliente_id = ? LIMIT 1');
    $stmt->execute([$id, (int)$clienteId]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function gxRepHistory(int $repId, string $estado, ?string $nota = null): void
{
    $stmt = db()->prepare(
        'INSERT INTO reparacion_historial (reparacion_id, estado, nota, usuario_id) VALUES (?,?,?,?)'
    );
    $stmt->execute([
        $repId,
        mb_substr($estado, 0, 50),
        $nota === null || trim($nota) === '' ? null : mb_substr(trim($nota), 0, 1000),
        isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null,
    ]);
}

function gxRepFail(string $message, string $url): void
{
    flash('error', $message);
    redirect($url);
}

function gxRepViewUrl(int $id): string
{
    return BASE_URL . '/modules/repairs/view.php?id=' . $id;
}

$action = (string)($_POST['action'] ?? '');
$id = (int)($_POST['id'] ?? 0);

/* ------------------------------------------------------------------ */
/* Alta desde el panel (personal con permiso)                          */
/* ------------------------------------------------------------------ */
if ($action === 'create') {
    requirePermission('reparaciones');

    $createUrl = BASE_URL . '/modules/repairs/create.php';
    $clienteId = (int)($_POST['cliente_id'] ?? 0) ?: null;
    $nombre = trim((string)($_POST['nombre_cliente'] ?? ''));
    $contacto = trim((string)($_POST['contacto_cliente'] ?? ''));
    $tipo = trim((string)($_POST['tipo_equipo'] ?? ''));
    $marca = trim((string)($_POST['marca'] ?? ''));
    $modelo = trim((string)($_POST['modelo'] ?? ''));
    $serie = trim((string)($_POST['numero_serie'] ?? ''));
    $accesorios = trim((string)($_POST['accesorios_recibidos'] ?? ''));
    $fisico = trim((string)($_POST['estado_fisico'] ?? ''));
    $problema = trim((string)($_POST['problema_reportado'] ?? ''));
    $presupuesto = gxRepMoney($_POST['presupuesto'] ?? 0);
    $fechaEstimadaRaw = trim((string)($_POST['fecha_estimada_entrega'] ?? ''));
    $tecnicoId = (int)($_POST['tecnico_id'] ?? 0) ?: null;
    $garantia = trim((string)($_POST['garantia'] ?? ''));
    $observaciones = trim((string)($_POST['observaciones'] ?? ''));
    $errors = [];

    if ($clienteId !== null) {
        $stmt = db()->prepare('SELECT id, nombre, apellido, email, telefono FROM clientes WHERE id = ? LIMIT 1');
        $stmt->execute([$clienteId]);
        $cliente = $stmt->fetch();
        if ($cliente === false) {
            $errors[] = 'El cliente seleccionado no existe.';
        } else {
            if ($nombre === '') {
                $nombre = trim($cliente['nombre'] . ' ' . $cliente['apellido']);
            }
            if ($contacto === '') {
                $contacto = trim((string)($cliente['email'] ?: $cliente['telefono']));
            }
        }
    }
    if ($nombre === '') {
        $errors[] = 'Indique el nombre del cliente o seleccione uno del catálogo.';
    }
    if ($tipo === '') {
        $errors[] = 'El tipo de equipo es obligatorio.';
    }
    if ($problema === '') {
        $errors[] = 'Describa el problema reportado.';
    }
    if (mb_strlen($nombre) > 160 || mb_strlen($contacto) > 160 || mb_strlen($tipo) > 100) {
        $errors[] = 'Uno de los campos de cliente/equipo supera la longitud permitida.';
    }
    if ($fechaEstimadaRaw !== '' && gxRepDate($fechaEstimadaRaw) === null) {
        $errors[] = 'La fecha estimada de entrega no es válida.';
    }
    if ($tecnicoId !== null) {
        $stmt = db()->prepare('SELECT 1 FROM usuarios WHERE id = ? LIMIT 1');
        $stmt->execute([$tecnicoId]);
        if (!$stmt->fetchColumn()) {
            $errors[] = 'El técnico seleccionado no existe.';
        }
    }

    if ($errors) {
        set_old($_POST);
        gxRepFail(implode(' ', $errors), $createUrl);
    }

    $db = db();
    $db->beginTransaction();
    try {
        $codigo = generateCode('REP', 'reparaciones');
        $stmt = $db->prepare(
            'INSERT INTO reparaciones
             (codigo, cliente_id, usuario_id, nombre_cliente, contacto_cliente, tipo_equipo, marca, modelo,
              numero_serie, accesorios_recibidos, estado_fisico, problema_reportado, diagnostico, presupuesto,
              aprobacion_cliente, tecnico_id, fecha_recepcion, fecha_estimada_entrega, mano_obra,
              costo_repuestos, costo_total, garantia, observaciones, estado)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?,0,0,0,?,?,\'recibido\')'
        );
        $stmt->execute([
            $codigo, $clienteId, (int)$_SESSION['user_id'], mb_substr($nombre, 0, 160),
            mb_substr($contacto, 0, 160) ?: null, mb_substr($tipo, 0, 100),
            mb_substr($marca, 0, 100) ?: null, mb_substr($modelo, 0, 100) ?: null,
            mb_substr($serie, 0, 120) ?: null, $accesorios ?: null, $fisico ?: null,
            $problema, null, $presupuesto, 0, $tecnicoId,
            gxRepDate($fechaEstimadaRaw), $garantia ?: null, $observaciones ?: null,
        ]);
        $newId = (int)$db->lastInsertId();
        gxRepHistory($newId, 'recibido', 'Orden de reparación registrada desde el panel.');
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[GALAX][REPARACIONES][CREATE] ' . $e->getMessage());
        set_old($_POST);
        gxRepFail('No se pudo registrar la orden de reparación. Intente nuevamente.', $createUrl);
    }
    audit_log('reparacion_crear', 'reparaciones', $newId, $codigo . ' | ' . $nombre);
    clear_old();
    flash('success', 'Orden de reparación registrada: ' . $codigo);
    redirect(gxRepViewUrl($newId));
}

/* De aquí en adelante toda acción requiere una orden existente. */
$rep = gxRepFind($id);
if (!$rep) {
    flash('error', 'La orden de reparación no existe.');
    redirect(BASE_URL . '/modules/repairs/index.php');
}

/* ------------------------------------------------------------------ */
/* Datos técnicos: diagnóstico, presupuesto, mano de obra, garantía... */
/* ------------------------------------------------------------------ */
if ($action === 'update_details') {
    requirePermission('reparaciones');
    if (in_array($rep['estado'], ['entregado', 'cancelado'], true)) {
        gxRepFail('No se puede editar una orden finalizada.', gxRepViewUrl($id));
    }

    $diagnostico = trim((string)($_POST['diagnostico'] ?? ''));
    $presupuesto = gxRepMoney($_POST['presupuesto'] ?? 0);
    $manoObra = gxRepMoney($_POST['mano_obra'] ?? 0);
    $garantia = trim((string)($_POST['garantia'] ?? ''));
    $observaciones = trim((string)($_POST['observaciones'] ?? ''));
    $fisico = trim((string)($_POST['estado_fisico'] ?? ''));
    $tecnicoId = (int)($_POST['tecnico_id'] ?? 0) ?: null;
    $fechaRaw = trim((string)($_POST['fecha_estimada_entrega'] ?? ''));
    $errors = [];

    if ($fechaRaw !== '' && gxRepDate($fechaRaw) === null) {
        $errors[] = 'La fecha estimada de entrega no es válida.';
    }
    if ($tecnicoId !== null) {
        $stmt = db()->prepare('SELECT 1 FROM usuarios WHERE id = ? LIMIT 1');
        $stmt->execute([$tecnicoId]);
        if (!$stmt->fetchColumn()) {
            $errors[] = 'El técnico seleccionado no existe.';
        }
    }
    if ($errors) {
        gxRepFail(implode(' ', $errors), gxRepViewUrl($id));
    }

    $db = db();
    $db->beginTransaction();
    try {
        // costo_total se recalcula en BACKEND: mano de obra + repuestos ya registrados.
        $stmt = $db->prepare(
            'UPDATE reparaciones
                SET diagnostico = ?, presupuesto = ?, mano_obra = ?, garantia = ?, observaciones = ?,
                    estado_fisico = ?, tecnico_id = ?, fecha_estimada_entrega = ?,
                    costo_total = ? + COALESCE(costo_repuestos, 0)
              WHERE id = ?'
        );
        $stmt->execute([
            $diagnostico ?: null, $presupuesto, $manoObra, $garantia ?: null,
            $observaciones ?: null, $fisico ?: null, $tecnicoId, gxRepDate($fechaRaw),
            $manoObra, $id,
        ]);
        gxRepHistory(
            $id,
            (string)$rep['estado'],
            'Datos técnicos actualizados. Diagnóstico: ' . ($diagnostico !== '' ? mb_substr($diagnostico, 0, 240) : '-')
            . ' | Presupuesto: ' . money($presupuesto) . ' | Mano de obra: ' . money($manoObra)
        );
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[GALAX][REPARACIONES][DETAILS] ' . $e->getMessage());
        gxRepFail('No se pudo guardar los datos técnicos.', gxRepViewUrl($id));
    }
    audit_log('reparacion_actualizar', 'reparaciones', $id, $rep['codigo'] . ' | datos técnicos');
    flash('success', 'Datos técnicos guardados. Total recalculado: ' . money($manoObra + (float)$rep['costo_repuestos']));
    redirect(gxRepViewUrl($id));
}

/* ------------------------------------------------------------------ */
/* Transiciones de estado controladas                                  */
/* ------------------------------------------------------------------ */
if ($action === 'update_status') {
    requirePermission('reparaciones');
    $destino = (string)($_POST['estado'] ?? '');
    $nota = trim((string)($_POST['nota'] ?? ''));
    $actual = (string)$rep['estado'];
    $permitidos = gxRepTransitions()[$actual] ?? [];

    if (!in_array($destino, GX_REP_STATES, true)) {
        gxRepFail('Estado destino no válido.', gxRepViewUrl($id));
    }
    if (!in_array($destino, $permitidos, true)) {
        gxRepFail('Transición no permitida desde ' . gxRepStateLabel($actual) . '.', gxRepViewUrl($id));
    }
    if ($destino === 'aprobado' && (int)$rep['aprobacion_cliente'] !== 1) {
        gxRepFail('El cliente aún no ha aprobado el presupuesto.', gxRepViewUrl($id));
    }
    if (in_array($destino, ['presupuesto_enviado', 'esperando_aprobacion', 'aprobado'], true)
        && (float)$rep['presupuesto'] <= 0) {
        gxRepFail('Registre un presupuesto mayor a cero antes de continuar.', gxRepViewUrl($id));
    }

    $db = db();
    $db->beginTransaction();
    try {
        // El WHERE incluye el estado leído para evitar carreras entre dos técnicos.
        $sql = 'UPDATE reparaciones
                   SET estado = ?,
                       fecha_entrega = CASE WHEN ? = \'entregado\' THEN NOW() ELSE fecha_entrega END';
        $params = [$destino, $destino];
        if (in_array($destino, ['presupuesto_enviado', 'esperando_aprobacion'], true)) {
            $sql .= ', aprobacion_cliente = 0';
        }
        $sql .= ' WHERE id = ? AND estado = ?';
        $params[] = $id;
        $params[] = $actual;
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        if ($stmt->rowCount() !== 1) {
            throw new RuntimeException('El estado de la orden cambió mientras se procesaba la solicitud.');
        }
        gxRepHistory(
            $id,
            $destino,
            $nota !== '' ? $nota : 'Cambio de estado: ' . gxRepStateLabel($actual) . ' → ' . gxRepStateLabel($destino)
        );
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        gxRepFail($e->getMessage(), gxRepViewUrl($id));
    }
    audit_log(
        'reparacion_estado',
        'reparaciones',
        $id,
        $rep['codigo'] . ' | ' . $actual . ' → ' . $destino . ($nota !== '' ? ' | ' . mb_substr($nota, 0, 200) : '')
    );
    flash('success', 'Estado actualizado a ' . gxRepStateLabel($destino) . '.');
    redirect(gxRepViewUrl($id));
}

/* ------------------------------------------------------------------ */
/* Repuestos: descuento atómico de stock + movimiento de inventario    */
/* ------------------------------------------------------------------ */
if ($action === 'add_part') {
    requirePermission('reparaciones');
    if (in_array($rep['estado'], ['entregado', 'cancelado'], true)) {
        gxRepFail('No se pueden agregar repuestos a una orden finalizada.', gxRepViewUrl($id));
    }
    $productoId = (int)($_POST['producto_id'] ?? 0);
    $cantidad = (int)($_POST['cantidad'] ?? 0);
    if ($productoId <= 0 || $cantidad < 1 || $cantidad > 9999) {
        gxRepFail('Seleccione un producto y una cantidad válida (1 a 9999).', gxRepViewUrl($id));
    }

    $db = db();
    $db->beginTransaction();
    try {
        $stmt = $db->prepare('SELECT id, nombre, precio_venta, stock FROM productos WHERE id = ? FOR UPDATE');
        $stmt->execute([$productoId]);
        $producto = $stmt->fetch();
        if ($producto === false) {
            throw new RuntimeException('El producto seleccionado no existe.');
        }
        $stockAntes = (int)$producto['stock'];
        if ($stockAntes < $cantidad) {
            throw new RuntimeException(
                'Stock insuficiente para "' . $producto['nombre'] . '". Disponible: ' . $stockAntes . '.'
            );
        }
        // Precio tomado del catálogo (nunca del navegador).
        $precioUnitario = round((float)$producto['precio_venta'], 2);
        $subtotal = round($precioUnitario * $cantidad, 2);

        $stmt = $db->prepare('UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?');
        $stmt->execute([$cantidad, $productoId, $cantidad]);
        if ($stmt->rowCount() !== 1) {
            throw new RuntimeException('El stock cambió durante la operación. Intente nuevamente.');
        }

        $stmt = $db->prepare(
            'INSERT INTO reparacion_repuestos
             (reparacion_id, producto_id, nombre, cantidad, precio_unitario, subtotal)
             VALUES (?,?,?,?,?,?)'
        );
        $stmt->execute([$id, $productoId, mb_substr($producto['nombre'], 0, 180), $cantidad, $precioUnitario, $subtotal]);

        $stmt = $db->prepare(
            'INSERT INTO inventario_movimientos
             (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, documento, costo_unitario, usuario_id)
             VALUES (?,\'reparacion\',?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $productoId, -$cantidad, $stockAntes, $stockAntes - $cantidad,
            'Repuesto utilizado en reparación ' . $rep['codigo'],
            mb_substr((string)$rep['codigo'], 0, 80), $precioUnitario, (int)$_SESSION['user_id'],
        ]);

        // Total calculado en backend: mano de obra + todos los repuestos.
        $stmt = $db->prepare(
            'UPDATE reparaciones
                SET costo_total = COALESCE(mano_obra, 0) + COALESCE(costo_repuestos, 0) + ?,
                    costo_repuestos = COALESCE(costo_repuestos, 0) + ?
              WHERE id = ?'
        );
        $stmt->execute([$subtotal, $subtotal, $id]);

        gxRepHistory(
            $id,
            (string)$rep['estado'],
            'Repuesto agregado: ' . $producto['nombre'] . ' x' . $cantidad . ' (' . money($subtotal) . ').'
        );
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        $mensaje = $e instanceof RuntimeException
            ? $e->getMessage()
            : 'No se pudo agregar el repuesto. Intente nuevamente.';
        if (!($e instanceof RuntimeException)) {
            error_log('[GALAX][REPARACIONES][PART] ' . $e->getMessage());
        }
        gxRepFail($mensaje, gxRepViewUrl($id));
    }
    audit_log('reparacion_repuesto_agregar', 'reparaciones', $id, $rep['codigo'] . ' | producto ' . $productoId . ' x' . $cantidad);
    flash('success', 'Repuesto agregado y stock descontado correctamente.');
    redirect(gxRepViewUrl($id));
}

if ($action === 'remove_part') {
    requirePermission('reparaciones');
    if (in_array($rep['estado'], ['entregado', 'cancelado'], true)) {
        gxRepFail('No se pueden quitar repuestos de una orden finalizada.', gxRepViewUrl($id));
    }
    $itemId = (int)($_POST['item_id'] ?? 0);
    $stmt = db()->prepare('SELECT * FROM reparacion_repuestos WHERE id = ? AND reparacion_id = ? LIMIT 1');
    $stmt->execute([$itemId, $id]);
    $item = $stmt->fetch();
    if ($item === false) {
        gxRepFail('El repuesto indicado no pertenece a esta orden.', gxRepViewUrl($id));
    }

    $db = db();
    $db->beginTransaction();
    try {
        $subtotal = round((float)$item['subtotal'], 2);
        if (!empty($item['producto_id'])) {
            $productoId = (int)$item['producto_id'];
            $stmt = $db->prepare('SELECT id, stock FROM productos WHERE id = ? FOR UPDATE');
            $stmt->execute([$productoId]);
            $producto = $stmt->fetch();
            if ($producto !== false) {
                $antes = (int)$producto['stock'];
                $cantidad = (int)$item['cantidad'];
                $stmt = $db->prepare('UPDATE productos SET stock = stock + ? WHERE id = ?');
                $stmt->execute([$cantidad, $productoId]);
                $stmt = $db->prepare(
                    'INSERT INTO inventario_movimientos
                     (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, documento, costo_unitario, usuario_id)
                     VALUES (?,\'reparacion\',?,?,?,?,?,?,?)'
                );
                $stmt->execute([
                    $productoId, $cantidad, $antes, $antes + $cantidad,
                    'Devolución de repuesto de reparación ' . $rep['codigo'],
                    mb_substr((string)$rep['codigo'], 0, 80), (float)$item['precio_unitario'], (int)$_SESSION['user_id'],
                ]);
            }
        }
        $stmt = $db->prepare('DELETE FROM reparacion_repuestos WHERE id = ? AND reparacion_id = ?');
        $stmt->execute([$itemId, $id]);
        $stmt = $db->prepare(
            'UPDATE reparaciones
                SET costo_total = COALESCE(mano_obra, 0) + GREATEST(0, COALESCE(costo_repuestos, 0) - ?),
                    costo_repuestos = GREATEST(0, COALESCE(costo_repuestos, 0) - ?)
              WHERE id = ?'
        );
        $stmt->execute([$subtotal, $subtotal, $id]);
        gxRepHistory($id, (string)$rep['estado'], 'Repuesto eliminado: ' . $item['nombre'] . ' (' . money($subtotal) . ').');
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[GALAX][REPARACIONES][REMOVE_PART] ' . $e->getMessage());
        gxRepFail('No se pudo quitar el repuesto.', gxRepViewUrl($id));
    }
    audit_log('reparacion_repuesto_quitar', 'reparaciones', $id, $rep['codigo'] . ' | item ' . $itemId);
    flash('success', 'Repuesto eliminado, stock restaurado y total recalculado.');
    redirect(gxRepViewUrl($id));
}

/* ------------------------------------------------------------------ */
/* Aprobación / rechazo del presupuesto por el cliente (dueño)         */
/* ------------------------------------------------------------------ */
if ($action === 'approve' || $action === 'reject') {
    $owned = gxRepOwned($id);
    if (!$owned) {
        accessDenied();
    }
    if (!in_array($owned['estado'], ['presupuesto_enviado', 'esperando_aprobacion'], true)) {
        gxRepFail('El presupuesto ya no está pendiente de su aprobación.', gxRepViewUrl($id));
    }

    $aprueba = $action === 'approve';
    $destino = $aprueba ? 'aprobado' : 'cancelado';
    $nota = $aprueba
        ? 'Presupuesto aprobado por el cliente (' . money($owned['presupuesto']) . ').'
        : 'Presupuesto rechazado por el cliente (' . money($owned['presupuesto']) . ').';

    $db = db();
    $db->beginTransaction();
    try {
        $stmt = $db->prepare(
            'UPDATE reparaciones
                SET aprobacion_cliente = ?, estado = ?
              WHERE id = ? AND cliente_id = ? AND estado IN (\'presupuesto_enviado\',\'esperando_aprobacion\')'
        );
        $stmt->execute([$aprueba ? 1 : 0, $destino, $id, (int)$owned['cliente_id']]);
        if ($stmt->rowCount() !== 1) {
            throw new RuntimeException('El presupuesto ya fue respondido. Recargue la página.');
        }
        gxRepHistory($id, $destino, $nota);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        gxRepFail($e->getMessage(), gxRepViewUrl($id));
    }
    audit_log(
        $aprueba ? 'reparacion_presupuesto_aprobado' : 'reparacion_presupuesto_rechazado',
        'reparaciones',
        $id,
        $owned['codigo'] . ' | ' . money($owned['presupuesto'])
    );
    flash('success', $aprueba
        ? 'Presupuesto aprobado. La orden pasó a "Aprobado".'
        : 'Presupuesto rechazado. La orden fue cancelada.');
    redirect(gxRepViewUrl($id));
}

flash('error', 'Acción de reparación no reconocida.');
redirect(BASE_URL . '/modules/repairs/index.php');
