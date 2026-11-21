# Módulos de Inventario, Reportes y Pedidos Online

Implementación administrativa de **inventario**, **reportes**, **pedidos online** y **compras a proveedores** para GALAX PC REPAIR.
Toda la información mostrada procede de MySQL (`ventas_informatica`); no se usan datos ficticios.

## 1. Archivos implementados

| Archivo | Permiso servidor | Responsabilidad |
|---|---|---|
| `modules/inventory/index.php` | `inventario` | Movimientos de stock, alertas, proveedores y compras |
| `modules/reports/index.php` | `reportes` | KPIs, gráficos SVG, tablas y exportación CSV |
| `modules/orders/index.php` | `pedidos` | Listado filtrable y cambio rápido de estado |
| `modules/orders/view.php` | `pedidos` | Detalle, transiciones y enlace al comprobante PNG |
| `docs/MODULO_INVENTARIO_REPORTES.md` | — | Esta documentación |

Todos incluyen `includes/functions.php` → `includes/security.php` → `config/database.php`,
usan `db()` (PDO), `includes/header.php` y `includes/footer.php`. `theme.css` se enlaza
desde cada vista sin modificar `header.php`, para conservar el panel heredado.

## 2. Inventario y compras

### 2.1 Movimientos de stock

Operaciones disponibles: **entrada**, **salida** y **ajuste**.

- Cada POST ejecuta `require_csrf()` antes de cualquier escritura.
- Se abre una transacción; se bloquea la fila con `SELECT stock ... FOR UPDATE`.
- Se calcula `stock_nuevo` y se actualiza `productos.stock` de forma atómica.
- Se inserta en `inventario_movimientos` con `stock_anterior`, `stock_nuevo`, `cantidad`,
  `motivo`, `documento`, `costo_unitario` y `usuario_id`.
- **Nunca se permite stock negativo**: las salidas validan disponibilidad y los ajustes
  con delta negativo se rechazan si dejan el stock por debajo de cero.
- Convención del campo `cantidad`:
  - `entrada` / `salida`: entero positivo.
  - `ajuste`: delta con signo (`+3` aumenta, `-2` reduce).
- La operación se audita con `audit_log('inventario_movimiento', 'productos', ...)`.

### 2.2 Filtros, paginación y alertas

- Filtros GET: `producto_id`, `tipo` (todos los valores del ENUM), `desde`, `hasta`, `page`.
- Conteo real con `COUNT(*)` y paginación con `paginate()` + `pagination_links()`; los filtros
  se conservan entre páginas.
- Alertas calculadas desde la tabla `productos`:
  - Agotados: `stock <= 0`.
  - Stock bajo: `stock > 0 AND stock <= stock_minimo`.
  - Ambos estados se restringen a productos `activo`.

### 2.3 Proveedores y compras

- `proveedor`: inserta en `proveedores` (nombre obligatorio, correo validado con `filter_var`).
- `compra`:
  1. Valida proveedor activo y producto dentro de la transacción.
  2. Genera `CMP-ymd-XXXXXX` verificando unicidad contra `compras_proveedor`.
  3. Inserta la compra con `costo_unitario`, `total = cantidad * costo_unitario` y `fecha`.
  4. Registra un movimiento `entrada` con `documento = código de compra`.
  5. Recalcula `productos.precio_compra` como promedio ponderado:
     `(stock_actual * costo_anterior + cantidad * costo_unitario) / (stock_actual + cantidad)`.
  6. Audita la operación.

> **Nota técnica:** `generateCode()` admite una lista blanca de tablas y no incluye
> `compras_proveedor`, por lo que `inventory/index.php` usa un generador local equivalente
> con la misma estrategia fecha + aleatorio y validación por prepared statement contra
> `compras_proveedor`. No se depende de `MAX(id)`, evitando colisiones concurrentes.

El listado de compras muestra el margen unitario usando `productos.precio_venta - compras_proveedor.costo_unitario`
y su porcentaje respectivo.

## 3. Reportes

Rango por defecto: últimos 30 días. Parámetros: `desde`, `hasta` (AAAA-MM-DD) y `report`.

### 3.1 Métricas calculadas

| Métrica | Origen |
|---|---|
| Ventas | `ventas.created_at`, `SUM(total)` y conteo |
| Pedidos | `pedidos.creado_en`, `SUM(total)` y conteo |
| Ingresos cobrados | Ventas `pagado`/`entregado` + pedidos `completado` |
| Margen realizado | `SUM((precio_unitario - precio_compra) * cantidad)` en `detalle_ventas` y `pedido_detalles` (excluye cancelados) |
| Stock valorizado | `SUM(stock * precio_compra)` y `SUM(stock * COALESCE(precio_oferta, precio_venta))` |
| Productos más vendidos | `UNION ALL` de `detalle_ventas` y `pedido_detalles`, agrupado por producto |
| Pedidos por estado | `GROUP BY pedidos.estado` |

