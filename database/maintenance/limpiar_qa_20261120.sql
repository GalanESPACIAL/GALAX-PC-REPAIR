-- =====================================================================
-- GALAX PC REPAIR — Limpieza de datos de QA (2026-11-20)
-- Elimina SOLO los registros creados por las pruebas automatizadas y
-- restaura el stock descontado por esos pedidos. No toca clientes,
-- usuarios, productos, ventas ni configuración originales.
-- Reversible únicamente desde el backup:
-- database/backups/ventas_informatica_20261120_160328.sql
-- =====================================================================
SET NAMES utf8mb4;
START TRANSACTION;

DELETE FROM respuestas_tickets WHERE ticket_id IN (1, 2);
DELETE FROM tickets WHERE id IN (1, 2);

DELETE FROM reparacion_historial WHERE reparacion_id IN (18, 19);
DELETE FROM reparacion_repuestos WHERE reparacion_id IN (18, 19);
DELETE FROM reparaciones WHERE id IN (18, 19);

DELETE FROM garantias WHERE pedido_id IN (1, 2, 3);
DELETE FROM pedido_detalles WHERE pedido_id IN (1, 2, 3);
DELETE FROM pedidos WHERE id IN (1, 2, 3);

DELETE FROM inventario_movimientos
 WHERE documento IN ('PED-261120-C2B9D','PED-261120-CADFF','PED-261120-4FBF9');

DELETE FROM ai_mensajes
 WHERE conversacion_id IN (SELECT id FROM ai_conversaciones WHERE usuario_id = 7);
DELETE FROM ai_conversaciones WHERE usuario_id = 7;

-- No existían carritos en el backup previo: todos los actuales son de QA.
DELETE FROM carrito_historial WHERE carrito_id IN (SELECT id FROM carritos);
DELETE FROM carrito_items WHERE carrito_id IN (SELECT id FROM carritos);
DELETE FROM carritos;

DELETE FROM audit_log WHERE id >= 6;

-- Restauración condicional: sólo si el stock sigue con el valor posterior
-- a los pedidos de prueba, para no sobrescribir movimientos legítimos.
UPDATE productos SET stock = 12 WHERE id = 1 AND stock = 10;
UPDATE productos SET stock = 8 WHERE id = 2 AND stock = 7;

DELETE FROM usuarios WHERE id IN (6, 7);
DELETE FROM clientes WHERE id IN (11, 12);

COMMIT;
