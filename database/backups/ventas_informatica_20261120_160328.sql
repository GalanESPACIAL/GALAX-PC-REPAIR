-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: ventas_informatica
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) DEFAULT NULL,
  `accion` varchar(100) NOT NULL,
  `entidad` varchar(80) NOT NULL,
  `entidad_id` varchar(50) DEFAULT NULL,
  `detalles` text DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_usuario` (`usuario_id`),
  KEY `idx_audit_entidad` (`entidad`,`entidad_id`),
  KEY `idx_audit_fecha` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES (1,1,'login','usuarios','1',NULL,'::1','2026-11-19 22:53:32'),(3,1,'login','usuarios','1',NULL,'::1','2026-11-19 22:55:07'),(4,1,'login','usuarios','1',NULL,'::1','2026-11-19 22:55:36'),(5,1,'login','usuarios','1',NULL,'::1','2026-11-19 23:06:09');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categorias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `icono` varchar(50) DEFAULT 'fa-box',
  `color` varchar(20) DEFAULT '#6366f1',
  `estado` enum('activo','inactivo') NOT NULL DEFAULT 'activo',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

LOCK TABLES `categorias` WRITE;
/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
INSERT INTO `categorias` VALUES (1,'Laptops','Computadoras portatiles','fa-laptop','#6366f1','activo','2026-11-19 21:43:57','2026-11-19 21:43:57'),(2,'Desktops','Computadoras de escritorio','fa-desktop','#0ea5e9','activo','2026-11-19 21:43:57','2026-11-19 21:43:57'),(3,'Monitores','Pantallas y monitores','fa-tv','#10b981','activo','2026-11-19 21:43:57','2026-11-19 21:43:57'),(4,'Perifericos','Teclados, mouse, etc.','fa-keyboard','#f59e0b','activo','2026-11-19 21:43:57','2026-11-19 21:43:57'),(5,'Componentes','RAM, SSD, CPU, GPU','fa-microchip','#ef4444','activo','2026-11-19 21:43:57','2026-11-19 21:43:57'),(6,'Redes','Routers, switches, cables','fa-network-wired','#8b5cf6','activo','2026-11-19 21:43:57','2026-11-19 21:43:57'),(7,'Accesorios','Fundas, soportes, etc.','fa-headphones','#ec4899','activo','2026-11-19 21:43:57','2026-11-19 21:43:57');
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `dni` varchar(20) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `fk_clientes_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
INSERT INTO `clientes` VALUES (1,'Juan','Perez','cliente@ventas.com','966666666','Av. Principal 123','12345678',4,'2026-11-19 21:43:57','2026-11-19 21:43:57'),(2,'Ana','Garcia','ana.garcia@email.com','955555555','Calle Los Olmos 456','87654321',NULL,'2026-11-19 21:43:57','2026-11-19 21:43:57'),(3,'Luis','Martinez','luis.martinez@email.com','944444444','Jr. Las Flores 789','11223344',NULL,'2026-11-19 21:43:57','2026-11-19 21:43:57');
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `configuracion`
--

DROP TABLE IF EXISTS `configuracion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `configuracion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `clave` varchar(80) NOT NULL,
  `valor` text DEFAULT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clave` (`clave`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `configuracion`
--

LOCK TABLES `configuracion` WRITE;
/*!40000 ALTER TABLE `configuracion` DISABLE KEYS */;
INSERT INTO `configuracion` VALUES (1,'empresa_nombre','GALAX PC REPAIR','Nombre de la empresa'),(2,'empresa_ruc','20123456789','RUC de la empresa'),(3,'empresa_direccion','Av. Tecnologia 100, Lima','Direccion de la empresa'),(4,'empresa_telefono','01-2345678','Telefono de contacto'),(5,'empresa_email','contacto@galaxpcrepair.com','Email de contacto'),(6,'igv_porcentaje','18','Porcentaje de IGV'),(7,'moneda','S/','Simbodo de moneda'),(8,'stock_alerta','5','Stock minimo para alerta'),(9,'promo_fin','2026-11-22 23:59:59','DEMO: fecha de finalizacion de la promocion mostrada en el hero; cambiar en Configuracion'),(10,'whatsapp_numero','+51 986 260 738','Numero real de WhatsApp para contacto');
/*!40000 ALTER TABLE `configuracion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `detalle_ventas`
--

