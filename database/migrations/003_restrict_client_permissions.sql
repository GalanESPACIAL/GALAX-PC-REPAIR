-- =====================================================================
-- GALAX PC REPAIR — Migración 003: separación real Cliente / Personal
-- Idempotente y reversible (ver down/003_restrict_client_permissions_rollback.sql).
--
-- La migración 002 sólo asignó permisos propios al rol Cliente, pero el rol
-- heredado conservaba 'dashboard', 'productos' y 'soporte' en rol_permiso y en
-- el CSV roles.permisos. Eso permitía a un cliente entrar al CRUD de productos
-- y al panel de tickets. Esta migración elimina esa escalada de privilegios.
-- =====================================================================
SET NAMES utf8mb4;

DELETE rp FROM rol_permiso rp
JOIN roles r ON r.id = rp.rol_id
JOIN permisos p ON p.id = rp.permiso_id
WHERE r.nombre = 'Cliente'
  AND p.codigo IN ('dashboard', 'productos', 'soporte');

UPDATE roles
   SET permisos = 'mis_compras,mis_pedidos,mis_reparaciones'
 WHERE nombre = 'Cliente'
   AND permisos <> 'mis_compras,mis_pedidos,mis_reparaciones';

INSERT INTO `migraciones` (version, aplicada_at) VALUES ('003_restrict_client_permissions.sql', NOW())
  ON DUPLICATE KEY UPDATE aplicada_at = aplicada_at;
