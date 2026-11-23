<?php
/**
 * Layout público de la tienda GALAX PC REPAIR.
 * Variables esperadas: $pageTitle, $activeNav (opcional).
 */
require_once __DIR__ . '/functions.php';

$company = company_info();
$cartCount = 0;
try { $cartCount = cart_count(); } catch (Throwable $e) { /* BD no disponible */ }
$activeNav = $activeNav ?? '';
$storeUser = currentUser();
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="description" content="<?= h($company['nombre']) ?> — Venta de componentes y equipos, reparación técnica y asistencia con IA.">
<title><?= h($pageTitle ?? 'Inicio') ?> — <?= h($company['nombre']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
<link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/theme.css">
</head>
<body class="store-body">
<header class="site-header">
  <div class="site-header-inner">
    <button class="header-icon mobile-menu-btn" id="storeMenuBtn" aria-label="Abrir menú" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>
    <a class="brand-mark" href="<?= BASE_URL ?>/shop/index.php">
      <img class="brand-logo" src="<?= h(product_image_url('assets/img/logo.jpeg')) ?>" alt="GALAX PC REPAIR" loading="lazy">
      <span class="brand-name">GALAX <span class="gradient-text">PC REPAIR</span><small>TECNOLOGÍA &amp; SERVICIO</small></span>
    </a>
    <nav class="site-nav" id="storeNav" aria-label="Navegación principal">
      <a href="<?= BASE_URL ?>/shop/index.php" class="<?= $activeNav==='inicio'?'active':'' ?>"><i class="fa-solid fa-house"></i> Inicio</a>
      <a href="<?= BASE_URL ?>/shop/catalog.php" class="<?= $activeNav==='catalogo'?'active':'' ?>"><i class="fa-solid fa-store"></i> Catálogo</a>
      <a href="<?= BASE_URL ?>/shop/index.php#servicios" class="<?= $activeNav==='servicios'?'active':'' ?>"><i class="fa-solid fa-screwdriver-wrench"></i> Servicios</a>
      <a href="<?= BASE_URL ?>/shop/repair_request.php" class="<?= $activeNav==='reparacion'?'active':'' ?>"><i class="fa-solid fa-laptop-medical"></i> Reparar mi equipo</a>
      <?php if (isLoggedIn()): ?>
      <a href="<?= BASE_URL ?>/shop/portal.php" class="<?= $activeNav==='portal'?'active':'' ?>"><i class="fa-solid fa-user"></i> Mi cuenta</a>
      <?php if (isStaff()): ?>
      <a href="<?= BASE_URL ?>/dashboard/index.php"><i class="fa-solid fa-gauge-high"></i> Panel</a>
      <?php endif; ?>
      <?php endif; ?>
    </nav>
    <div class="header-actions">
      <a class="header-icon" href="<?= BASE_URL ?>/shop/catalog.php?q=" title="Buscar" aria-label="Buscar"><i class="fa-solid fa-magnifying-glass"></i></a>
      <a class="header-icon" href="<?= BASE_URL ?>/shop/cart.php" title="Carrito" aria-label="Carrito">
        <i class="fa-solid fa-cart-shopping"></i>
        <?php if ($cartCount > 0): ?><span class="count" id="cartCount"><?= $cartCount ?></span><?php endif; ?>
      </a>
      <?php if ($storeUser): ?>
      <a class="header-icon" href="<?= BASE_URL ?>/shop/portal.php" title="Mi cuenta" aria-label="Mi cuenta">
        <img class="avatar-img" src="<?= h(avatar_url_from_stored($storeUser['avatar'] ?? null)) ?>" alt="Avatar de <?= h($storeUser['nombre']) ?>">
      </a>
      <?php else: ?>
      <a class="btn btn-outline btn-sm" href="<?= BASE_URL ?>/auth/login.php"><i class="fa-solid fa-right-to-bracket"></i> Ingresar</a>
      <?php endif; ?>
    </div>
  </div>
</header>

<main class="store-main">
  <?php if ($m = flash('success')): ?>
    <div class="alert alert-success animate-in"><i class="fa-solid fa-circle-check"></i> <?= h($m) ?></div>
  <?php endif; ?>
  <?php if ($m = flash('error')): ?>
    <div class="alert alert-danger animate-in"><i class="fa-solid fa-circle-xmark"></i> <?= h($m) ?></div>
  <?php endif; ?>
