-- =====================================================================
-- GALAX PC REPAIR — Supabase / PostgreSQL seed (002)
-- ---------------------------------------------------------------------
-- Datos REALES extraídos de:
--   database/backups/ventas_informatica_20261120_160328.sql
--   database/migrations/002_seed_reference_data.sql
--   database/migrations/003_restrict_client_permissions.sql
--   database/migrations/004_repair_utf8_text.sql
--   docs/ROADMAP_IMPLEMENTACION.md (estado final verificado)
--
-- 100% idempotente: todos los INSERT usan ON CONFLICT ... DO NOTHING.
-- Nunca borra ni sobrescribe datos existentes. No se inventan productos,
-- fotos ni registros de demostración. NO se insertan contraseñas en texto
-- plano: en `usuarios.password` se conservan los hashes bcrypt reales
-- (prefijo $2y$) que ya usaba el PHP heredado con password_verify().
--
-- Estado final sembrado (según roadmap):
--   12 productos, 23 categorías, 6 servicios, 6 roles, 18 permisos,
--   43 filas en rol_permiso, 18 configuraciones, 5 usuarios, 3 clientes,
--   4 filas de audit_log y 5 versiones en migraciones.
-- Los huecos de id (categoría 8, configuración 11, audit_log 2) existen
-- en el origen y se conservan: NO se renumeran filas reales.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROLES (4 heredados + 2 de la migración 002)
-- ---------------------------------------------------------------------
INSERT INTO public.roles (id, nombre, descripcion, permisos, created_at, updated_at) VALUES
    (1, 'Administrador', 'Control total del sistema',
     'dashboard,productos,categorias,clientes,ventas,soporte,usuarios,roles,configuracion',
     '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00'),
    (2, 'Vendedor', 'Gestion de ventas y clientes',
     'dashboard,productos,categorias,clientes,ventas',
     '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00'),
    (3, 'Soporte', 'Atencion de tickets de soporte',
     'dashboard,soporte,clientes,productos',
     '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00'),
    -- La migración 003 retiró dashboard/productos/soporte al rol Cliente.
    (4, 'Cliente', 'Cliente final - compras y soporte',
     'mis_compras,mis_pedidos,mis_reparaciones',
     '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00'),
    (5, 'Técnico', 'Gestión de reparaciones e inventario',
     'dashboard,reparaciones,inventario,productos',
     '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00'),
    (6, 'Empleado', 'Operaciones comerciales y atención',
     'dashboard,productos,categorias,clientes,ventas,pedidos,inventario,soporte,mis_pedidos',
     '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- USUARIOS (5 reales). `supabase_uid` queda NULL: enlazar cada usuario de
-- Supabase Auth con UPDATE public.usuarios SET supabase_uid = '<uuid>'
-- WHERE id = <id>. No hay contraseñas en texto plano.
-- ---------------------------------------------------------------------
INSERT INTO public.usuarios
    (id, nombre, apellido, email, password, telefono, direccion, avatar,
     rol_id, estado, ultimo_acceso, created_at, updated_at, supabase_uid)
VALUES
    (1, 'Administrador', 'Sistema', 'admin@ventas.com',
     '$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.',
     '999999999', NULL, NULL, 1, 'activo',
     '2026-11-19 18:06:09+00', '2026-11-19 21:43:57+00', '2026-11-19 23:06:09+00', NULL),
    (2, 'Carlos', 'Vendedor', 'vendedor@ventas.com',
     '$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.',
     '988888888', NULL, NULL, 2, 'activo',
     NULL, '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', NULL),
    (3, 'Maria', 'Soporte', 'soporte@ventas.com',
     '$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.',
     '977777777', NULL, NULL, 3, 'activo',
     NULL, '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', NULL),
    (4, 'Juan', 'Cliente', 'cliente@ventas.com',
     '$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.',
     '966666666', NULL, NULL, 4, 'activo',
     NULL, '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', NULL),
    (5, 'Venta', 'Web', 'web@galaxpcrepair.com',
     '$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.',
     NULL, NULL, NULL, 4, 'activo',
     NULL, '2026-11-19 21:58:55+00', '2026-11-19 22:17:29+00', NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- CATEGORÍAS: 7 del backup (ids 1-7) + 16 reales de la migración 002
-- (ids 9-24; el id 8 estaba hueco en el origen). Slugs generados por la
-- migración 001 y corregidos por la 004 en ids 15, 19 y 23.
-- ---------------------------------------------------------------------
INSERT INTO public.categorias (id, nombre, descripcion, icono, color, estado, created_at, updated_at, slug) VALUES
    (1,  'Laptops',      'Computadoras portatiles',        'fa-laptop',         '#6366f1', 'activo', '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', 'laptops'),
    (2,  'Desktops',     'Computadoras de escritorio',     'fa-desktop',        '#0ea5e9', 'activo', '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', 'desktops'),
    (3,  'Monitores',    'Pantallas y monitores',          'fa-tv',             '#10b981', 'activo', '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', 'monitores'),
    (4,  'Perifericos',  'Teclados, mouse, etc.',          'fa-keyboard',       '#f59e0b', 'activo', '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', 'perifericos'),
    (5,  'Componentes',  'RAM, SSD, CPU, GPU',             'fa-microchip',      '#ef4444', 'activo', '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', 'componentes'),
    (6,  'Redes',        'Routers, switches, cables',      'fa-network-wired',  '#8b5cf6', 'activo', '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', 'redes'),
    (7,  'Accesorios',   'Fundas, soportes, etc.',         'fa-headphones',     '#ec4899', 'activo', '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00', 'accesorios'),
    (9,  'Procesadores', 'Unidades centrales de procesamiento', 'fa-microchip', '#6366f1', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'procesadores'),
    (10, 'Placas madre', 'Tarjetas madre y chipsets',      'fa-diagram-project','#0ea5e9', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'placas-madre'),
    (11, 'Memorias RAM', 'Módulos de memoria',             'fa-memory',         '#10b981', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'memorias-ram'),
    (12, 'Discos SSD',   'Unidades de estado sólido',      'fa-hard-drive',     '#f59e0b', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'discos-ssd'),
    (13, 'Discos HDD',   'Unidades mecánicas de almacenamiento', 'fa-hdd',      '#ef4444', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'discos-hdd'),
    (14, 'Tarjetas gráficas', 'GPU y aceleradores gráficos', 'fa-display',      '#8b5cf6', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'tarjetas-graficas'),
    (15, 'Fuentes de alimentación', 'Fuentes y estabilizadores', 'fa-plug',     '#ec4899', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'fuentes-de-alimentacion'),
    (16, 'Gabinetes',    'Chasis y torres',                'fa-computer',       '#64748b', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'gabinetes'),
    (17, 'Teclados',     'Teclados mecánicos y de membrana','fa-keyboard',      '#f59e0b', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'teclados'),
    (18, 'Mouse',        'Ratones y trackpads',            'fa-mouse',          '#0ea5e9', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'mouse'),
    (19, 'Audífonos',    'Auriculares y headsets',         'fa-headphones',     '#ec4899', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'audifonos'),
    (20, 'Parlantes',    'Altavoces y barras de sonido',   'fa-volume-up',      '#8b5cf6', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'parlantes'),
    (21, 'Impresoras',   'Impresoras y consumibles',       'fa-print',          '#10b981', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'impresoras'),
    (22, 'Routers',      'Equipos de red y routers',       'fa-wifi',           '#6366f1', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'routers'),
    (23, 'Refrigeración','Ventiladores, disipadores y pasta térmica', 'fa-fan', '#06b6d4', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'refrigeracion'),
    (24, 'Componentes y herramientas de mantenimiento', 'Herramientas y repuestos técnicos', 'fa-screwdriver-wrench', '#ef4444', 'activo', '2026-11-20 00:00:00+00', '2026-11-20 00:00:00+00', 'componentes-y-herramientas-de-mantenimiento')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- PRODUCTOS: los 12 reales, con precios, stock e `imagen` EXACTAMENTE
-- como figuran en el backup. No se inventan fotos ni productos.
-- es_nuevo = 1 para los 3 últimos ids, según migración 002.
-- ---------------------------------------------------------------------
INSERT INTO public.productos
    (id, codigo, nombre, descripcion, categoria_id, marca, modelo, slug,
     imagen, especificaciones, garantia, precio_compra, precio_venta, precio_oferta,
     stock, stock_minimo, estado, publicado, tipo, destacado, es_nuevo, created_at, updated_at)
VALUES
    (1,  'LAP-001', 'Laptop HP Pavilion 15',
     'Intel Core i5 12th Gen, 8GB RAM, 512GB SSD, 15.6"', 1, 'HP', 'Pavilion 15',
     'laptop-hp-pavilion-15', 'assets/img/productos/LAP-001.svg', NULL, NULL,
     2200.00, 2899.00, NULL, 12, 3, 'activo', 1, 'producto', 1, 0,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (2,  'LAP-002', 'Laptop Lenovo IdeaPad 3',
     'Ryzen 5 5500U, 8GB RAM, 256GB SSD', 1, 'Lenovo', 'IdeaPad 3',
     'laptop-lenovo-ideapad-3', 'assets/img/productos/LAP-002.svg', NULL, NULL,
     1800.00, 2399.00, NULL, 8, 3, 'activo', 1, 'producto', 0, 0,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (3,  'LAP-003', 'Laptop Asus VivoBook 15',
     'Intel Core i7, 16GB RAM, 512GB SSD', 1, 'Asus', 'VivoBook 15',
     'laptop-asus-vivobook-15', 'assets/img/productos/LAP-003.svg', NULL, NULL,
     2600.00, 3499.00, NULL, 5, 2, 'activo', 1, 'producto', 1, 0,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (4,  'DES-001', 'PC Desktop Gamer',
     'Ryzen 7, 16GB RAM, RTX 3060, 1TB SSD', 2, 'Custom', 'Gamer Pro',
     'pc-desktop-gamer', 'assets/img/productos/DES-001.svg', NULL, NULL,
     3500.00, 4599.00, NULL, 4, 2, 'activo', 1, 'producto', 1, 0,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (5,  'MON-001', 'Monitor LG 24" Full HD',
     'IPS, 75Hz, HDMI/VGA', 3, 'LG', '24MK430',
     'monitor-lg-24"-full-hd', 'assets/img/productos/MON-001.svg', NULL, NULL,
     450.00, 699.00, NULL, 15, 5, 'activo', 1, 'producto', 0, 0,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (6,  'MON-002', 'Monitor Samsung 27" Curvo',
     'VA, 144Hz, QHD', 3, 'Samsung', 'LC27G55T',
     'monitor-samsung-27"-curvo', 'assets/img/productos/MON-002.svg', NULL, NULL,
     900.00, 1299.00, NULL, 6, 2, 'activo', 1, 'producto', 1, 0,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (7,  'PER-001', 'Teclado Mecanico RGB',
     'Switches Blue, retroiluminado', 4, 'Redragon', 'K552',
     'teclado-mecanico-rgb', 'assets/img/productos/PER-001.svg', NULL, NULL,
     120.00, 199.00, NULL, 25, 5, 'activo', 1, 'producto', 0, 0,
     '2026-11-19 21:43:57+00', '2026-11-19 22:07:38+00'),
    (8,  'PER-002', 'Mouse Gamer Logitech G502',
     '16000 DPI, 11 botones', 4, 'Logitech', 'G502 Hero',
     'mouse-gamer-logitech-g502', 'assets/img/productos/PER-002.svg', NULL, NULL,
     180.00, 279.00, NULL, 20, 5, 'activo', 1, 'producto', 1, 0,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (9,  'COM-001', 'Memoria RAM 16GB DDR4',
     '3200MHz, CL16', 5, 'Kingston', 'Fury Beast',
     'memoria-ram-16gb-ddr4', 'assets/img/productos/COM-001.svg', NULL, NULL,
     180.00, 269.00, NULL, 30, 8, 'activo', 1, 'producto', 0, 0,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (10, 'COM-002', 'SSD NVMe 1TB',
     'PCIe 3.0, lectura 3500MB/s', 5, 'Samsung', '970 EVO Plus',
     'ssd-nvme-1tb', 'assets/img/productos/COM-002.svg', NULL, NULL,
     320.00, 489.00, NULL, 18, 5, 'activo', 1, 'producto', 1, 1,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (11, 'RED-001', 'Router TP-Link Archer AX50',
     'WiFi 6, AX3000', 6, 'TP-Link', 'Archer AX50',
     'router-tp-link-archer-ax50', 'assets/img/productos/RED-001.svg', NULL, NULL,
     220.00, 349.00, NULL, 10, 3, 'activo', 1, 'producto', 0, 1,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00'),
    (12, 'ACC-001', 'Auriculares HyperX Cloud II',
     '7.1 Surround, microfono desmontable', 7, 'HyperX', 'Cloud II',
     'auriculares-hyperx-cloud-ii', 'assets/img/productos/ACC-001.svg', NULL, NULL,
     280.00, 399.00, NULL, 14, 4, 'activo', 1, 'producto', 1, 1,
     '2026-11-19 21:43:57+00', '2026-11-19 21:58:55+00')
ON CONFLICT (id) DO NOTHING;

-- Nota D15 del roadmap: en la BD final se sustituyeron las imágenes de los
-- productos 1 y 2 por sus PNG reales. Si se desea reproducir ESE estado,
-- ejecutar manualmente (NO se hace aquí para preservar las rutas del backup):
--   UPDATE public.productos SET imagen = 'assets/img/productos/LAP-001.png' WHERE id = 1;
--   UPDATE public.productos SET imagen = 'assets/img/productos/LAP-002.png' WHERE id = 2;

-- ---------------------------------------------------------------------
-- CLIENTES (3 reales)
-- ---------------------------------------------------------------------
INSERT INTO public.clientes
    (id, nombre, apellido, email, telefono, direccion, dni, usuario_id, created_at, updated_at)
VALUES
    (1, 'Juan',  'Perez',    'cliente@ventas.com',      '966666666', 'Av. Principal 123',   '12345678', 4,    '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00'),
    (2, 'Ana',   'Garcia',   'ana.garcia@email.com',    '955555555', 'Calle Los Olmos 456', '87654321', NULL, '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00'),
    (3, 'Luis',  'Martinez', 'luis.martinez@email.com', '944444444', 'Jr. Las Flores 789',  '11223344', NULL, '2026-11-19 21:43:57+00', '2026-11-19 21:43:57+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- CONFIGURACIÓN: 10 valores del backup + 8 de la migración 002.
-- Objetivo ON CONFLICT explícito: configuracion.clave (UNIQUE).
-- El id 11 está hueco en el origen; no se reutiliza.
-- ---------------------------------------------------------------------
INSERT INTO public.configuracion (id, clave, valor, descripcion) VALUES
    (1,  'empresa_nombre',  'GALAX PC REPAIR', 'Nombre de la empresa'),
    (2,  'empresa_ruc',     '20123456789',     'RUC de la empresa'),
    (3,  'empresa_direccion','Av. Tecnologia 100, Lima', 'Direccion de la empresa'),
    (4,  'empresa_telefono','01-2345678',      'Telefono de contacto'),
    (5,  'empresa_email',   'contacto@galaxpcrepair.com', 'Email de contacto'),
    (6,  'igv_porcentaje',  '18',              'Porcentaje de IGV'),
    (7,  'moneda',          'S/',              'Simbodo de moneda'),
    (8,  'stock_alerta',    '5',               'Stock minimo para alerta'),
    (9,  'promo_fin',       '2026-11-22 23:59:59', 'DEMO: fecha de finalizacion de la promocion mostrada en el hero; cambiar en Configuracion'),
    (10, 'whatsapp_numero', '+51 986 260 738', 'Numero real de WhatsApp para contacto'),
    (12, 'site_url',        'http://localhost/galax_pc_repair', 'URL pública de la tienda'),
    (13, 'envio_costo',     '12.00',           'Costo de envío a domicilio en PEN'),
    (14, 'descuento_promocional', '0',         'Descuento global temporal en porcentaje'),
    (15, 'chat_historial_dias', '30',          'Días de conservación del historial del chat'),
    (16, 'ai_api_url',      'http://127.0.0.1:8501/chat', 'Endpoint interno del servicio de inferencia'),
    (17, 'ai_timeout',      '60',              'Segundos de espera máxima para el modelo'),
    (18, 'eslogan',         'Tecnología que funciona. Servicio en el que confía.', 'Eslogan comercial'),
    (19, 'politica_privacidad',
         'El historial del chat se conserva según la configuración del sistema y puede eliminarse desde el perfil.',
         'Política de privacidad del chat')
ON CONFLICT (clave) DO NOTHING;

-- ---------------------------------------------------------------------
-- PERMISOS: 10 del backup (texto UTF-8 reparado: el volcado traía
-- mojibake tipo "Gesti├│n") + 8 de la migración 002 (ya corregidos por 004).
-- ---------------------------------------------------------------------
INSERT INTO public.permisos (id, codigo, nombre, descripcion, created_at) VALUES
    (1,  'dashboard',      'Panel',            'Acceso al panel principal',             '2026-11-19 22:47:00+00'),
    (2,  'productos',      'Productos',        'Gestión de catálogo',                   '2026-11-19 22:47:00+00'),
    (3,  'categorias',     'Categorías',       'Gestión de categorías',                 '2026-11-19 22:47:00+00'),
    (4,  'clientes',       'Clientes',         'Gestión de clientes',                   '2026-11-19 22:47:00+00'),
    (5,  'ventas',         'Ventas',           'Gestión de ventas',                     '2026-11-19 22:47:00+00'),
    (6,  'soporte',        'Soporte',          'Gestión de tickets',                    '2026-11-19 22:47:00+00'),
    (7,  'usuarios',       'Usuarios',         'Gestión de usuarios',                   '2026-11-19 22:47:00+00'),
    (8,  'roles',          'Roles',            'Gestión de roles y permisos',           '2026-11-19 22:47:00+00'),
    (9,  'configuracion',  'Configuración',    'Parámetros del sistema',                '2026-11-19 22:47:00+00'),
    (10, 'mis_compras',    'Mis compras',      'Historial de compras del cliente',      '2026-11-19 22:47:00+00'),
    (11, 'pedidos',        'Pedidos online',   'Gestión de pedidos de la tienda',       '2026-11-20 00:00:00+00'),
    (12, 'reparaciones',   'Reparaciones',     'Gestión de órdenes de reparación',      '2026-11-20 00:00:00+00'),
    (13, 'inventario',     'Inventario',       'Entradas, salidas y ajustes de stock',  '2026-11-20 00:00:00+00'),
    (14, 'reportes',       'Reportes',         'Reportes y exportaciones',              '2026-11-20 00:00:00+00'),
    (15, 'ia',             'Asistente IA',     'Configuración del asistente',           '2026-11-20 00:00:00+00'),
    (16, 'mis_pedidos',    'Mis pedidos',      'Historial propio de compras',           '2026-11-20 00:00:00+00'),
    (17, 'mis_reparaciones','Mis reparaciones','Seguimiento propio de reparaciones',    '2026-11-20 00:00:00+00'),
    (18, 'devoluciones',   'Devoluciones',     'Gestión de devoluciones',               '2026-11-20 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- ROL_PERMISO: estado FINAL (43 filas) tras migraciones 002 y 003.
-- 17 Admin + 5 Vendedor + 4 Soporte + 3 Cliente + 5 Técnico + 9 Empleado.
-- Administrador: ids 1-9 del backup + 11-18 de la migración 002; no tiene 10.
-- Cliente: los permisos 1, 2 y 6 fueron retirados por la migración 003;
-- quedan 10, 16 y 17.
-- Objetivo ON CONFLICT explícito: (rol_id, permiso_id), PK compuesta.
-- ---------------------------------------------------------------------
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES
    (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),
    (1,11),(1,12),(1,13),(1,14),(1,15),(1,16),(1,17),(1,18),
    (2,1),(2,2),(2,3),(2,4),(2,5),
    (3,1),(3,2),(3,4),(3,6),
    (4,10),(4,16),(4,17),
    (5,1),(5,2),(5,12),(5,13),(5,17),
    (6,1),(6,2),(6,3),(6,4),(6,5),(6,6),(6,11),(6,13),(6,16)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Plantilla para carrito_items (sin datos reales que sembrar; el objetivo
-- de ON CONFLICT es la PK compuesta, NO un id propio):
-- INSERT INTO public.carrito_items (carrito_id, producto_id, cantidad)
-- VALUES (...), (...)
-- ON CONFLICT (carrito_id, producto_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- SERVICIOS: 6 reales de la migración 002 con acentos restaurados (004).
-- ---------------------------------------------------------------------
INSERT INTO public.servicios (id, codigo, nombre, descripcion, icono, precio_desde, duracion, activo, orden, created_at) VALUES
    (1, 'SRV-001', 'Reparación de PC y laptops',
     'Diagnóstico y reparación de fallas de hardware, arranque, pantalla y componentes.',
     'fa-laptop', NULL, NULL, 1, 1, '2026-11-20 00:00:00+00'),
    (2, 'SRV-002', 'Microsoldadura de placas',
     'Revisión electrónica y reparación especializada de placas y conectores.',
     'fa-microchip', NULL, NULL, 1, 2, '2026-11-20 00:00:00+00'),
    (3, 'SRV-003', 'Formateo e instalación',
     'Instalación y configuración del sistema operativo y programas esenciales.',
     'fa-windows', NULL, NULL, 1, 3, '2026-11-20 00:00:00+00'),
    (4, 'SRV-004', 'Mantenimiento preventivo',
     'Limpieza interna, cuidado térmico y puesta a punto para prolongar la vida útil.',
     'fa-fan', NULL, NULL, 1, 4, '2026-11-20 00:00:00+00'),
    (5, 'SRV-005', 'Instalación de redes',
     'Configuración de redes cableadas e inalámbricas para hogares y negocios.',
     'fa-network-wired', NULL, NULL, 1, 5, '2026-11-20 00:00:00+00'),
    (6, 'SRV-006', 'Diagnóstico electrónico',
     'Evaluación técnica para identificar el origen de la falla y recomendar una solución.',
     'fa-chart-simple', NULL, NULL, 1, 6, '2026-11-20 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- AUDIT_LOG: 4 filas reales del backup (el id 2 estaba hueco).
-- No se inventan eventos de QA.
-- ---------------------------------------------------------------------
INSERT INTO public.audit_log (id, usuario_id, accion, entidad, entidad_id, detalles, ip, created_at) VALUES
    (1, 1, 'login', 'usuarios', '1', NULL, '::1', '2026-11-19 22:53:32+00'),
    (3, 1, 'login', 'usuarios', '1', NULL, '::1', '2026-11-19 22:55:07+00'),
    (4, 1, 'login', 'usuarios', '1', NULL, '::1', '2026-11-19 22:55:36+00'),
    (5, 1, 'login', 'usuarios', '1', NULL, '::1', '2026-11-19 23:06:09+00')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- MIGRACIONES: registro histórico (aplicada_at por defecto = now()).
-- ---------------------------------------------------------------------
INSERT INTO public.migraciones (version, aplicada_at) VALUES
    ('001_phase1_security.sql', '2026-11-19 22:47:00+00'),
    ('001_platform_core.sql',   '2026-11-20 00:00:00+00'),
    ('002_seed_reference_data.sql', '2026-11-20 00:00:00+00'),
    ('003_restrict_client_permissions.sql', '2026-11-20 00:00:00+00'),
    ('004_repair_utf8_text.sql', '2026-11-20 00:00:00+00')
ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------
-- AJUSTE DE SECUENCIAS
-- Tras insertar ids explícitos, los IDENTITY deben continuar en MAX(id)+1.
-- Genérico para todas las columnas GENERATED ... AS IDENTITY de public.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    rec record;
BEGIN
    FOR rec IN
        SELECT c.relname AS tbl, a.attname AS col
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
         WHERE n.nspname = 'public'
           AND c.relkind = 'r'
           AND a.attidentity IN ('a', 'd')
    LOOP
        EXECUTE format(
            'SELECT setval(pg_get_serial_sequence(%L, %L), '
            'COALESCE((SELECT MAX(%I) FROM public.%I), 1), '
            '(SELECT COUNT(*) > 0 FROM public.%I))',
            'public.' || rec.tbl, rec.col, rec.col, rec.tbl, rec.tbl
        );
    END LOOP;
END $$;

-- Verificación rápida (ejecutar manualmente si se desea):
-- SELECT 'productos' AS tabla, count(*) FROM public.productos
-- UNION ALL SELECT 'categorias', count(*) FROM public.categorias
-- UNION ALL SELECT 'servicios', count(*) FROM public.servicios
-- UNION ALL SELECT 'roles', count(*) FROM public.roles
-- UNION ALL SELECT 'permisos', count(*) FROM public.permisos
-- UNION ALL SELECT 'rol_permiso', count(*) FROM public.rol_permiso
-- UNION ALL SELECT 'configuracion', count(*) FROM public.configuracion
-- UNION ALL SELECT 'usuarios', count(*) FROM public.usuarios
-- UNION ALL SELECT 'clientes', count(*) FROM public.clientes;
-- Esperado: 12 / 23 / 6 / 6 / 18 / 43 / 18 / 5 / 3.

-- Fin de 002_seed_postgres.sql
