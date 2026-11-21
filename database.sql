-- =====================================================
-- PROYECTO: VENTAS DE EQUIPOS INFORMATICOS
-- SOPORTE INFORMATICO ONLINE
-- Base de datos para phpMyAdmin / MySQL
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS `ventas_informatica` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ventas_informatica`;

-- -----------------------------------------------------
-- Tabla: roles
-- -----------------------------------------------------
CREATE TABLE `roles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(50) NOT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `permisos` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `roles` (`id`, `nombre`, `descripcion`, `permisos`) VALUES
(1, 'Administrador', 'Control total del sistema', 'dashboard,productos,categorias,clientes,ventas,soporte,usuarios,roles,configuracion'),
(2, 'Vendedor', 'Gestion de ventas y clientes', 'dashboard,productos,categorias,clientes,ventas'),
(3, 'Soporte', 'Atencion de tickets de soporte', 'dashboard,soporte,clientes,productos'),
(4, 'Cliente', 'Cliente final - compras y soporte', 'dashboard,productos,soporte,mis_compras');

-- -----------------------------------------------------
-- Tabla: usuarios
-- -----------------------------------------------------
CREATE TABLE `usuarios` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `apellido` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `telefono` VARCHAR(20) DEFAULT NULL,
  `direccion` VARCHAR(255) DEFAULT NULL,
  `avatar` VARCHAR(255) DEFAULT NULL,
  `rol_id` INT(11) NOT NULL DEFAULT 4,
  `estado` ENUM('activo','inactivo','bloqueado') NOT NULL DEFAULT 'activo',
  `ultimo_acceso` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `rol_id` (`rol_id`),
  CONSTRAINT `fk_usuarios_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password: admin123 (bcrypt)
INSERT INTO `usuarios` (`id`, `nombre`, `apellido`, `email`, `password`, `telefono`, `rol_id`, `estado`) VALUES
(1, 'Administrador', 'Sistema', 'admin@ventas.com', '$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.', '999999999', 1, 'activo'),
(2, 'Carlos', 'Vendedor', 'vendedor@ventas.com', '$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.', '988888888', 2, 'activo'),
(3, 'Maria', 'Soporte', 'soporte@ventas.com', '$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.', '977777777', 3, 'activo'),
(4, 'Juan', 'Cliente', 'cliente@ventas.com', '$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.', '966666666', 4, 'activo');

-- -----------------------------------------------------
-- Tabla: categorias
-- -----------------------------------------------------
CREATE TABLE `categorias` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` TEXT DEFAULT NULL,
  `icono` VARCHAR(50) DEFAULT 'fa-box',
  `color` VARCHAR(20) DEFAULT '#6366f1',
  `estado` ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `categorias` (`nombre`, `descripcion`, `icono`, `color`) VALUES
('Laptops', 'Computadoras portatiles', 'fa-laptop', '#6366f1'),
('Desktops', 'Computadoras de escritorio', 'fa-desktop', '#0ea5e9'),
('Monitores', 'Pantallas y monitores', 'fa-tv', '#10b981'),
('Perifericos', 'Teclados, mouse, etc.', 'fa-keyboard', '#f59e0b'),
('Componentes', 'RAM, SSD, CPU, GPU', 'fa-microchip', '#ef4444'),
('Redes', 'Routers, switches, cables', 'fa-network-wired', '#8b5cf6'),
('Accesorios', 'Fundas, soportes, etc.', 'fa-headphones', '#ec4899');

