-- =====================================================================
-- GALAX PC REPAIR — Reversión de las migraciones 001 y 002
-- SOLO PARA DESARROLLO. Elimina los datos nuevos; no afecta a las tablas
-- originales (productos, usuarios, roles, ventas, tickets, etc.).
-- =====================================================================
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `notificaciones`;
DROP TABLE IF EXISTS `ai_mensajes`;
DROP TABLE IF EXISTS `ai_conversaciones`;
DROP TABLE IF EXISTS `compras_proveedor`;
DROP TABLE IF EXISTS `proveedores`;
DROP TABLE IF EXISTS `inventario_movimientos`;
DROP TABLE IF EXISTS `reparacion_repuestos`;
DROP TABLE IF EXISTS `reparacion_historial`;
DROP TABLE IF EXISTS `reparaciones`;
DROP TABLE IF EXISTS `garantias`;
DROP TABLE IF EXISTS `pedido_detalles`;
DROP TABLE IF EXISTS `pedidos`;
DROP TABLE IF EXISTS `carrito_historial`;
DROP TABLE IF EXISTS `carrito_items`;
DROP TABLE IF EXISTS `carritos`;
DROP TABLE IF EXISTS `servicios`;

DELETE FROM `rol_permiso` WHERE permiso_id IN (
  SELECT id FROM permisos WHERE codigo IN
  ('pedidos','reparaciones','inventario','reportes','ia','mis_pedidos','mis_reparaciones','devoluciones')
);
DELETE FROM `permisos` WHERE codigo IN
  ('pedidos','reparaciones','inventario','reportes','ia','mis_pedidos','mis_reparaciones','devoluciones');
DELETE FROM `roles` WHERE nombre IN ('Técnico','Empleado');
DELETE FROM `configuracion` WHERE clave IN
  ('site_url','envio_costo','descuento_promocional','chat_historial_dias','ai_api_url','ai_timeout','eslogan','politica_privacidad');
DELETE FROM `migraciones` WHERE version IN ('001_platform_core.sql','002_seed_reference_data.sql');

ALTER TABLE `categorias` DROP COLUMN IF EXISTS `slug`;

ALTER TABLE `productos`
  DROP COLUMN IF EXISTS `slug`,
  DROP COLUMN IF EXISTS `imagen`,
  DROP COLUMN IF EXISTS `especificaciones`,
  DROP COLUMN IF EXISTS `garantia`,
  DROP COLUMN IF EXISTS `destacado`,
  DROP COLUMN IF EXISTS `es_nuevo`,
  DROP COLUMN IF EXISTS `precio_oferta`,
  DROP COLUMN IF EXISTS `publicado`,
  DROP COLUMN IF EXISTS `tipo`,
  DROP INDEX IF EXISTS `idx_productos_publico`,
  DROP INDEX IF EXISTS `idx_productos_busqueda`;

SET FOREIGN_KEY_CHECKS = 1;
