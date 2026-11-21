# GALAX PC REPAIR — Roadmap de implementación

> Archivo de seguimiento vivo. Se actualiza al finalizar cada misión.
> Fecha de inicio: 2026-11-20.

## MISIÓN 01 — Reconocimiento — COMPLETADA

### Inventario real del proyecto

| Ruta | Contenido |
|---|---|
| `index.php` | Redirige a login o dashboard. No existe tienda pública. |
| `config/database.php` | PDO singleton. Credenciales root/sin password. `SITE_NAME=TechVentas Pro`, `SITE_URL=http://localhost/proyecto`. |
| `includes/auth.php` | Sesiones, `hasPermission()` basada en campo `roles.permisos` (CSV), CSRF ausente, flash, `h()`, `generateCode()` (usa MAX(id), no atómico). |
| `includes/functions.php` | `money()`, `fecha()`, `badgeEstado()`, `paginate()` (helper no usado), `getStats()`. |
| `includes/header.php` / `footer.php` | Layout único de panel; **no hay layout público**. Sidebar con enlaces a 8 módulos. |
| `auth/` | login, register (fuerza rol 4 = Cliente), logout. Sin CSRF, sin rate limit, sin regeneración de session id. |
| `dashboard/index.php` | 4 KPIs, stock bajo, últimas ventas, tickets. Solo dentro del panel. |
| `modules/products/` | CRUD; borrado lógico vía GET (sin CSRF); sin imágenes. |
| `modules/categories/` | Alta/edición/baja por GET (sin CSRF). |
| `modules/customers/` | CRUD; borrado **físico** por GET (rompe FK de ventas). |
| `modules/sales/` | Creación de venta desde JS con precios enviados por el navegador (inseguro), IGV, stock sin `WHERE stock >= qty`; borrado de ventas por GET. |
| `modules/users/` | CRUD de usuarios, contraseña por defecto `123456`. |
| `modules/roles/` | Edición de permisosCSV. |
| `modules/settings/` | Actualización genérica de `configuracion` desde POST. |
| `modules/support/` | Tickets y respuestas. Acceso solo por permiso global `soporte` (sin aislamiento por cliente). |
| `assets/css/style.css` | Design system oscuro, 314 líneas, sin estilos de tienda/chat. |
| `assets/js/main.js` | Menú móvil, alerts, confirm, filtro de tabla, animación de números. |
| `gemma-4-E4B-it/` | Modelo local Gemma 4 E4B IT (multimodal texto/imagen/audio), 15.99 GB safetensors, tokenizer 32 MB, config `transformers_version=5.5.0.dev0`, `AutoModelForMultimodalLM`. **No hay servicio de inferencia ni código Python en el proyecto.** |
| `database.sql` | Script inicial con 14 tablas (desactualizado respecto a la BD real). |

### Entorno disponible (verificado)

- PHP 8.2.12 CLI en `C:\xampp\php\php.exe` (NO está en PATH).
- Apache 2.4.58 en `C:\xampp\apache` (no ejecutándose al inicio).
- MariaDB en `C:\xampp\mysql` (iniciado durante la auditoría, puerto 3306).
- Extensiones PHP: PDO, pdo_mysql, mbstring, openssl, curl, fileinfo. **GD NO habilitado** (`php_gd.dll` presente pero comentado en php.ini).
- Python: solo el stub de Microsoft Store; **no hay intérprete Python real**.
- RAM total: ~8.5 GB. Sin GPU detectada.
- El junction `C:\xampp\htdocs\galax_pc_repair` está ROTO (apunta a `D:\GALAX PC - REPAIR -`, que no existe).

### Bases de datos existentes (NO se destruirán)

1. **`ventas_informatica`** (14 tablas) — BD que usa el código PHP actual.
   - 12 productos reales con specs y precios, 7 categorías, 3 clientes reales, 5 usuarios, 4 roles.
   - Tablas adicionales ya aplicadas: `audit_log` (4 filas), `permisos` (10), `rol_permiso` (22), `migraciones` (`001_phase1_security.sql`).
   - `configuracion` ya contiene `empresa_nombre=GALAX PC REPAIR`, WhatsApp y promo.
   - Sin ventas registradas (0 filas), sin tickets.
