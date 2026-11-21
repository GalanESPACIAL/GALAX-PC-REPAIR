-- =====================================================================
-- GALAX PC REPAIR — Migración 004: reparar texto UTF-8 de la siembra 002
-- La migración 002 se aplicó originalmente con una codificación de
-- consola ANSI, por la que los acentos llegaron a MySQL como "??".
-- El archivo 002 sí contiene el texto correcto; esta migración restaura
-- esos valores exactos. Idempotente: sólo actualiza celdas que aún
-- contienen "??", por lo que respeta ediciones legítimas posteriores.
-- Aplicar con: php database/maintenance/apply_sql_utf8.php <este archivo>
-- =====================================================================
SET NAMES utf8mb4;

UPDATE `categorias` SET nombre='Tarjetas gráficas'        WHERE id=14 AND nombre LIKE '%?%';
UPDATE `categorias` SET nombre='Fuentes de alimentación' WHERE id=15 AND nombre LIKE '%?%';
UPDATE `categorias` SET nombre='Audífonos'               WHERE id=19 AND nombre LIKE '%?%';
UPDATE `categorias` SET nombre='Refrigeración'           WHERE id=23 AND nombre LIKE '%?%';

UPDATE `categorias` SET descripcion='Módulos de memoria'                              WHERE id=11 AND descripcion LIKE '%?%';
UPDATE `categorias` SET descripcion='Unidades de estado sólido'                       WHERE id=12 AND descripcion LIKE '%?%';
UPDATE `categorias` SET descripcion='Unidades mecánicas de almacenamiento'            WHERE id=13 AND descripcion LIKE '%?%';
UPDATE `categorias` SET descripcion='GPU y aceleradores gráficos'                     WHERE id=14 AND descripcion LIKE '%?%';
UPDATE `categorias` SET descripcion='Teclados mecánicos y de membrana'                WHERE id=17 AND descripcion LIKE '%?%';
UPDATE `categorias` SET descripcion='Ventiladores, disipadores y pasta térmica'       WHERE id=23 AND descripcion LIKE '%?%';
UPDATE `categorias` SET descripcion='Herramientas y repuestos técnicos'               WHERE id=24 AND descripcion LIKE '%?%';

UPDATE `categorias` SET slug='fuentes-de-alimentacion' WHERE id=15 AND slug='fuentes-de-alimentacian';
UPDATE `categorias` SET slug='audifonos'               WHERE id=19 AND slug='audafonos';
UPDATE `categorias` SET slug='refrigeracion'           WHERE id=23 AND slug='refrigeracian';

UPDATE `configuracion` SET descripcion='URL pública de la tienda'                    WHERE id=12 AND descripcion LIKE '%?%';
UPDATE `configuracion` SET descripcion='Costo de envío a domicilio en PEN'            WHERE id=13 AND descripcion LIKE '%?%';
UPDATE `configuracion` SET descripcion='Días de conservación del historial del chat' WHERE id=15 AND descripcion LIKE '%?%';
UPDATE `configuracion` SET descripcion='Segundos de espera máxima para el modelo'    WHERE id=17 AND descripcion LIKE '%?%';
UPDATE `configuracion` SET descripcion='Política de privacidad del chat'              WHERE id=19 AND descripcion LIKE '%?%';
UPDATE `configuracion` SET valor='Tecnología que funciona. Servicio en el que confía.' WHERE id=18 AND valor LIKE '%?%';
UPDATE `configuracion` SET valor='El historial del chat se conserva según la configuración del sistema y puede eliminarse desde el perfil.' WHERE id=19 AND valor LIKE '%?%';

UPDATE `permisos` SET descripcion='Gestión de pedidos de la tienda'        WHERE id=11 AND descripcion LIKE '%?%';
UPDATE `permisos` SET descripcion='Gestión de órdenes de reparación'       WHERE id=12 AND descripcion LIKE '%?%';
UPDATE `permisos` SET descripcion='Configuración del asistente'            WHERE id=15 AND descripcion LIKE '%?%';
UPDATE `permisos` SET descripcion='Gestión de devoluciones'                WHERE id=18 AND descripcion LIKE '%?%';

UPDATE `roles` SET nombre='Técnico'                          WHERE id=5 AND nombre LIKE '%?%';
UPDATE `roles` SET descripcion='Gestión de reparaciones e inventario' WHERE id=5 AND descripcion LIKE '%?%';
UPDATE `roles` SET descripcion='Operaciones comerciales y atención'     WHERE id=6 AND descripcion LIKE '%?%';

UPDATE `servicios` SET nombre='Reparación de PC y laptops' WHERE id=1 AND nombre LIKE '%?%';
UPDATE `servicios` SET nombre='Formateo e instalación'     WHERE id=3 AND nombre LIKE '%?%';
UPDATE `servicios` SET nombre='Instalación de redes'       WHERE id=5 AND nombre LIKE '%?%';
UPDATE `servicios` SET nombre='Diagnóstico electrónico'    WHERE id=6 AND nombre LIKE '%?%';

UPDATE `servicios` SET descripcion='Diagnóstico y reparación de fallas de hardware, arranque, pantalla y componentes.' WHERE id=1 AND descripcion LIKE '%?%';
UPDATE `servicios` SET descripcion='Revisión electrónica y reparación especializada de placas y conectores.' WHERE id=2 AND descripcion LIKE '%?%';
UPDATE `servicios` SET descripcion='Instalación y configuración del sistema operativo y programas esenciales.' WHERE id=3 AND descripcion LIKE '%?%';
UPDATE `servicios` SET descripcion='Limpieza interna, cuidado térmico y puesta a punto para prolongar la vida útil.' WHERE id=4 AND descripcion LIKE '%?%';
UPDATE `servicios` SET descripcion='Configuración de redes cableadas e inalámbricas para hogares y negocios.' WHERE id=5 AND descripcion LIKE '%?%';
UPDATE `servicios` SET descripcion='Evaluación técnica para identificar el origen de la falla y recomendar una solución.' WHERE id=6 AND descripcion LIKE '%?%';

INSERT INTO `migraciones` (version, aplicada_at) VALUES ('004_repair_utf8_text.sql', NOW())
  ON DUPLICATE KEY UPDATE aplicada_at = aplicada_at;
