# GALAX PC REPAIR

Plataforma web de comercio electrónico y servicios informáticos: venta de
computadoras, laptops, componentes, periféricos y accesorios; ensamblaje;
mantenimiento y reparación técnica; diagnóstico; posventa; y asistente de
inteligencia artificial con modelo local Gemma.

- **Backend:** PHP 8.2 + MySQL/MariaDB (PDO, consultas preparadas).
- **Frontend:** HTML + CSS propio (`assets/css/theme.css`) + Font Awesome + JS vanilla.
- **IA:** servicio local Python (`ai_service/`) que expone el modelo
  `gemma-4-E4B-it` por HTTP; si el modelo no está disponible, el asistente
  responde con búsqueda real del catálogo etiquetada como `busqueda_local`
  (nunca simula al modelo).

## Requisitos

- PHP 8.1+ con extensiones `pdo_mysql`, `mbstring`, `curl`, `fileinfo`, `openssl`.
- MySQL 5.7+ / MariaDB 10.4+.
- Python 3.10+ (solo para el servicio de IA; opcional para la tienda).

## Instalación

1. Copia la carpeta a `htdocs/galax_pc_repair` (XAMPP) o configura un virtual host.
2. Crea la base de datos e importa el esquema. Opción A (recomendada, incluye
   todo el núcleo comercial):

   ```bat
   C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE ventas_informatica DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 ventas_informatica -e "source database/backups/ventas_informatica_20261120_160328.sql"
   C:\xampp\php\php.exe database\maintenance\apply_sql_utf8.php database\migrations\001_platform_core.sql
   C:\xampp\php\php.exe database\maintenance\apply_sql_utf8.php database\migrations\002_seed_reference_data.sql
   C:\xampp\php\php.exe database\maintenance\apply_sql_utf8.php database\migrations\003_restrict_client_permissions.sql
   C:\xampp\php\php.exe database\maintenance\apply_sql_utf8.php database\migrations\004_repair_utf8_text.sql
   ```

   Opción B (esquema inicial heredado, sin el núcleo comercial): importar
   `database.sql` en phpMyAdmin y aplicar las migraciones de
   `database/migrations/` en orden con el mismo script.

3. Ajusta credenciales por variables de entorno si no usas root sin password:

   | Variable | Defecto |
   |---|---|
   | `GALAX_DB_HOST` / `GALAX_DB_NAME` / `GALAX_DB_USER` / `GALAX_DB_PASS` | localhost / ventas_informatica / root / (vacío) |
   | `GALAX_SITE_URL` | `http://localhost/galax_pc_repair` |
   | `GALAX_SITE_NAME` | `GALAX PC REPAIR` |
   | `GEMMA_API_TOKEN` | (vacío → `/chat` del servicio IA cerrado) |

4. Accede a la tienda: `http://localhost/galax_pc_repair/` (redirige a `shop/`).

## Credenciales de demostración (password: `admin123`)

| Email | Rol |
|---|---|
| `admin@ventas.com` | Administrador |
| `vendedor@ventas.com` | Vendedor |
| `soporte@ventas.com` | Soporte |
| `cliente@ventas.com` | Cliente |

## Estructura

```
config/        Configuración central y PDO
includes/      Seguridad (CSRF, sesiones, permisos), helpers, layouts,
               repositorio de dominio (catálogo, carrito, pedidos,
               reparaciones, inventario, IA) y generador de comprobantes
auth/          Login, registro, logout
shop/          Tienda pública: inicio, catálogo, producto, carrito,
               checkout, comprobante, portal del cliente, reparaciones
modules/       Panel administrativo: productos, categorías, clientes,
               ventas/POS, pedidos, soporte, usuarios, roles,
               configuración, reparaciones, inventario, reportes
dashboard/     Panel de control (permiso `dashboard`)
api/           Endpoints JSON: carrito y asistente IA
ai_service/    Servicio Python de inferencia Gemma (ver su README)
gemma-4-E4B-it/ Pesos del modelo local (NO copiar al repo ni duplicar)
database/      Migraciones, backups y scripts de mantenimiento
docs/          Documentación de módulos y roadmap de implementación
tests/         Pruebas de humo y contrato
```

## Servicio de IA (Gemma local)

Ver `ai_service/README.md` para el contrato HTTP, variables de entorno y
limitaciones de hardware. Resumen:

```bat
cd ai_service
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
set GEMMA_MODEL_PATH=F:\GALAX PC REPAIR\gemma-4-E4B-it
set GEMMA_API_TOKEN=<token-largo-aleatorio>
start_gemma.bat
```

El token vive solo en el servidor PHP (`GEMMA_API_TOKEN`); el navegador nunca
lo recibe. Si el servicio no responde, `api/ai.php` devuelve
`mode: busqueda_local` con productos reales del catálogo.

## Pruebas

```bat
:: Lint de todo el PHP
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { C:\xampp\php\php.exe -l $_.FullName }

:: Contrato del servicio IA (sin modelo)
cd ai_service && python -m unittest -v test_contract

:: Humo HTTP (requiere servidor: php -S 127.0.0.1:8000 -t .)
C:\xampp\php\php.exe tests\smoke.php http://127.0.0.1:8000
```

## Notas

- Los comprobantes PNG son internos de la tienda; la facturación electrónica
  SUNAT requeriría una integración separada con sus credenciales.
- Migraciones reversibles en `database/migrations/down/`.
- No colocar contraseñas reales en este archivo ni en el repositorio.