2. **`galax pc repair`** (23 tablas + 1 vista) — BD de inventario ITAM + tienda.
   - 20 categorías reales, 6 servicios técnicos reales, 6 equipos ITAM, 100 productos **DE DEMOSTRACIÓN** (`Modelo demostración NN`, `Marca genérica`, SKU `DEM-xx-xx`).
   - Tablas `tienda_*` de pedidos/carritos/usuarios prácticamente vacías.

### Decisión técnica (MISIÓN 03)

- **BD canónica: `ventas_informatica`**. El código existente ya apunta a ella; conservar los 12 productos reales, usuarios, roles, permisos y configuración es la forma más segura de no romper funcionalidades.
- **Preservar íntegramente `galax pc repair`**. No se borrará ni se modificará. Se migrarán a la BD canónica solo los **6 servicios técnicos reales** y las **20 categorías reales** (como catálogo de categorías ampliado), mediante migración idempotente.
- **NO importar los 100 productos de demostración** al catálogo público (regla: sin datos ficticios en producción). Permanecen intactos en su BD original y se documentan como legacy demo.
- Paginación: calculará el total real de filas; no se generarán páginas artificiales.

### Matriz de diagnóstico inicial

| Módulo | Estado actual | Problemas | Trabajo necesario |
|---|---|---|---|
| Autenticación | Parcial | Sin CSRF en login/register, sin rate limit, sin regeneración de sesión, demo credentials en pantalla | Endurecer + pruebas |
| Productos | Parcial | Sin imágenes/specs, borrado por GET, sin catálogo público | Ampliar esquema + tienda |
| Clientes | Parcial | Borrado físico rompe integridad; sin portal privado | Baja lógica + portal |
| Ventas | Inseguro | Precios del navegador, stock sin comprobación atómica, borrado de ventas | Transacciones + servidor |
| Carrito | Inexistente | Solo venta directa del panel | Nuevo módulo DB-backed + deshacer |
| Asistente IA | Inexistente | Modelo presente, sin inferencia; runtime no disponible | API + servicio + estado honesto |
| Reparaciones | Inexistente | Solo tickets genéricos | Módulo completo con 13 estados |
| Usuarios | Parcial | Permisos por CSV, contraseña débil por defecto | Permisos en BD + roles 4 |
| Administración | Básico | 4 KPIs, sin inventario/reportes/gráficos reales | Ampliar |
| Base de datos | Dividida | Dos esquemas, script SQL desactualizado | Migraciones reversibles |

## MISIÓN 02 — Diagnóstico — COMPLETADA

Riesgos confirmados (todos reproducibles en código):

1. CSRF: ningún formulario incluye token; todas las acciones destructivas usan GET.
2. Control de acceso:Cliente con permiso `productos` ve el CRUD completo de productos.
3. Aislamiento: `modules/support/view.php` permite ver cualquier ticket por `id`.
4. Integridad: `modules/customers/index.php?delete=N` ejecuta `DELETE` con FK a `ventas`.
5. Precios: `modules/sales/create.php` confía en `items[].price` del cliente.
6. Stock: `UPDATE productos SET stock = stock - ?` sin condición `stock >= ?` → stock negativo.
7. Códigos: `generateCode()` usa `MAX(id)+1` → colisión concurrente.
8. Contraseñas: nuevas cuentas de usuario internas con `123456`.
9. XSS: escapado parcial (`h()`), pero atributos como `icono`/`color` se interpolan sin validar.
10. Sesión: no se regenera `session_id` al autenticar; logout solo `session_destroy()`.
11. Segmentación: no hay distinción Administrador/Empleado/Técnico/Cliente real.
12. Gemma: sin servicio; el modelo requiere Transformers 5.5.0.dev0 y ~16 GB de pesos con 8.5 GB de RAM → **bloqueo real de entorno**.

## MISIÓN 03 — Arquitectura y migraciones — COMPLETADA

Diseño adoptado: **evolución compatible, no reemplazo**. Se conservaron usuarios, productos, ventas, tickets, roles, configuración y la BD heredada `galax pc repair`.

