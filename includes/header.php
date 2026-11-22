<?php
/** Layout del panel administrativo (mantiene compatibilidad con los módulos heredados). */
$currentUser = currentUser();
$currentPage = basename($_SERVER['PHP_SELF'] ?? '');
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= h($pageTitle ?? SITE_NAME) ?> — <?= h(company_info()['nombre']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
<link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/theme.css">
</head>
<body>
<?php if (isLoggedIn()): ?>
<div class="app">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <i class="fa-solid fa-microchip"></i>
      <span>GALAX</span><small>PC REPAIR</small>
    </div>
    <nav class="sidebar-nav">
      <a href="<?= BASE_URL ?>/dashboard/index.php" class="nav-item <?= strpos($_SERVER['PHP_SELF'] ?? '', '/dashboard/')!==false?'active':'' ?>"><i class="fa-solid fa-gauge-high"></i><span>Dashboard</span></a>
      <?php if (hasPermission('pedidos')): ?>
      <a href="<?= BASE_URL ?>/modules/orders/index.php" class="nav-item"><i class="fa-solid fa-bag-shopping"></i><span>Pedidos online</span></a>
      <?php endif; ?>
      <?php if (hasPermission('reparaciones')): ?>
      <a href="<?= BASE_URL ?>/modules/repairs/index.php" class="nav-item"><i class="fa-solid fa-laptop-medical"></i><span>Reparaciones</span></a>
      <?php endif; ?>
      <?php if (hasPermission('productos')): ?>
      <a href="<?= BASE_URL ?>/modules/products/index.php" class="nav-item"><i class="fa-solid fa-box"></i><span>Productos</span></a>
      <?php endif; ?>
      <?php if (hasPermission('categorias')): ?>
      <a href="<?= BASE_URL ?>/modules/categories/index.php" class="nav-item"><i class="fa-solid fa-tags"></i><span>Categorías</span></a>
      <?php endif; ?>
      <?php if (hasPermission('inventario')): ?>
      <a href="<?= BASE_URL ?>/modules/inventory/index.php" class="nav-item"><i class="fa-solid fa-boxes-stacked"></i><span>Inventario</span></a>
      <?php endif; ?>
      <?php if (hasPermission('clientes')): ?>
      <a href="<?= BASE_URL ?>/modules/customers/index.php" class="nav-item"><i class="fa-solid fa-users"></i><span>Clientes</span></a>
      <?php endif; ?>
      <?php if (hasPermission('ventas')): ?>
      <a href="<?= BASE_URL ?>/modules/sales/index.php" class="nav-item"><i class="fa-solid fa-cash-register"></i><span>Ventas POS</span></a>
      <?php endif; ?>
      <?php if (hasPermission('reportes')): ?>
      <a href="<?= BASE_URL ?>/modules/reports/index.php" class="nav-item"><i class="fa-solid fa-chart-column"></i><span>Reportes</span></a>
      <?php endif; ?>
      <?php if (hasPermission('soporte')): ?>
      <a href="<?= BASE_URL ?>/modules/support/index.php" class="nav-item"><i class="fa-solid fa-headset"></i><span>Soporte</span></a>
      <?php endif; ?>
      <?php if (hasPermission('usuarios')): ?>
      <a href="<?= BASE_URL ?>/modules/users/index.php" class="nav-item"><i class="fa-solid fa-user-shield"></i><span>Usuarios</span></a>
      <?php endif; ?>
      <?php if (hasPermission('roles')): ?>
      <a href="<?= BASE_URL ?>/modules/roles/index.php" class="nav-item"><i class="fa-solid fa-key"></i><span>Roles y permisos</span></a>
      <?php endif; ?>
      <?php if (hasPermission('configuracion')): ?>
      <a href="<?= BASE_URL ?>/modules/page_editor/index.php" class="nav-item"><i class="fa-solid fa-pen-ruler"></i><span>Editor de página web</span></a>
      <a href="<?= BASE_URL ?>/modules/settings/index.php" class="nav-item"><i class="fa-solid fa-gear"></i><span>Configuración</span></a>
      <?php endif; ?>
    </nav>
    <div class="sidebar-footer">
      <div class="user-mini">
        <img class="avatar-img" src="<?= h(avatar_url_from_stored($currentUser['avatar'] ?? null)) ?>" alt="Avatar">
        <div class="info">
          <strong><?= h($currentUser['nombre']) ?></strong>
          <small><?= h($currentUser['rol_nombre']) ?></small>
        </div>
      </div>
      <a href="<?= BASE_URL ?>/auth/logout.php" class="logout-btn" title="Cerrar sesión"><i class="fa-solid fa-right-from-bracket"></i></a>
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <button class="menu-toggle" id="menuToggle"><i class="fa-solid fa-bars"></i></button>
      <div class="topbar-title"><?= h($pageTitle ?? 'Dashboard') ?></div>
      <div class="topbar-actions">
        <a class="icon-btn" href="<?= BASE_URL ?>/shop/index.php" title="Ver tienda"><i class="fa-solid fa-store"></i></a>
        <a class="icon-btn" href="<?= BASE_URL ?>/shop/portal.php" title="Mi cuenta"><i class="fa-solid fa-user"></i></a>
        <?php $tc = (int)db()->query("SELECT COUNT(*) c FROM tickets WHERE estado IN ('abierto','en_proceso')")->fetchColumn(); ?>
        <a class="icon-btn" href="<?= BASE_URL ?>/modules/support/index.php" title="Soporte">
          <i class="fa-solid fa-bell"></i>
          <?php if ($tc > 0): ?><span class="dot"><?= $tc ?></span><?php endif; ?>
        </a>
      </div>
    </header>
    <main class="content">
      <?php if ($m = flash('success')): ?><div class="alert alert-success animate-in"><i class="fa-solid fa-circle-check"></i> <?= h($m) ?></div><?php endif; ?>
      <?php if ($m = flash('error')): ?><div class="alert alert-danger animate-in"><i class="fa-solid fa-circle-xmark"></i> <?= h($m) ?></div><?php endif; ?>
<?php else: ?>
<div class="auth-wrapper" style="background:radial-gradient(900px 500px at 15% -10%,rgba(79,70,229,.25),transparent 60%),linear-gradient(180deg,#080d1f,#0f1732);min-height:100vh;">
<?php endif; ?>
