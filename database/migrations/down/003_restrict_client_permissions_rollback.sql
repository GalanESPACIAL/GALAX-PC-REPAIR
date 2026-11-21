-- =====================================================================
-- GALAX PC REPAIR — Reversión de la migración 003
-- Restaura la configuración heredada del rol Cliente (NO recomendada en
-- producción: volvería a exponer productos, dashboard y soporte al cliente).
-- =====================================================================
SET NAMES utf8mb4;

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM roles r JOIN permisos p
 WHERE r.nombre = 'Cliente'
   AND p.codigo IN ('dashboard', 'productos', 'soporte');

UPDATE roles
   SET permisos = 'dashboard,productos,soporte,mis_compras'
 WHERE nombre = 'Cliente'
   AND permisos = 'mis_compras,mis_pedidos,mis_reparaciones';

DELETE FROM `migraciones` WHERE version = '003_restrict_client_permissions.sql';