- Capa de configuración central (`config/database.php`) con `config_value()`, `company_info()`, `BASE_URL`/`SITE_URL` y overrides por entorno.
- Capa de seguridad (`includes/security.php`) con CSRF, regeneración de sesión, rate limit de login, hash `password_hash()`, permisos en `permisos`/`rol_permiso` y fallback controlado al CSV histórico.
- Capa de dominio (`includes/repository.php`): catálogo, carrito, pedidos, reparaciones, inventario e IA con sentencias preparadas. Precios, stock, descuentos, IGV, envío y totales se recalculan siempre en MySQL/PHP, nunca se confía en el navegador.
- Dos layouts: `includes/store_header.php`/`store_footer.php` (tienda) y `includes/header.php`/`footer.php` (panel), compartiendo `assets/css/theme.css`.
- Componentes nuevos: `shop/`, `modules/repairs/`, `modules/inventory/`, `modules/reports/`, `modules/orders/`, `api/`, `ai_service/` y tests/documentación en `docs/`.
- Flujo IA real del cliente: UI en `includes/store_footer.php` + `assets/js/store.js` → `api/ai.php` → `ai_service/server.py` → sola lectura segura de MySQL para contexto. El token del servicio vive únicamente en el servidor PHP. Si Gemma no responde, se devuelve `mode: busqueda_local` con aviso explícito; nunca se presenta una búsqueda SQL como respuesta del modelo.
- Backup previo: `database/backups/ventas_informatica_20261120_160328.sql` (24.957 bytes).
- Migraciones aplicadas y registradas en `migraciones`: `001_phase1_security.sql`, `001_platform_core.sql`, `002_seed_reference_data.sql`, `003_restrict_client_permissions.sql` y `004_repair_utf8_text.sql`. Rollbacks en `database/migrations/down/`.
- Estado final de la BD canónica: 30 tablas, 12 productos reales, 23 categorías, 6 servicios reales, 6 roles, 18 permisos y 43 asignaciones `rol_permiso`.

> Nota: el roadmap inicial no enumeraba los títulos de las misiones 04–15. Se registran a continuación según el trabajo ejecutado y verificado, sin atribuirles nombres que no estuvieran documentados previamente.

## MISIONES 04–15 — COMPLETADAS

| Misión | Área | Resultado verificable |
|---|---|---|
| 04 | Seguridad y compatibilidad | CSRF en formularios/APIs, POST para acciones destructivas, borrado lógico, sesiones regeneradas, permisos en BD y módulos heredados funcionando. |
| 05 | Catálogo y carrito | `shop/index.php`, `catalog.php`, `product.php`, `cart.php` con filtros, paginación real, imágenes/specs y carrito DB-backed con deshacer. |
| 06 | Checkout, pedidos y comprobante | `checkout.php`, `success.php`, `receipt.php`, `api/cart.php`, `modules/orders/`; transacciones, stock atómico, garantías y PNG válido. |
| 07 | Portal del cliente y soporte | `shop/portal.php`, `modules/support/view.php`; pedidos, reparaciones, tickets, perfil/avatars, historial de chat y aislamiento por cliente. |
| 08 | Reparaciones | `modules/repairs/` + `shop/repair_request.php`; 13 estados, presupuesto, aprobación del cliente, repuestos con stock transaccional e historial/auditoría. |
| 09 | Inventario y compras | `modules/inventory/index.php`; movimientos atómicos, alertas, proveedores, compras y costo promedio ponderado. |
| 10 | Reportes | `modules/reports/index.php`; KPIs reales, gráficos SVG generados en PHP y CSV con BOM/escape de fórmulas. |
| 11 | Asistente Gemma local | `api/ai.php` + `ai_service/`; contrato HTTP, auth Bearer fail-closed, guard de sistema, timeout, fallback etiquetado y sin secretos en el repo. |
| 12 | Administración y roles | Dashboard y módulos heredados endurecidos; alta/edición de roles, permisos y configuración desde BD. |
| 13 | Hardening integral | Revisión de todos los PHP, formularios y rutas: 0 fallos de lint, 15/15 pantallas administrativas sin errores PHP, 403 efectivo para cliente en módulos de personal. |
| 14 | QA extremo a extremo | Flujo completo automatizado con cuentas `qa.*`: CSRF, carrito, checkout, PNG, portal, reparación/aprobación, ticket con nota interna, IA y control de acceso. |
| 15 | Documentación, limpieza y revisión visual | Guías de módulos, README del servicio IA, este roadmap actualizado, datos QA borrados, stock restaurado y revisión visual en navegador que detectó y corrigió los 404 de imágenes, el texto `??` y el estado del chat. |

