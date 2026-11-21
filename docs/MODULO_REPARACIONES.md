# Módulo de reparaciones técnicas — GALAX PC REPAIR

Documentación funcional y técnica del sistema de órdenes de reparación.
Base de datos canónica: `ventas_informatica`. PHP 8.2 + PDO (`db()`).

## 1. Archivos del módulo

| Archivo | Responsabilidad |
|---|---|
| `modules/repairs/index.php` | Listado administrativo: filtros por estado y búsqueda, paginación real (`paginate()`), KPIs desde MySQL. |
| `modules/repairs/create.php` | Formulario de registro de orden (panel). Envía POST a `save.php`. |
| `modules/repairs/view.php` | Detalle: historial cronológico, diagnóstico, presupuesto, aprobación, técnico, repuestos, mano de obra, total y garantía. Adapta el layout (panel para personal, tienda para cliente). |
| `modules/repairs/save.php` | Controlador POST único: alta, datos técnicos, transiciones, repuestos y aprobación/rechazo. Valida servidor, CSRF, permisos y propiedad. |
| `shop/repair_request.php` | Solicitud pública del cliente (requiere login). Muestra además sus propias órdenes. |

Todas las escrituras usan `require_csrf()`. No hay acciones destructivas por GET.

## 2. Permisos y aislamiento

| Perfil | Acceso |
|---|---|
| Administrador | Permiso `*` (implícito). Ve y gestiona todas las órdenes. |
| Técnico / Empleado | Requiere el permiso `reparaciones`. Ven y gestionan todas las órdenes. |
| Cliente | **No** tiene permiso `reparaciones`. Usa `requireLogin()` y sólo puede ver órdenes cuyo `reparaciones.cliente_id` coincida con `clientes.usuario_id = $_SESSION['user_id']`. |
| Visitante | Redirigido a `auth/login.php`. |

Si un cliente solicita `view.php?id=` de una orden ajena (o no tiene ficha de cliente), se devuelve **403** mediante `accessDenied()`. El servidor vuelve a verificar la propiedad en cada UPDATE de aprobación (`WHERE id = ? AND cliente_id = ?`), por lo que no basta con manipular el formulario.

`shop/repair_request.php` crea automáticamente una ficha mínima en `clientes` para el usuario autenticado que aún no tenga una, tomando nombre, apellido, email, teléfono y dirección de `usuarios`.

## 3. Flujo de estados

Estados ENUM (13) y transiciones permitidas. Cualquier otro salto es rechazado en `save.php`.

```
recibido
 ├─> pendiente_diagnostico ─> en_diagnostico
 ├─> en_diagnostico
 └─> cancelado

en_diagnostico
 ├─> presupuesto_enviado ─> esperando_aprobacion ─> aprobado ─> en_reparacion
 ├─> esperando_repuestos ─> en_reparacion
 ├─> en_reparacion
 └─> cancelado

en_reparacion ─> esperando_repuestos ─> en_reparacion
en_reparacion ─> en_pruebas ─> reparado ─> listo_para_entregar ─> entregado
en_pruebas ─> en_reparacion (nueva prueba)
reparado ─> en_pruebas (revisión adicional)
```

| Estado | Significado |
|---|---|
| `recibido` | Orden registrada (alta desde panel o solicitud web). |
| `pendiente_diagnostico` | En cola de evaluación. |
| `en_diagnostico` | Técnico revisando el equipo. |
| `presupuesto_enviado` | Presupuesto notificado al cliente; pendiente de respuesta. |
| `esperando_aprobacion` | Recordatorio de aprobación pendiente. |
| `aprobado` | Cliente aprobó (`aprobacion_cliente = 1`). |
| `en_reparacion` | Ejecución de la reparación. |
| `esperando_repuestos` | Bloqueo por falta de stock. |
| `en_pruebas` | Verificación funcional. |
| `reparado` | Reparación concluida. |
| `listo_para_entregar` | Coordinación de entrega. |
| `entregado` | Estado final; fija `fecha_entrega = NOW()`. |
| `cancelado` | Estado final (rechazo de presupuesto o baja). |

### Reglas de transición

