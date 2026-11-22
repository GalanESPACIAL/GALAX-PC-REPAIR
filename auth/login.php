<?php
require_once __DIR__ . '/../includes/functions.php';
if (isLoggedIn()) {
    redirect(BASE_URL . '/shop/portal.php');
}
$pageTitle = 'Iniciar sesión';
$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $email = trim((string)($_POST['email'] ?? ''));
    $pass = (string)($_POST['password'] ?? '');
    if ($email === '' || $pass === '') {
        $errors[] = 'Complete todos los campos';
    } elseif (is_login_locked($email)) {
        $errors[] = 'Demasiados intentos fallidos. Espere 15 minutos antes de volver a intentar.';
    } elseif (login($email, $pass)) {
        flash('success', 'Bienvenido de vuelta, ' . currentUser()['nombre'] . '.');
        redirect(hasPermission('dashboard') || isStaff() ? BASE_URL . '/dashboard/index.php' : BASE_URL . '/shop/portal.php');
    } else {
        $errors[] = 'Credenciales incorrectas o cuenta inactiva';
    }
}
require_once __DIR__ . '/../includes/header.php';
?>
<div class="auth-card">
  <div class="logo">
    <i class="fa-solid fa-microchip"></i>
    <h1>GALAX PC REPAIR</h1>
    <p>Venta, reparación y asistencia técnica</p>
  </div>
  <?php if ($errors): ?>
    <div class="alert alert-danger"><i class="fa-solid fa-circle-xmark"></i> <?= h(implode('. ', $errors)) ?></div>
  <?php endif; ?>
  <?php if ($m = flash('success')): ?>
    <div class="alert alert-success"><i class="fa-solid fa-circle-check"></i> <?= h($m) ?></div>
  <?php endif; ?>
  <form method="POST" autocomplete="on">
    <?= csrf_field() ?>
    <div class="form-group">
      <label class="form-label">Correo electrónico</label>
      <input type="email" name="email" class="form-control" autocomplete="username" maxlength="254" required value="<?= old('email') ?>">
    </div>
    <div class="form-group">
      <label class="form-label">Contraseña</label>
      <input type="password" name="password" class="form-control" autocomplete="current-password" required>
    </div>
    <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px;">
      <i class="fa-solid fa-right-to-bracket"></i> Ingresar
    </button>
  </form>
  <div style="text-align:center;margin-top:18px;color:var(--muted);font-size:.85rem;">
    ¿No tiene cuenta? <a href="<?= BASE_URL ?>/auth/register.php" style="color:var(--accent);">Regístrese aquí</a>
    · <a href="<?= BASE_URL ?>/auth/recover.php" style="color:var(--accent);">Olvidé mi contraseña</a>
  </div>
  <div style="text-align:center;margin-top:12px;">
    <a class="chip" href="<?= BASE_URL ?>/shop/index.php"><i class="fa-solid fa-store"></i> Volver a la tienda</a>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