### Detalle de la misión 14 (prueba end-to-end)

Ejecutada con `php -S 127.0.0.1:8000 -t 'D:\GAlAX PC REPAIR'` y `GALAX_SITE_URL=http://127.0.0.1:8000` por el junction roto de Apache:

```
LOGIN qa.cliente@galax.local: OK
LOGIN qa.admin@galax.local: OK
CSRF_SIN_TOKEN_HTTP: 419
CART_ADD: ok=True count=1 total=S/ 3,420.82
CHECKOUT_LOCATION: .../shop/success.php?pedido=3
SUCCESS_PAGE: OK PED-261120-4FBF9
RECEIPT_PNG: 200 7353 | 640x786 type=3 mime=image/png
PORTAL_PEDIDO: OK
REPAIR_CREATE_LOCATION: .../modules/repairs/view.php?id=19
REPAIR_BUDGET_VISIBLE_CLIENTE: OK
REPAIR_APPROVED: OK
TICKET_ID: 2
TICKET_NOTA_INTERNA_OCULTA: OK
TICKET_NOTA_INTERNA_STAFF: OK
AI_MODE: busqueda_local
AI_OK: True
AI_NOTICE: El modelo local no está configurado en este servidor.
CLIENTE_MODULO_PRODUCTOS_HTTP: 403
```

También se verificó: 15/15 páginas administrativas en HTTP 200 sin `Fatal/Parse/Warning/Notice/Deprecated`; exportación CSV con `Content-Type: text/csv`, `Content-Disposition: attachment` y BOM UTF-8; `api/ai.php?health=1` → HTTP 200/86 bytes; lint PHP completo con `LINT_FAILURES=0`.

## Decisiones técnicas