Los rangos mayores a 45 días se agrupan automáticamente por mes; en caso contrario por día.
Los días/meses sin operaciones se representan con cero (dato real de ausencia de registros).

### 3.2 Gráficos

Se generan **SVG en PHP** (sin dependencias de CDN): barras para ventas y pedidos, con
`<title>` por barra y ejes con escala calculada desde los máximos reales. No se inyecta HTML
sin escapar: etiquetas y títulos pasan por `h()`.

### 3.3 Exportación CSV

Mismo archivo con `?export=csv&report=...&desde=...&hasta=...`.

- `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment` y BOM UTF-8.
- Reportes exportables: `ventas`, `pedidos`, `productos`, `margenes`, `stock`, `ingresos`.
- Escape de fórmulas: todo valor que comienza con `=`, `+`, `-` o `@` (también tab/CR)
  se prefija con `'` antes de `fputcsv()`. Esto evita la ejecución de fórmulas en hojas de cálculo.
- Los límites de las tablas HTML no afectan al CSV (por ejemplo, «productos más vendidos»
  exporta el Top 10 calculado; márgenes y stock exportan el conjunto completo).

## 4. Pedidos online

### 4.1 Listado (`index.php`)

- Filtros GET: `q` (código, cliente, email o documento), `estado`, `desde`, `hasta`, `page`.
- Paginación real con `COUNT(*)` y conservación de filtros.
- Indicadores por estado y facturación total.
- Acciones: ver detalle, descargar comprobante PNG y cambio rápido de estado.

### 4.2 Detalle (`view.php`)

- Datos del cliente, entrega, pago, línea de tiempo y detalle de `pedido_detalles`.
- Transiciones permitidas:

| Estado actual | Estados destino |
|---|---|
| `pendiente` | `confirmado`, `cancelado` |
| `confirmado` | `preparando`, `cancelado` |
| `preparando` | `completado`, `cancelado` |
| `completado` | — |
| `cancelado` | — |

- Todo cambio valida la transición en servidor, usa `csrf_field()` / `require_csrf()`,
  actualiza `estado` y `actualizado_en`, escribe `audit_log('pedido_estado_cambiado', ...)`
  y redirige con `flash()`.
- Botón **Generar comprobante PNG** enlaza a
  `BASE_URL . '/shop/receipt.php?pedido=' . $id`. Ese controlador es responsabilidad de otro
  agente; desde estos archivos sólo se genera el enlace.

## 5. Seguridad

- `requirePermission()` en servidor para los tres permisos (`inventario`, `reportes`, `pedidos`).
- `require_csrf()` en **todos** los POST (movimientos, proveedores, compras y cambios de estado).
- Consultas preparadas con marcadores posicionales; `LIMIT` enlazado como `PDO::PARAM_INT`.
- Enteros, montos y fechas validados antes de usarlos; estados restringidos a listas blancas.
- Salida escapada con `h()`; `badgeEstado()` para estados; `money()` / `fecha()` para formato.
- Las excepciones se registran en `error_log()`; la transacción se revierte con `rollBack()`.

## 6. Verificación

Lint ejecutado con PHP 8.2 de XAMPP:

```powershell
& "C:\xampp\php\php.exe" -l "D:\GAlAX PC REPAIR\modules\inventory\index.php"
& "C:\xampp\php\php.exe" -l "D:\GAlAX PC REPAIR\modules\reports\index.php"
& "C:\xampp\php\php.exe" -l "D:\GAlAX PC REPAIR\modules\orders\index.php"
& "C:\xampp\php\php.exe" -l "D:\GAlAX PC REPAIR\modules\orders\view.php"
```

Resultado: `No syntax errors detected` en los cuatro archivos PHP (lint recursivo completo del proyecto: `LINT_FAILURES=0`).

Verificación HTTP adicional (2026-11-20): las rutas `/modules/inventory/index.php`, `/modules/reports/index.php`, `/modules/orders/index.php` y `/modules/orders/view.php` respondieron HTTP 200 sin errores PHP con sesión administrativa. La exportación `?export=csv&report=ventas&...` devolvió `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment` y BOM UTF-8. Los datos de QA creados durante la prueba se eliminaron y el stock se restauró desde el backup (`database/maintenance/limpiar_qa_20261120.sql`).
