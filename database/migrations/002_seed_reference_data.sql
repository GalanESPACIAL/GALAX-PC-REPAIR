-- =====================================================================
-- GALAX PC REPAIR — Migración 002: datos de referencia reales
-- Origen: BD heredada `galax pc repair` (servicios y categorías reales).
-- Idempotente. No importa los 100 productos DEMO de la BD heredada.
-- =====================================================================
SET NAMES utf8mb4;

-- Servicios técnicos reales (fuente: `galax pc repair`.tienda_servicios)
INSERT INTO `servicios` (codigo, nombre, descripcion, icono, activo, orden) VALUES
('SRV-001','Reparación de PC y laptops','Diagnóstico y reparación de fallas de hardware, arranque, pantalla y componentes.','fa-laptop',1,1),
('SRV-002','Microsoldadura de placas','Revisión electrónica y reparación especializada de placas y conectores.','fa-microchip',1,2),
('SRV-003','Formateo e instalación','Instalación y configuración del sistema operativo y programas esenciales.','fa-windows',1,3),
('SRV-004','Mantenimiento preventivo','Limpieza interna, cuidado térmico y puesta a punto para prolongar la vida útil.','fa-fan',1,4),
('SRV-005','Instalación de redes','Configuración de redes cableadas e inalámbricas para hogares y negocios.','fa-network-wired',1,5),
('SRV-006','Diagnóstico electrónico','Evaluación técnica para identificar el origen de la falla y recomendar una solución.','fa-chart-simple',1,6)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion);

-- Categorías reales adicionales (fuente: `galax pc repair`.tienda_categorias)
INSERT IGNORE INTO `categorias` (nombre, descripcion, icono, color) VALUES
('Procesadores','Unidades centrales de procesamiento','fa-microchip','#6366f1'),
('Placas madre','Tarjetas madre y chipsets','fa-diagram-project','#0ea5e9'),
('Memorias RAM','Módulos de memoria','fa-memory','#10b981'),
('Discos SSD','Unidades de estado sólido','fa-hard-drive','#f59e0b'),
('Discos HDD','Unidades mecánicas de almacenamiento','fa-hdd','#ef4444'),
('Tarjetas gráficas','GPU y aceleradores gráficos','fa-display','#8b5cf6'),
('Fuentes de alimentación','Fuentes y estabilizadores','fa-plug','#ec4899'),
('Gabinetes','Chasis y torres','fa-computer','#64748b'),
('Teclados','Teclados mecánicos y de membrana','fa-keyboard','#f59e0b'),
('Mouse','Ratones y trackpads','fa-mouse','#0ea5e9'),
('Audífonos','Auriculares y headsets','fa-headphones','#ec4899'),
('Parlantes','Altavoces y barras de sonido','fa-volume-up','#8b5cf6'),
('Impresoras','Impresoras y consumibles','fa-print','#10b981'),
('Routers','Equipos de red y routers','fa-wifi','#6366f1'),
('Refrigeración','Ventiladores, disipadores y pasta térmica','fa-fan','#06b6d4'),
('Componentes y herramientas de mantenimiento','Herramientas y repuestos técnicos','fa-screwdriver-wrench','#ef4444');

-- Roles requeridos por el modelo de permisos
INSERT IGNORE INTO `roles` (id, nombre, descripcion, permisos) VALUES
(5,'Técnico','Gestión de reparaciones e inventario','dashboard,reparaciones,inventario,productos'),
(6,'Empleado','Operaciones comerciales y atención','dashboard,productos,categorias,clientes,ventas,pedidos,inventario,soporte,mis_pedidos');

-- Permisos nuevos
INSERT IGNORE INTO `permisos` (codigo, nombre, descripcion) VALUES
('pedidos','Pedidos online','Gestión de pedidos de la tienda'),
('reparaciones','Reparaciones','Gestión de órdenes de reparación'),
('inventario','Inventario','Entradas, salidas y ajustes de stock'),
('reportes','Reportes','Reportes y exportaciones'),
('ia','Asistente IA','Configuración del asistente'),
('mis_pedidos','Mis pedidos','Historial propio de compras'),
('mis_reparaciones','Mis reparaciones','Seguimiento propio de reparaciones'),
('devoluciones','Devoluciones','Gestión de devoluciones');

-- Asignación de permisos por rol (Administrador se resuelve siempre como *)
INSERT IGNORE INTO `rol_permiso` (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p
 WHERE (r.nombre='Administrador' AND p.codigo IN
        ('dashboard','productos','categorias','clientes','ventas','soporte','usuarios','roles','configuracion',
         'pedidos','reparaciones','inventario','reportes','ia','mis_pedidos','mis_reparaciones','devoluciones'))
    OR (r.nombre='Empleado' AND p.codigo IN
        ('dashboard','productos','categorias','clientes','ventas','pedidos','inventario','soporte','mis_pedidos'))
    OR (r.nombre='Técnico' AND p.codigo IN
        ('dashboard','reparaciones','inventario','productos','mis_reparaciones'))
    OR (r.nombre='Cliente' AND p.codigo IN
        ('mis_pedidos','mis_reparaciones'));

-- Configuración comercial adicional (sin secretos)
INSERT INTO `configuracion` (clave, valor, descripcion) VALUES
('site_url','http://localhost/galax_pc_repair','URL pública de la tienda'),
('envio_costo','12.00','Costo de envío a domicilio en PEN'),
('descuento_promocional','0','Descuento global temporal en porcentaje'),
('chat_historial_dias','30','Días de conservación del historial del chat'),
('ai_api_url','http://127.0.0.1:8501/chat','Endpoint interno del servicio de inferencia'),
('ai_timeout','60','Segundos de espera máxima para el modelo'),
('eslogan','Tecnología que funciona. Servicio en el que confía.','Eslogan comercial'),
('politica_privacidad','El historial del chat se conserva según la configuración del sistema y puede eliminarse desde el perfil.','Política de privacidad del chat')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

-- Destacados reales del catálogo existente (sin inventar productos)
UPDATE `productos` SET destacado = 1 WHERE codigo IN ('LAP-001','DES-001','COM-002');
UPDATE `productos` SET es_nuevo = 1 WHERE id IN (SELECT id FROM (SELECT id FROM productos ORDER BY id DESC LIMIT 3) x);

INSERT INTO `migraciones` (version, aplicada_at) VALUES ('002_seed_reference_data.sql', NOW())
  ON DUPLICATE KEY UPDATE aplicada_at = aplicada_at;