- D1: `ventas_informatica` es la BD canónica; `galax pc repair` se conserva intacta.
- D2: Los 100 productos DEMO de `galax pc repair` no se importan al catálogo público.
- D3: Comprobante PNG generado en PHP puro (PNG truecolor + zlib + tipografía bitmap) porque GD está deshabilitado. Validado como PNG 640×786, `type=3`.
- D4: Servicio Gemma con `transformers>=5.5.0.dev0,<6` + `AutoModelForMultimodalLM`; ruta por `GEMMA_MODEL_PATH`; una sola carga por proceso; pesos nunca copiados al proyecto.
- D5: Token del servicio IA sólo en el servidor PHP; el navegador nunca recibe la credencial. `/chat` falla cerrado si no hay token.
- D6: Evolución compatible: capa de seguridad/compatibilidad en `includes/security.php` + `includes/auth.php`, layouts nuevos y módulos heredados conservados.
- D7: Pruebas HTTP con `php -S` por el junction roto de Apache. Servidor IA en 8501 para no colisionar con el puerto 8000 de PHP.
- D8: `categorias.slug` se agregó rerrejecutando `001_platform_core.sql`.
- D9: Los tickets no se borran físicamente; se archivan como `cerrado` para conservar historial.
- D10: En POS y checkout, precios/stock/totales se releen en MySQL; el navegador sólo envía identificadores y cantidades.
- D11: Separación real Cliente/Personal mediante migración 003: al rol Cliente se le retiraron `dashboard`, `productos` y `soporte` tanto en `rol_permiso` como en el CSV heredado. Antes un cliente podía entrar al CRUD de productos (HTTP 200); después recibe 403.
- D12: Los datos creados por QA se eliminaron con `database/maintenance/limpiar_qa_20261120.sql` y se restauró el stock descontado (LAP-001 10→12, LAP-002 7→8), verificando contra el backup original.
- D13: Los 12 SVG reales de productos se recuperaron del proyecto original (`C:\xampp\htdocs\IDK\PROYECTO DE PEDRO\assets\img\productos\`) y se copiaron a `assets/img/productos/`. `product_image_url()` resuelve en un solo lugar las rutas relativas heredadas y los uploads `upload:`, evitando el doble prefijo `assets/uploads/` y la codificación de barras. Si el archivo no existe se usa `assets/img/product-placeholder.svg`, sin inventar productos.
- D14: Los archivos SQL se aplican con `database/maintenance/apply_sql_utf8.php` (lectura de bytes UTF-8 + PDO `utf8mb4`). La migración `004_repair_utf8_text.sql` restauró 35 celdas y 3 slugs dañados por la aplicación previa de la migración 002 desde PowerShell 5.1 en codificación ANSI.
- D15: El logo de la tienda usa el recurso real `assets/img/logo.jpeg` (copy de `docs/logo/logo.jpeg`, verified 1254×1254, `image/jpeg`). El `imagen` heredado de los productos se reemplazó así por producto real: id 1 `Laptop HP Pavilion 15` → `assets/img/productos/LAP-001.png`; id 2 `Laptop Lenovo IdeaPad 3` → `assets/img/productos/LAP-002.png`. Los PNGs fueron copiados de `docs/producto/` y verificados (`LAP-001.png` 1024×1024, 749.183 B; `LAP-002.png` 1024×1024, 1.026.311 B).

## Errores encontrados y corregidos

1. `api/ai.php` concatenaba con `+` en una construcción de texto (`+` → `.`); corregido.
2. `getConfig()` no existía como alias en la capa nueva; corregido.
3. Enlace roto de `modules/support/index.php` al portal (`shop/portal.php?tab=tickets`); corregido.
4. Formulario de `modules/categories/index.php` sin `csrf_field()`; corregido.
5. El resumen del checkout mostraba envío 0 aunque `place_order()` cobraba domicilio; `cart_totals()` acepta ahora el método de entrega y muestra el mismo cargo que el backend.
6. Comprobante y detalle de pedido para invitados: se agregó una autorización de sesión de 24 h (`ultimo_pedido_invitado`) sin exponer el pedido a terceros.
7. Escalada de privilegios del rol Cliente (D11): corregida con migración reversible 003.
8. El indicador del chat mostraba «Búsqueda local» como si el modelo estuviera listo; ahora distingue explícitamente «Búsqueda local (IA no disponible)».
9. Puerto por defecto del servicio IA cambiado de 8000 a 8501 para evitar el servidor de pruebas PHP; documentado en `ai_service/README.md` y `config.example.env`.
10. Problemas del guion de QA (comillas JSON de PowerShell, URL del POST de soporte y verificación de PNG) se corrigieron en el propio guion; no eran fallos de la aplicación.
11. Imágenes 404 en la tienda: las rutas heredadas `assets/img/productos/*.svg` se estaban anteponiendo a `assets/uploads/` y codificando las barras; corregido con D13. Los SVG existían en el proyecto original y se copiaron al árbol actual.
12. Texto `??` en 35 celdas sembradas por la migración 002: no era un problema de la página sino de codificación al aplicar el SQL; corregido con D14. Los slugs `fuentes-de-alimentacian`, `audafonos` y `refrigeracian` también se regeneraron.
13. El indicador del chat mostraba el código inglés `unavailable`; ahora muestra «Búsqueda local (IA no disponible)».

## Pruebas ejecutadas

- Inventario inicial de archivos, extensiones PHP, MariaDB/Ambas BD y metadatos del modelo Gemma.
- Backup físico previo a migraciones y rerrejecución idempotente de migraciones 001/002; migración 003 aplicada después del hallazgo de permisos.
- Lint recursivo de todos los PHP del proyecto: `LINT_FAILURES=0`.
- Barrido HTTP con sesión administrativa de 15 rutas: `BAD=0`.
- Exportación CSV real con cabeceras y BOM; parámetro correcto `export=csv` (una prueba inicial con `export=1` devolvió HTML y se corrigió la prueba).
- Flujo end-to-end completo indicado arriba, con comprobante PNG decodificado por `getimagesize()`.
- Verificación final de BD: 30 tablas, 12 productos, 23 categorías, 6 servicios, 6 roles, 18 permisos, 43 asignaciones, 5 migraciones, 0 pedidos/reparaciones/tickets/IA/carritos de prueba, 5 usuarios y 3 clientes originales.
- `api/ai.php?health=1`: HTTP 200/86 bytes; el servicio de inferencia local sigue **no ejecutado** y la respuesta de chat se etiqueta como búsqueda local.

### Revisión visual en navegador (2026-11-20)

Se abrieron en el navegador integrado `shop/index.php`, `shop/catalog.php`, `shop/product.php?id=1`, `shop/cart.php` y `shop/repair_request.php`, con capturas visibles para el usuario:

- Antes: 7 SVG con HTTP 404 y textos `Aud??fonos`, `Reparaci??n`, etc.
- Después: 0 imágenes rotas (todas con `naturalWidth > 0` tras forzar `loading="eager"`), 0 secuencias `??` en el texto visible y 0 errores de consola.
- El catálogo muestra las 23 categorías con acentos reales; el detalle de producto y las tarjetas relacionadas cargan sus SVG originales.
- El widget del chat abrió correctamente, mostró «Búsqueda local (IA no disponible)» y renderizó las 3 imágenes de producto devueltas por la búsqueda local sin errores.
- `shop/repair_request.php` redirige a/login como corresponde a una ruta que requiere autenticación.

## Bloqueos reales

- B1: No hay intérprete Python funcional (`python`/`python3` son alias de Microsoft Store) → no se ejecutaron `py_compile`, unit tests ni inferencia. Se entrega código, contrato HTTP y tests, pero **no se afirma** que el servicio esté funcionando.
- B2: ~8.5 GB de RAM y 15,99 GB de pesos Gemma en bfloat16 sin GPU → carga completa inviable en este entorno. Cuantización/llama.cpp queda como opción futura no verificada.
- B3: GD deshabilitado en `php.ini` → mitigado con el generador PNG propio (D3).
- B4: `C:\xampp\htdocs\galax_pc_repair` es un junction roto → las pruebas HTTP se hicieron con `php -S`, no con Apache.
- B5: El proyecto no está bajo control de versiones → no hay commit que identifique este estado; los cambios están en el árbol de trabajo.

## SESIÓN 2026-11-20 (tarde) — Migración de entorno y correcciones

### Contexto

Este workspace (`F:\GALAX PC REPAIR`) es una copia del proyecto en un equipo
distinto al que generó el roadmap original (`D:\GAlAX PC REPAIR`). La base de
datos MySQL local estaba **vacía**: no existía `ventas_informatica` ni
`galax pc repair`. Se restauró la BD canónica desde
`database/backups/ventas_informatica_20261120_160328.sql` (estado previo a las
migraciones de plataforma) y se reaplicaron `001_platform_core.sql`,
`002_seed_reference_data.sql`, `003_restrict_client_permissions.sql` y
`004_repair_utf8_text.sql`. Estado final verificado: 30 tablas, 12 productos,
23 categorías, 6 servicios, 6 roles, 18 permisos, 43 asignaciones, 5
migraciones, 0 productos DEMO.

### Cambios de entorno detectados

- Python 3.12.10 real ahora instalado
  (`C:\Users\Supremo-Pride\AppData\Local\Programs\Python\Python312\python.exe`).
  Antes era solo el alias de Microsoft Store.
- RAM del equipo: ~16 GB totales (~10 GB libres), sin GPU.
- MySQL/MariaDB y Apache de XAMPP presentes; MySQL se inició manualmente.

### Errores encontrados y corregidos (esta sesión)

1. **`database/maintenance/apply_sql_utf8.php`**: el splitter SQL no entendía
   la directiva `DELIMITER` (rompía `CREATE PROCEDURE` de la migración 001) y
   `commit()`/`rollBack()` fallaban porque el DDL de MySQL confirma de forma
   implícita. Se añadió soporte de bloques DELIMITER mediante placeholders
   opacos y commit/rollback defensivos. Verificado: las 4 migraciones se
   reaplican idempotentemente con `APPLIED=39/10/4/40`.
2. **`includes/repository.php` → `cart_undo()`**: off-by-one. Restauraba
   `rows[1]` (estado previo a la penúltima acción) en lugar de `rows[0]`
   (estado previo a la última acción), deshaciendo dos acciones por undo.
   Corregido a `LIMIT 1` + `rows[0]`; `shop/cart.php` ajustado a `>= 1`.
   Verificado: add→remove→undo restaura; segundo undo rehace.
3. **`shop/repair_request.php`**: incluía solo `functions.php`; el header de
   tienda llama a `product_image_url()` (en `repository.php`) → Fatal error.
   Corregido a `require repository.php`. Página 200 y POST crea
   `REP-261120-23544` correctamente.
4. **`includes/repository.php` → `catalog_products()`**: mezclaba placeholders
   posicionales `?` con nombrados `:lim`/`:off` → `PDOException HY093` en
   cualquier búsqueda (`?q=`). Corregido a posicionales. Verificado:
   `?q=ssd`, `?q=memoria ram`, `?cat=`, `?min/max`, `?disponibilidad`,
   `?orden`, `?page` → todos 200 sin errores.
5. **`dashboard/index.php`**: solo `requireLogin()` → un Cliente veía KPIs
   administrativos (ventas, clientes, reparaciones). Cambiado a
   `requirePermission('dashboard')`. Verificado: cliente 403, admin 200.
6. **`includes/repository.php` → `ai_catalog_search()`**: exigía AND de todos
   los términos → "busco una laptop para estudiar" no devolvía nada. Se
   añadieron stopwords del español y búsqueda OR con ranking `_score`.
   Verificado: devuelve las 3 laptops reales con precio/stock.

### Pruebas ejecutadas (esta sesión)

- `php -l` recursivo: 49 archivos, 0 fallos.
- `python -m py_compile server.py test_contract.py`: OK.
- `python -m unittest -v test_contract`: **25/25 tests OK** (antes no se
  podían ejecutar por falta de Python).
- Login admin y cliente (CSRF + POST): 302 correctos.
- 11 páginas admin autenticadas: 200. Rutas protegidas sin sesión: 302→login.
- Carrito: add/update/remove/clear/undo vía `api/cart.php` con CSRF.
- Checkout completo: pedido `PED-261120-8EA4A`, stock MON-001 15→13,
  total S/ 1,649.64 (IGV 18%), comprobante PNG 6.901 B firma `‰PNG` válida.
- Reparación: `REP-261120-23544` creada desde la tienda, vista 200.
- Aislamiento: cliente → 403 en products/repairs/inventory/reports/orders/
  dashboard y en `repairs/view.php?id=1` ajeno.
- IA: `api/ai.php?health=1` → 200; POST chat → `mode: busqueda_local` honesto
  con productos reales tras la mejora de búsqueda.
- Catálogo: 7 combinaciones de filtros/paginación → 200 sin errores.
- Datos de prueba eliminados; stock restaurado (MON-001 = 15); 0 pedidos,
  0 reparaciones, 3 clientes originales.
- `tests/smoke.php` creado (22 comprobaciones HTTP: públicas 200, protegidas
  302, contenido, búsqueda sin HY093, health IA JSON) → **22 PASS / 0 FAIL**.
- `README.md` reescrito: instalacion real con backup+migraciones, variables de
  entorno, credenciales demo, estructura y pruebas.

### Estado del servicio Gemma (actualizado)

- `py_compile` y los 25 tests de contrato ahora **sí se ejecutan** (Python real).
- `transformers`/`torch` **no instalados**: PyPI solo ofrece transformers
  ≤ 4.50.3; el modelo requiere `>=5.5.0.dev0` (versión dev, probablemente
  solo vía GitHub). Además el modelo pesa ~16 GB en bfloat16 y el equipo
  tiene ~16 GB de RAM total (~10 GB libres) sin GPU → la carga completa
  sigue siendo inviable. **La inferencia real permanece bloqueada por
  hardware/dependencias**; el sistema nunca la simula y etiqueta las
  respuestas como `busqueda_local`.
- Camino viable documentado: instalar transformers desde GitHub main +
  torch CPU, y evaluar cuantización (GGUF/llama.cpp no soporta gemma4 aún;
  bitsandbytes no oficial en Windows) o más RAM/GPU.

### Pendiente / limitaciones reales

- Inferencia Gemma no ejecutada (ver arriba).
- Apache no configurado en este equipo; las pruebas usan `php -S`.
- `galax pc repair` (BD legacy con 100 productos DEMO) no existe en este
  MySQL; solo se restauró la BD canónica.
- No hay control de versiones (git) en el proyecto.

## Estado de entrega

Funcionan y están verificados en este entorno: autenticación/perfiles, permisos por rol, catálogo (con imágenes y acentos reales), carrito, checkout transaccional, pedidos, comprobantes PNG, portal del cliente, tickets con aislamiento, reparaciones con aprobación, inventario, reportes/CSV y el fallback honesto del asistente, incluyendo revisión visual en navegador.

No verificado por bloqueo de entorno: inferencia real de Gemma 4 E4B IT. El sistema nunca la simula; informa `modo: busqueda_local` cuando el modelo no está disponible.

