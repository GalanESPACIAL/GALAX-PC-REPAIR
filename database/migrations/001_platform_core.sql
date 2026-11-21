-- =====================================================================
-- GALAX PC REPAIR — Migración 001: núcleo comercial
-- Idempotente. NO elimina ni recrea tablas existentes.
-- Aplicar sobre: ventas_informatica
-- =====================================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS gx_add_column;
DROP PROCEDURE IF EXISTS gx_add_index;

DELIMITER $$
CREATE PROCEDURE gx_add_column(IN p_table VARCHAR(64), IN p_col VARCHAR(64), IN p_def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_col
  ) THEN
    SET @gx_sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_col, '` ', p_def);
    PREPARE gx_st FROM @gx_sql; EXECUTE gx_st; DEALLOCATE PREPARE gx_st;
  END IF;
END$$

CREATE PROCEDURE gx_add_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @gx_sql = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` ', p_def);
    PREPARE gx_st FROM @gx_sql; EXECUTE gx_st; DEALLOCATE PREPARE gx_st;
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Extensión no destructiva del catálogo heredado
-- ---------------------------------------------------------------------
CALL gx_add_column('productos', 'slug',            "VARCHAR(180) NULL AFTER modelo");
CALL gx_add_column('productos', 'imagen',          "VARCHAR(255) NULL AFTER stock_minimo");
CALL gx_add_column('productos', 'especificaciones',"TEXT NULL AFTER imagen");
CALL gx_add_column('productos', 'garantia',        "VARCHAR(120) NULL AFTER especificaciones");
CALL gx_add_column('productos', 'destacado',       "TINYINT(1) NOT NULL DEFAULT 0 AFTER garantia");
CALL gx_add_column('productos', 'es_nuevo',        "TINYINT(1) NOT NULL DEFAULT 0 AFTER destacado");
CALL gx_add_column('productos', 'precio_oferta',   "DECIMAL(10,2) NULL AFTER precio_venta");
CALL gx_add_column('productos', 'publicado',       "TINYINT(1) NOT NULL DEFAULT 1 AFTER estado");
CALL gx_add_column('productos', 'tipo',            "ENUM('producto','servicio') NOT NULL DEFAULT 'producto' AFTER codigo");
CALL gx_add_column('usuarios',  'avatar',          "VARCHAR(255) NULL AFTER direccion");
CALL gx_add_column('categorias', 'slug',            "VARCHAR(180) NULL AFTER nombre");

-- Slugs estables para categorías existentes.
UPDATE `categorias`
   SET slug = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(nombre, ' ', '-'), 'á', 'a'), 'é', 'e'), 'í', 'i'))
 WHERE slug IS NULL OR slug = '';

CALL gx_add_index('productos', 'idx_productos_publico', '(publicado, estado, categoria_id, id)');
CALL gx_add_index('productos', 'idx_productos_busqueda', '(nombre, codigo, marca, modelo)');

-- Slugs estables para los productos existentes (solo si están vacíos).
UPDATE `productos`
   SET slug = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(nombre, ' ', '-'), 'á', 'a'), 'é', 'e'), 'í', 'i'))
 WHERE slug IS NULL OR slug = '';

-- ---------------------------------------------------------------------
-- Servicios técnicos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `servicios` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(30) NOT NULL,
  `nombre` VARCHAR(180) NOT NULL,
  `descripcion` TEXT NULL,
  `icono` VARCHAR(60) NOT NULL DEFAULT 'fa-microchip',
  `precio_desde` DECIMAL(10,2) NULL DEFAULT NULL,
  `duracion` VARCHAR(80) NULL DEFAULT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_servicio_codigo` (`codigo`),
  KEY `idx_servicio_activo_orden` (`activo`, `orden`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Carrito persistente (visitantes e identificados) + historial DESHACER
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `carritos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` INT NULL DEFAULT NULL,
  `session_token` CHAR(64) NOT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_carrito_sesion` (`session_token`),
  UNIQUE KEY `uq_carrito_usuario` (`usuario_id`),
  KEY `idx_carrito_actualizado` (`actualizado_en`),
  CONSTRAINT `fk_carrito_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `carrito_items` (
  `carrito_id` BIGINT UNSIGNED NOT NULL,
  `producto_id` INT NOT NULL,
  `cantidad` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`carrito_id`, `producto_id`),
  CONSTRAINT `fk_carrito_item_carrito` FOREIGN KEY (`carrito_id`) REFERENCES `carritos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_carrito_item_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `carrito_historial` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `carrito_id` BIGINT UNSIGNED NOT NULL,
  `accion` VARCHAR(40) NOT NULL,
  `snapshot` TEXT NOT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_carrito_historial` (`carrito_id`, `id`),
  CONSTRAINT `fk_carrito_historial_carrito` FOREIGN KEY (`carrito_id`) REFERENCES `carritos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Pedidos online (separados de `ventas` para no alterar el módulo POS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pedidos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(40) NOT NULL,
  `usuario_id` INT NULL DEFAULT NULL,
  `cliente_id` INT NULL DEFAULT NULL,
  `nombre_cliente` VARCHAR(160) NOT NULL,
  `documento` VARCHAR(30) NULL DEFAULT NULL,
  `email_cliente` VARCHAR(254) NOT NULL,
  `telefono_cliente` VARCHAR(32) NULL DEFAULT NULL,
  `direccion` VARCHAR(255) NULL DEFAULT NULL,
  `referencia` VARCHAR(255) NULL DEFAULT NULL,
  `metodo_entrega` ENUM('tienda','domicilio') NOT NULL DEFAULT 'tienda',
  `metodo_pago` ENUM('efectivo','tarjeta','transferencia','yape','plin') NOT NULL DEFAULT 'efectivo',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `descuento` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `impuestos` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `envio` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `estado` ENUM('pendiente','confirmado','preparando','completado','cancelado') NOT NULL DEFAULT 'pendiente',
  `notas` TEXT NULL DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pedido_codigo` (`codigo`),
  KEY `idx_pedido_usuario_fecha` (`usuario_id`, `creado_en`),
  KEY `idx_pedido_estado_fecha` (`estado`, `creado_en`),
  CONSTRAINT `fk_pedido_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pedido_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pedido_detalles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pedido_id` BIGINT UNSIGNED NOT NULL,
  `producto_id` INT NULL DEFAULT NULL,
  `sku` VARCHAR(60) NOT NULL,
  `nombre_producto` VARCHAR(180) NOT NULL,
  `cantidad` INT UNSIGNED NOT NULL,
  `precio_unitario` DECIMAL(12,2) NOT NULL,
  `descuento` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_detalle_pedido` (`pedido_id`),
  KEY `idx_detalle_producto` (`producto_id`),
  CONSTRAINT `fk_detalle_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_pedido_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `garantias` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pedido_id` BIGINT UNSIGNED NOT NULL,
  `detalle_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `valido_hasta` DATE NULL DEFAULT NULL,
  `estado` ENUM('vigente','vencida','reclamada') NOT NULL DEFAULT 'vigente',
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_garantia_pedido` (`pedido_id`),
  CONSTRAINT `fk_garantia_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_garantia_detalle` FOREIGN KEY (`detalle_id`) REFERENCES `pedido_detalles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Reparaciones técnicas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reparaciones` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(40) NOT NULL,
  `cliente_id` INT NULL DEFAULT NULL,
  `usuario_id` INT NULL DEFAULT NULL,
  `nombre_cliente` VARCHAR(160) NOT NULL,
  `contacto_cliente` VARCHAR(160) NULL DEFAULT NULL,
  `tipo_equipo` VARCHAR(100) NOT NULL,
  `marca` VARCHAR(100) NULL DEFAULT NULL,
  `modelo` VARCHAR(100) NULL DEFAULT NULL,
  `numero_serie` VARCHAR(120) NULL DEFAULT NULL,
  `accesorios_recibidos` TEXT NULL DEFAULT NULL,
  `estado_fisico` TEXT NULL DEFAULT NULL,
  `problema_reportado` TEXT NOT NULL,
  `diagnostico` TEXT NULL DEFAULT NULL,
  `presupuesto` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `aprobacion_cliente` TINYINT(1) NOT NULL DEFAULT 0,
  `tecnico_id` INT NULL DEFAULT NULL,
  `fecha_recepcion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_estimada_entrega` DATE NULL DEFAULT NULL,
  `fecha_entrega` DATETIME NULL DEFAULT NULL,
  `mano_obra` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `costo_repuestos` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `costo_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `garantia` VARCHAR(120) NULL DEFAULT NULL,
  `observaciones` TEXT NULL DEFAULT NULL,
  `estado` ENUM('recibido','pendiente_diagnostico','en_diagnostico','presupuesto_enviado','esperando_aprobacion','aprobado','en_reparacion','esperando_repuestos','en_pruebas','reparado','listo_para_entregar','entregado','cancelado') NOT NULL DEFAULT 'recibido',
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reparacion_codigo` (`codigo`),
  KEY `idx_reparacion_cliente` (`cliente_id`, `creado_en`),
  KEY `idx_reparacion_estado` (`estado`, `creado_en`),
  KEY `idx_reparacion_tecnico` (`tecnico_id`),
  CONSTRAINT `fk_reparacion_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reparacion_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reparacion_tecnico` FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reparacion_historial` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reparacion_id` BIGINT UNSIGNED NOT NULL,
  `estado` VARCHAR(50) NOT NULL,
  `nota` TEXT NULL DEFAULT NULL,
  `usuario_id` INT NULL DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reparacion_historial` (`reparacion_id`, `id`),
  CONSTRAINT `fk_historial_reparacion` FOREIGN KEY (`reparacion_id`) REFERENCES `reparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_historial_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reparacion_repuestos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reparacion_id` BIGINT UNSIGNED NOT NULL,
  `producto_id` INT NULL DEFAULT NULL,
  `nombre` VARCHAR(180) NOT NULL,
  `cantidad` INT UNSIGNED NOT NULL DEFAULT 1,
  `precio_unitario` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reparacion_repuesto` (`reparacion_id`),
  CONSTRAINT `fk_repuesto_reparacion` FOREIGN KEY (`reparacion_id`) REFERENCES `reparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_repuesto_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Inventario y trazabilidad
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventario_movimientos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `producto_id` INT NOT NULL,
  `tipo` ENUM('entrada','salida','ajuste','venta','cancelacion','reparacion') NOT NULL,
  `cantidad` INT NOT NULL,
  `stock_anterior` INT NOT NULL,
  `stock_nuevo` INT NOT NULL,
  `motivo` VARCHAR(255) NULL DEFAULT NULL,
  `documento` VARCHAR(80) NULL DEFAULT NULL,
  `costo_unitario` DECIMAL(12,2) NULL DEFAULT NULL,
  `usuario_id` INT NULL DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inventario_producto_fecha` (`producto_id`, `creado_en`),
  KEY `idx_inventario_tipo_fecha` (`tipo`, `creado_en`),
  CONSTRAINT `fk_inventario_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_inventario_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proveedores` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ruc` VARCHAR(20) NULL DEFAULT NULL,
  `nombre` VARCHAR(180) NOT NULL,
  `contacto` VARCHAR(120) NULL DEFAULT NULL,
  `telefono` VARCHAR(40) NULL DEFAULT NULL,
  `email` VARCHAR(150) NULL DEFAULT NULL,
  `direccion` VARCHAR(255) NULL DEFAULT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proveedor_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `compras_proveedor` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(40) NOT NULL,
  `proveedor_id` INT UNSIGNED NOT NULL,
  `producto_id` INT NOT NULL,
  `cantidad` INT UNSIGNED NOT NULL,
  `costo_unitario` DECIMAL(12,2) NOT NULL,
  `total` DECIMAL(12,2) NOT NULL,
  `fecha` DATE NOT NULL,
  `usuario_id` INT NULL DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_compra_codigo` (`codigo`),
  KEY `idx_compra_proveedor_fecha` (`proveedor_id`, `fecha`),
  CONSTRAINT `fk_compra_proveedor` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_compra_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_compra_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Asistente IA (conversaciones aisladas por sesión/usuario)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ai_conversaciones` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_token` CHAR(64) NOT NULL,
  `usuario_id` INT NULL DEFAULT NULL,
  `titulo` VARCHAR(180) NULL DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_conv_sesion` (`session_token`, `actualizado_en`),
  KEY `idx_ai_conv_usuario` (`usuario_id`),
  CONSTRAINT `fk_ai_conv_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ai_mensajes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversacion_id` BIGINT UNSIGNED NOT NULL,
  `rol` ENUM('usuario','asistente','sistema') NOT NULL,
  `mensaje` TEXT NOT NULL,
  `productos_json` TEXT NULL DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_mensaje_conversacion` (`conversacion_id`, `id`),
  CONSTRAINT `fk_ai_mensaje_conversacion` FOREIGN KEY (`conversacion_id`) REFERENCES `ai_conversaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notificaciones` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` INT NOT NULL,
  `titulo` VARCHAR(160) NOT NULL,
  `mensaje` TEXT NOT NULL,
  `enlace` VARCHAR(255) NULL DEFAULT NULL,
  `leida` TINYINT(1) NOT NULL DEFAULT 0,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notificacion_usuario` (`usuario_id`, `leida`, `creado_en`),
  CONSTRAINT `fk_notificacion_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS gx_add_column;
DROP PROCEDURE IF EXISTS gx_add_index;

INSERT INTO `migraciones` (version, aplicada_at) VALUES ('001_platform_core.sql', NOW())
  ON DUPLICATE KEY UPDATE aplicada_at = aplicada_at;