- No se puede saltar a `aprobado` si `aprobacion_cliente != 1`.
- No se puede enviar presupuesto (`presupuesto_enviado`, `esperando_aprobacion`, `aprobado`) si `presupuesto <= 0`.
- Al reenviar a `presupuesto_enviado`/`esperando_aprobacion` se reinicia `aprobacion_cliente = 0`.
- `entregado` y `cancelado` son finales: no permiten cambios de estado, edición de datos técnicos ni movimientos de repuestos.
- El cliente puede responder sólo desde `presupuesto_enviado` o `esperando_aprobacion`:
  - **Aprobar** → `aprobacion_cliente = 1`, estado `aprobado`.
  - **Rechazar** → `aprobacion_cliente = 0`, estado `cancelado`.
- Cada cambio inserta una fila en `reparacion_historial` (estado, nota, usuario, fecha) y llama a `audit_log()`.
- La actualización de estado incluye el estado leído en el `WHERE` (control optimista de concurrencia).

## 4. Cálculo de importes

- El presupuesto y la mano de obra se capturan en el detalle y se validan en servidor (`gxRepMoney()`).
- `costo_total` **siempre se calcula en backend**: `mano_obra + costo_repuestos`.
- Al agregar un repuesto: `costo_repuestos += subtotal` y se recalcula `costo_total` en la misma sentencia SQL.
- Al quitar un repuesto: se revierte el subtotal y se recalcula el total con `GREATEST(0, ...)`.
- Los precios de repuestos se toman de `productos.precio_venta` en MySQL; el navegador nunca envía precios.

## 5. Gestión de repuestos y stock

Alta de repuesto (transacción):

1. `SELECT ... FROM productos WHERE id = ? FOR UPDATE`.
2. Validación de existencia y `stock >= cantidad`; si no hay stock se muestra un error claro con el disponible.
3. `UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?` y verificación de `rowCount() === 1` (descuento atómico).
4. `INSERT INTO reparacion_repuestos` con nombre, cantidad, precio unitario y subtotal.
5. `INSERT INTO inventario_movimientos` con `tipo = 'reparacion'`, `cantidad = -cantidad` (salida), `stock_anterior`, `stock_nuevo`, motivo, documento (código de orden), `costo_unitario` y usuario.
6. Recálculo de `costo_repuestos`/`costo_total`, fila de historial y auditoría.

La eliminación de un repuesto hace el camino inverso (devolución de stock con movimiento de inventario positivo) y recalcula el total. Todo se ejecuta en una sola transacción; cualquier fallo hace `rollBack()`.

## 6. Seguridad aplicada

- CSRF: `csrf_field()` en todos los formularios y `require_csrf()` antes de cualquier POST.
- Autorización: `requirePermission('reparaciones')` en panel y controlador; `requireLogin()` + filtro por `clientes.usuario_id` en el portal.
- Escaping: `h()` para toda salida; `number_format()` para valores numéricos en atributos.
- SQL: sentencias preparadas en todas las consultas; sin interpolación de datos del usuario en SQL.
- Códigos: `generateCode('REP', 'reparaciones')` con unicidad verificada en base de datos.
- Auditoría: alta, actualización de datos, cambio de estado, agregar/quitar repuestos, aprobación y rechazo.

## 7. Interfaz

Se usan las clases existentes del design system GALAX: `card`, `card-header`, `card-title`, `btn`, `btn-primary`, `btn-ghost`, `btn-success`, `btn-danger`, `grid`, `grid-2`, `grid-3`, `form-group`, `form-label`, `form-control`, `table-wrap`, `table`, `badge`, `chip`, `status-timeline`, `summary-row`, `stat-card`, `pagination`, `alert` y `empty-state`. Sin datos de ejemplo: todos los listados y totales provienen de MySQL.

## 8. Verificación ejecutada (2026-11-20)

Con el servidor de pruebas `php -S 127.0.0.1:8000` y cuentas temporales `qa.*`:

- El cliente creó una solicitud desde `shop/repair_request.php` → HTTP 302 a `modules/repairs/view.php?id=19`.
- El personal actualizó diagnóstico/presupuesto (S/ 180.00) y envió el presupuesto (`presupuesto_enviado`) con CSRF y permiso `reparaciones`.
- El cliente vio el importe real en su detalle y aprobó `/save.php?action=approve` → estado `aprobado`, `aprobacion_cliente=1`.
- La auditoría registró `reparacion_solicitud`, `reparacion_actualizar`, `reparacion_estado` y `reparacion_presupuesto_aprobado`.
- Los registros QA se eliminaron posteriormente con `database/maintenance/limpiar_qa_20261120.sql`; no quedan órdenes de reparación en la BD de entrega.
