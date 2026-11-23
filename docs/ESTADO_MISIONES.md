# GALAX PC REPAIR — Estado de misiones (seguimiento de desarrollo)

> documento vivo. Actualizado: 2026-11-22.
> Regla: una misión solo se marca COMPLETADA si está implementada y probada.

## Etapa / Fase / Misión actual

- **Etapa:** 1 (Diagnóstico) + migración a Supabase en curso.
- **Fase actual:** 1.2 (planificación) y 3.1 (editor de página) ejecutadas; migración de infraestructura en progreso.
- **Misión actual:** Migración a Supabase (PostgreSQL + Auth + Storage) y rediseño visual.

## Misiones completadas (verificadas)

| Misión | Resultado comprobable |
|---|---|
| Diagnóstico inicial | Inventario completo; hallazgo: el proyecto usaba PHP/MySQL, sin Supabase. |
| Copia y publicación | Repositorio GitHub verificado y commit `1804cf5` subido; enlaces públicos confirmados. |
| Eliminación de backup externo | `F:\GALAX PC REPAIR_BACKUPS` eliminado por instrucción del usuario. |
| Driver PostgreSQL | `pdo_pgsql` y `pgsql` habilitados en PHP (`php -m` verificado). |
| Capa Supabase | `config/supabase.php`: Auth, Storage y REST con claves solo por entorno. |
| Conexión BD | `config/database.php` conecta a PostgreSQL de Supabase cuando hay credenciales. |
| Traducción SQL | `ON DUPLICATE KEY`, `INSERT IGNORE`, `LIMIT ?,?`, `DATE_ADD`, `DATE_FORMAT`, `MONTH/YEAR` adaptados. |
| Auth Supabase | Registro ≥16 caracteres, perfil separado, recuperación, login con token en sesión. |
| Storage de imágenes | `includes/uploads.php`; productos y editor suben imágenes a Supabase Storage. |
| Editor de página web | `modules/page_editor/` con banners, textos, secciones, ofertas, WhatsApp y tesis. |
| Rediseño de inicio | `shop/index.php`: banner, ofertas,CTA de WhatsApp y sección "SOBRE EL PROYECTO". |
| Catálogo promocional | Productos con `precio_oferta`, `destacado`, `es_nuevo` editables desde el panel. |
| Lint PHP | 53 archivos PHP analizados con `php -l`: 0 fallos (antes de los últimos cambios). |

## Misiones pendientes

1. **Credenciales de Supabase** (bloqueante): URL, `anon key`, `service_role key` y datos de conexión PostgreSQL. Sin ellos no se pueden ejecutar migraciones ni probar la app en Supabase.
2. Ejecutar `database/supabase/001_schema_postgres.sql`, `002_seed_postgres.sql` y `005_supabase_page_editor.sql` en el SQL Editor de Supabase.
3. Crear el bucket de Storage (público) indicado en `SUPABASE_STORAGE_BUCKET`.
4. Configurar confirmación de correo y SMTP en Supabase Auth.
5. Revisar/ajustar las políticas RLS por tabla y probar acceso anon/autenticado/service_role.
6. Adaptar `modules/users/` para gestionar usuarios mediante Supabase Admin API (sin contraseñas en BD).
7. Pruebas end-to-end con Supabase: registro, confirmación, login, carrito, checkout, inventario, imágenes.
8. Revisión visual en navegador y responsive.
9. Subir todos los avances a GitHub.

## Errores detectados

- El proyecto no contenía Supabase; se decidió migración por instrucción del usuario.
- `pdo_pgsql` estaba deshabilitado; corregido en `php.ini`.
- En este equipo la BD MySQL `ventas_informatica` no existe; las fuentes de datos son los SQL del repo.
- No hay sistema de cupones (la instrucción de eliminar cupones era un no-op); se conservan los precios promocionales normales.

## Cambios realizados (resumen)

- Nuevos: `config/supabase.php`, `.env.example`, `includes/uploads.php`, `auth/recover.php`, `modules/page_editor/index.php`, `database/supabase/*`, `database/migrations/005_supabase_page_editor.sql`, `docs/ESTADO_MISIONES.md`.
- Modificados: `config/database.php`, `includes/security.php`, `includes/repository.php`, `includes/functions.php`, `includes/header.php`, `auth/register.php`, `auth/login.php`, `modules/products/*`, `modules/orders/index.php`, `modules/inventory/index.php`, `modules/settings/index.php`, `modules/roles/index.php`, `modules/reports/index.php`, `shop/index.php`, `assets/css/theme.css`, `.gitignore`, `README.md`.

## Pruebas superadas

- `git ls-remote` y verificación pública de los enlaces de GitHub y Pages.
- `git diff` de contenido local vs remoto: 0 diferencias reales.
- `php -m`: `pdo_pgsql` y `pgsql` activos.
- `php -l` recursivo: 53 archivos sin errores de sintaxis (hasta el punto indicado).

## Auditoría responsive (2026-11-22) — COMPLETADA

- Suite Playwright: `tests/responsive.spec.js` (8 viewports) → **8/8 PASS**.
- Verificación específica de Airi: `tests/airi.spec.js` (1440×900, 768×1024, 375×812) → **3/3 PASS**.
- Correcciones: viewport con `viewport-fit=cover`, `box-sizing` global, `max-width:100%` en medios, paddings fluidos `clamp()`, `100dvh`, targets táctiles ≥44px, safe areas, tablas con scroll, cierre del menú móvil con Escape/click fuera, y layout final de Airi en grid (260px + 1fr en desktop; 180px + 1fr en móvil).
- Corrección adicional: avatar de Airi restaurado (fallback visível hasta que el GLB renderiza, z-index y resize en `requestAnimationFrame` al abrir), mojibake eliminado y archivos guardados en UTF-8 sin BOM, burbuja de bienvenida compacta.
- Comando: `node tests/responsive.spec.js` y `node tests/airi.spec.js` (requiere `npm install --no-save playwright@1.65.1` y servidor en `:8099`).

## Próximas tareas

1. Obtener credenciales Supabase del usuario.
2. Aplicar esquemas y semilla; verificar 30 tablas y datos reales.
3. Probar registro/login/recuperación y subida de imágenes.
4. Ejecutar `tests/smoke.php` contra el entorno Supabase.
5. Actualizar este documento y hacer commit/push final.