DROP TABLE IF EXISTS `detalle_ventas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `detalle_ventas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `venta_id` int(11) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `precio_unitario` decimal(10,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `venta_id` (`venta_id`),
  KEY `producto_id` (`producto_id`),
  CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detalle_ventas`
--

LOCK TABLES `detalle_ventas` WRITE;
/*!40000 ALTER TABLE `detalle_ventas` DISABLE KEYS */;
/*!40000 ALTER TABLE `detalle_ventas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migraciones`
--

DROP TABLE IF EXISTS `migraciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migraciones` (
  `version` varchar(80) NOT NULL,
  `aplicada_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migraciones`
--

LOCK TABLES `migraciones` WRITE;
/*!40000 ALTER TABLE `migraciones` DISABLE KEYS */;
INSERT INTO `migraciones` VALUES ('001_phase1_security.sql','2026-11-19 22:47:00');
/*!40000 ALTER TABLE `migraciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permisos`
--

DROP TABLE IF EXISTS `permisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permisos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo` varchar(80) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permisos_codigo` (`codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permisos`
--

LOCK TABLES `permisos` WRITE;
/*!40000 ALTER TABLE `permisos` DISABLE KEYS */;
INSERT INTO `permisos` VALUES (1,'dashboard','Panel','Acceso al panel principal','2026-11-19 22:47:00'),(2,'productos','Productos','Gesti├│n de cat├ílogo','2026-11-19 22:47:00'),(3,'categorias','Categor├¡as','Gesti├│n de categor├¡as','2026-11-19 22:47:00'),(4,'clientes','Clientes','Gesti├│n de clientes','2026-11-19 22:47:00'),(5,'ventas','Ventas','Gesti├│n de ventas','2026-11-19 22:47:00'),(6,'soporte','Soporte','Gesti├│n de tickets','2026-11-19 22:47:00'),(7,'usuarios','Usuarios','Gesti├│n de usuarios','2026-11-19 22:47:00'),(8,'roles','Roles','Gesti├│n de roles y permisos','2026-11-19 22:47:00'),(9,'configuracion','Configuraci├│n','Par├ímetros del sistema','2026-11-19 22:47:00'),(10,'mis_compras','Mis compras','Historial de compras del cliente','2026-11-19 22:47:00');
/*!40000 ALTER TABLE `permisos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `productos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `categoria_id` int(11) NOT NULL,
  `marca` varchar(80) DEFAULT NULL,
  `modelo` varchar(80) DEFAULT NULL,
  `precio_compra` decimal(10,2) NOT NULL DEFAULT 0.00,
  `precio_venta` decimal(10,2) NOT NULL DEFAULT 0.00,
  `stock` int(11) NOT NULL DEFAULT 0,
  `stock_minimo` int(11) NOT NULL DEFAULT 5,
  `imagen` varchar(255) DEFAULT NULL,
  `estado` enum('activo','inactivo') NOT NULL DEFAULT 'activo',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `destacado` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `categoria_id` (`categoria_id`),
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productos`
--

LOCK TABLES `productos` WRITE;
/*!40000 ALTER TABLE `productos` DISABLE KEYS */;
INSERT INTO `productos` VALUES (1,'LAP-001','Laptop HP Pavilion 15','Intel Core i5 12th Gen, 8GB RAM, 512GB SSD, 15.6\"',1,'HP','Pavilion 15',2200.00,2899.00,12,3,'assets/img/productos/LAP-001.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',1),(2,'LAP-002','Laptop Lenovo IdeaPad 3','Ryzen 5 5500U, 8GB RAM, 256GB SSD',1,'Lenovo','IdeaPad 3',1800.00,2399.00,8,3,'assets/img/productos/LAP-002.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',0),(3,'LAP-003','Laptop Asus VivoBook 15','Intel Core i7, 16GB RAM, 512GB SSD',1,'Asus','VivoBook 15',2600.00,3499.00,5,2,'assets/img/productos/LAP-003.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',1),(4,'DES-001','PC Desktop Gamer','Ryzen 7, 16GB RAM, RTX 3060, 1TB SSD',2,'Custom','Gamer Pro',3500.00,4599.00,4,2,'assets/img/productos/DES-001.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',1),(5,'MON-001','Monitor LG 24\" Full HD','IPS, 75Hz, HDMI/VGA',3,'LG','24MK430',450.00,699.00,15,5,'assets/img/productos/MON-001.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',0),(6,'MON-002','Monitor Samsung 27\" Curvo','VA, 144Hz, QHD',3,'Samsung','LC27G55T',900.00,1299.00,6,2,'assets/img/productos/MON-002.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',1),(7,'PER-001','Teclado Mecanico RGB','Switches Blue, retroiluminado',4,'Redragon','K552',120.00,199.00,25,5,'assets/img/productos/PER-001.svg','activo','2026-11-19 21:43:57','2026-11-19 22:07:38',0),(8,'PER-002','Mouse Gamer Logitech G502','16000 DPI, 11 botones',4,'Logitech','G502 Hero',180.00,279.00,20,5,'assets/img/productos/PER-002.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',1),(9,'COM-001','Memoria RAM 16GB DDR4','3200MHz, CL16',5,'Kingston','Fury Beast',180.00,269.00,30,8,'assets/img/productos/COM-001.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',0),(10,'COM-002','SSD NVMe 1TB','PCIe 3.0, lectura 3500MB/s',5,'Samsung','970 EVO Plus',320.00,489.00,18,5,'assets/img/productos/COM-002.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',1),(11,'RED-001','Router TP-Link Archer AX50','WiFi 6, AX3000',6,'TP-Link','Archer AX50',220.00,349.00,10,3,'assets/img/productos/RED-001.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',0),(12,'ACC-001','Auriculares HyperX Cloud II','7.1 Surround, microfono desmontable',7,'HyperX','Cloud II',280.00,399.00,14,4,'assets/img/productos/ACC-001.svg','activo','2026-11-19 21:43:57','2026-11-19 21:58:55',1);
/*!40000 ALTER TABLE `productos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `respuestas_tickets`
--

DROP TABLE IF EXISTS `respuestas_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `respuestas_tickets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ticket_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `mensaje` text NOT NULL,
  `adjunto` varchar(255) DEFAULT NULL,
  `es_interno` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `fk_respuestas_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_respuestas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `respuestas_tickets`
--

LOCK TABLES `respuestas_tickets` WRITE;
/*!40000 ALTER TABLE `respuestas_tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `respuestas_tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rol_permiso`
--

DROP TABLE IF EXISTS `rol_permiso`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rol_permiso` (
  `rol_id` int(11) NOT NULL,
  `permiso_id` int(11) NOT NULL,
  PRIMARY KEY (`rol_id`,`permiso_id`),
  KEY `idx_rol_permiso_permiso` (`permiso_id`),
  CONSTRAINT `fk_rolpermiso_permiso` FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rolpermiso_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rol_permiso`
--

LOCK TABLES `rol_permiso` WRITE;
/*!40000 ALTER TABLE `rol_permiso` DISABLE KEYS */;
INSERT INTO `rol_permiso` VALUES (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),(2,1),(2,2),(2,3),(2,4),(2,5),(3,1),(3,2),(3,4),(3,6),(4,1),(4,2),(4,6),(4,10);
/*!40000 ALTER TABLE `rol_permiso` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `permisos` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'Administrador','Control total del sistema','dashboard,productos,categorias,clientes,ventas,soporte,usuarios,roles,configuracion','2026-11-19 21:43:57','2026-11-19 21:43:57'),(2,'Vendedor','Gestion de ventas y clientes','dashboard,productos,categorias,clientes,ventas','2026-11-19 21:43:57','2026-11-19 21:43:57'),(3,'Soporte','Atencion de tickets de soporte','dashboard,soporte,clientes,productos','2026-11-19 21:43:57','2026-11-19 21:43:57'),(4,'Cliente','Cliente final - compras y soporte','dashboard,productos,soporte,mis_compras','2026-11-19 21:43:57','2026-11-19 21:43:57');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tickets`
--

DROP TABLE IF EXISTS `tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tickets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo` varchar(30) NOT NULL,
  `asunto` varchar(200) NOT NULL,
  `descripcion` text NOT NULL,
  `cliente_id` int(11) DEFAULT NULL,
  `usuario_id` int(11) NOT NULL,
  `asignado_a` int(11) DEFAULT NULL,
  `prioridad` enum('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
  `estado` enum('abierto','en_proceso','resuelto','cerrado') NOT NULL DEFAULT 'abierto',
  `categoria` varchar(80) DEFAULT 'general',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `cliente_id` (`cliente_id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `asignado_a` (`asignado_a`),
  CONSTRAINT `fk_tickets_asignado` FOREIGN KEY (`asignado_a`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tickets_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tickets_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tickets`
--

LOCK TABLES `tickets` WRITE;
/*!40000 ALTER TABLE `tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `rol_id` int(11) NOT NULL DEFAULT 4,
  `estado` enum('activo','inactivo','bloqueado') NOT NULL DEFAULT 'activo',
  `ultimo_acceso` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `rol_id` (`rol_id`),
  CONSTRAINT `fk_usuarios_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'Administrador','Sistema','admin@ventas.com','$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.','999999999',NULL,NULL,1,'activo','2026-11-19 18:06:09','2026-11-19 21:43:57','2026-11-19 23:06:09'),(2,'Carlos','Vendedor','vendedor@ventas.com','$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.','988888888',NULL,NULL,2,'activo',NULL,'2026-11-19 21:43:57','2026-11-19 21:43:57'),(3,'Maria','Soporte','soporte@ventas.com','$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.','977777777',NULL,NULL,3,'activo',NULL,'2026-11-19 21:43:57','2026-11-19 21:43:57'),(4,'Juan','Cliente','cliente@ventas.com','$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.','966666666',NULL,NULL,4,'activo',NULL,'2026-11-19 21:43:57','2026-11-19 21:43:57'),(5,'Venta','Web','web@galaxpcrepair.com','$2y$10$OFEVHUP7p89jyWs.7oHe1eWGNhCkgI0REwnbaAMi97Ded5z62uAO.',NULL,NULL,NULL,4,'activo',NULL,'2026-11-19 21:58:55','2026-11-19 22:17:29');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ventas`
--

DROP TABLE IF EXISTS `ventas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ventas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo` varchar(30) NOT NULL,
  `cliente_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `igv` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `metodo_pago` enum('efectivo','tarjeta','transferencia','yape','plin') NOT NULL DEFAULT 'efectivo',
  `estado` enum('pendiente','pagado','cancelado','entregado') NOT NULL DEFAULT 'pendiente',
  `notas` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `cliente_id` (`cliente_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `fk_ventas_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_ventas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ventas`
--

LOCK TABLES `ventas` WRITE;
/*!40000 ALTER TABLE `ventas` DISABLE KEYS */;
/*!40000 ALTER TABLE `ventas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'ventas_informatica'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-20 16:03:28