-- -----------------------------------------------------
-- Tabla: productos
-- -----------------------------------------------------
CREATE TABLE `productos` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` TEXT DEFAULT NULL,
  `categoria_id` INT(11) NOT NULL,
  `marca` VARCHAR(80) DEFAULT NULL,
  `modelo` VARCHAR(80) DEFAULT NULL,
  `precio_compra` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `precio_venta` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `stock` INT(11) NOT NULL DEFAULT 0,
  `stock_minimo` INT(11) NOT NULL DEFAULT 5,
  `imagen` VARCHAR(255) DEFAULT NULL,
  `estado` ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `categoria_id` (`categoria_id`),
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `productos` (`codigo`, `nombre`, `descripcion`, `categoria_id`, `marca`, `modelo`, `precio_compra`, `precio_venta`, `stock`, `stock_minimo`) VALUES
('LAP-001', 'Laptop HP Pavilion 15', 'Intel Core i5 12th Gen, 8GB RAM, 512GB SSD, 15.6"', 1, 'HP', 'Pavilion 15', 2200.00, 2899.00, 12, 3),
('LAP-002', 'Laptop Lenovo IdeaPad 3', 'Ryzen 5 5500U, 8GB RAM, 256GB SSD', 1, 'Lenovo', 'IdeaPad 3', 1800.00, 2399.00, 8, 3),
('LAP-003', 'Laptop Asus VivoBook 15', 'Intel Core i7, 16GB RAM, 512GB SSD', 1, 'Asus', 'VivoBook 15', 2600.00, 3499.00, 5, 2),
('DES-001', 'PC Desktop Gamer', 'Ryzen 7, 16GB RAM, RTX 3060, 1TB SSD', 2, 'Custom', 'Gamer Pro', 3500.00, 4599.00, 4, 2),
('MON-001', 'Monitor LG 24" Full HD', 'IPS, 75Hz, HDMI/VGA', 3, 'LG', '24MK430', 450.00, 699.00, 15, 5),
('MON-002', 'Monitor Samsung 27" Curvo', 'VA, 144Hz, QHD', 3, 'Samsung', 'LC27G55T', 900.00, 1299.00, 6, 2),
('PER-001', 'Teclado Mecanico RGB', 'Switches Blue, retroiluminado', 4, 'Redragon', 'K552', 120.00, 199.00, 25, 5),
('PER-002', 'Mouse Gamer Logitech G502', '16000 DPI, 11 botones', 4, 'Logitech', 'G502 Hero', 180.00, 279.00, 20, 5),
('COM-001', 'Memoria RAM 16GB DDR4', '3200MHz, CL16', 5, 'Kingston', 'Fury Beast', 180.00, 269.00, 30, 8),
('COM-002', 'SSD NVMe 1TB', 'PCIe 3.0, lectura 3500MB/s', 5, 'Samsung', '970 EVO Plus', 320.00, 489.00, 18, 5),
('RED-001', 'Router TP-Link Archer AX50', 'WiFi 6, AX3000', 6, 'TP-Link', 'Archer AX50', 220.00, 349.00, 10, 3),
('ACC-001', 'Auriculares HyperX Cloud II', '7.1 Surround, microfono desmontable', 7, 'HyperX', 'Cloud II', 280.00, 399.00, 14, 4);

-- -----------------------------------------------------
-- Tabla: clientes
-- -----------------------------------------------------
CREATE TABLE `clientes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `apellido` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `telefono` VARCHAR(20) DEFAULT NULL,
  `direccion` VARCHAR(255) DEFAULT NULL,
  `dni` VARCHAR(20) DEFAULT NULL,
  `usuario_id` INT(11) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `fk_clientes_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `clientes` (`nombre`, `apellido`, `email`, `telefono`, `direccion`, `dni`, `usuario_id`) VALUES
('Juan', 'Perez', 'cliente@ventas.com', '966666666', 'Av. Principal 123', '12345678', 4),
('Ana', 'Garcia', 'ana.garcia@email.com', '955555555', 'Calle Los Olmos 456', '87654321', NULL),
('Luis', 'Martinez', 'luis.martinez@email.com', '944444444', 'Jr. Las Flores 789', '11223344', NULL);

-- -----------------------------------------------------
-- Tabla: ventas
-- -----------------------------------------------------
CREATE TABLE `ventas` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(30) NOT NULL,
  `cliente_id` INT(11) NOT NULL,
  `usuario_id` INT(11) NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `igv` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `metodo_pago` ENUM('efectivo','tarjeta','transferencia','yape','plin') NOT NULL DEFAULT 'efectivo',
  `estado` ENUM('pendiente','pagado','cancelado','entregado') NOT NULL DEFAULT 'pendiente',
  `notas` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `cliente_id` (`cliente_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `fk_ventas_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_ventas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabla: detalle_ventas
-- -----------------------------------------------------
CREATE TABLE `detalle_ventas` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `venta_id` INT(11) NOT NULL,
  `producto_id` INT(11) NOT NULL,
  `cantidad` INT(11) NOT NULL DEFAULT 1,
  `precio_unitario` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `venta_id` (`venta_id`),
  KEY `producto_id` (`producto_id`),
  CONSTRAINT `fk_detalle_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabla: tickets (soporte online)
-- -----------------------------------------------------
CREATE TABLE `tickets` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(30) NOT NULL,
  `asunto` VARCHAR(200) NOT NULL,
  `descripcion` TEXT NOT NULL,
  `cliente_id` INT(11) DEFAULT NULL,
  `usuario_id` INT(11) NOT NULL,
  `asignado_a` INT(11) DEFAULT NULL,
  `prioridad` ENUM('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
  `estado` ENUM('abierto','en_proceso','resuelto','cerrado') NOT NULL DEFAULT 'abierto',
  `categoria` VARCHAR(80) DEFAULT 'general',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `cliente_id` (`cliente_id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `asignado_a` (`asignado_a`),
  CONSTRAINT `fk_tickets_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tickets_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_tickets_asignado` FOREIGN KEY (`asignado_a`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabla: respuestas_tickets
-- -----------------------------------------------------
CREATE TABLE `respuestas_tickets` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `ticket_id` INT(11) NOT NULL,
  `usuario_id` INT(11) NOT NULL,
  `mensaje` TEXT NOT NULL,
  `adjunto` VARCHAR(255) DEFAULT NULL,
  `es_interno` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `fk_respuestas_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_respuestas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabla: configuracion
-- -----------------------------------------------------
CREATE TABLE `configuracion` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `clave` VARCHAR(80) NOT NULL,
  `valor` TEXT DEFAULT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clave` (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `configuracion` (`clave`, `valor`, `descripcion`) VALUES
('empresa_nombre', 'TechVentas Pro', 'Nombre de la empresa'),
('empresa_ruc', '20123456789', 'RUC de la empresa'),
('empresa_direccion', 'Av. Tecnologia 100, Lima', 'Direccion de la empresa'),
('empresa_telefono', '01-2345678', 'Telefono de contacto'),
('empresa_email', 'contacto@techventas.com', 'Email de contacto'),
('igv_porcentaje', '18', 'Porcentaje de IGV'),
('moneda', 'S/', 'Simbodo de moneda'),
('stock_alerta', '5', 'Stock minimo para alerta');

COMMIT;
