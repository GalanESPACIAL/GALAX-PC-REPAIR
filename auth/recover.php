<?php
/** Recuperación de contraseña gestionada por Supabase Auth. */
require_once __DIR__ . '/../includes/functions.php';
$pageTitle = 'Recuperar contraseña';
$errors = [];
$notice = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $email = mb_strtolower(trim((string)($_POST['email'] ?? '')));
    if (!valid_email($email)) {
        $errors[] = 'Correo electrónico inválido';
    } elseif (!supabase_is_configured()) {
        $errors[] = 'La recuperación con Supabase no está configurada en este servidor.';
    } else {
        try {
            supabase_recover($email);
            audit_log('password_recover', 'usuarios', null, 'Solicitud para ' . $email);
            $notice = 'Enviamos un enlace de recuperación a su correo. Revise también la carpeta de spam.';
        } catch (Throwable $e) {
            $errors[] = 'No se pudo enviar el enlace. Intente nuevamente más tarde.';
            error_log('[GALAX][RECOVER] ' . $e->getMessage());
        }
    }
}
require_once __DIR__ . '/../includes/header.php';
?>
<div class="auth-card" style="max-width:480px;">
  <div class="logo">
    <i class="fa-solid fa-key"></i>
    <h1>Recuperar contraseña</h1>
    <p>Le enviaremos un enlace seguro a su correo</p>
  </div>
  <?php if ($errors): ?><div class="alert alert-danger"><i class="fa-solid fa-circle-xmark"></i> <?= h(implode('. ', $errors)) ?></div><?php endif; ?>
  <?php if ($notice !== ''): ?><div class="alert alert-success"><i class="fa-solid fa-envelope-circle-check"></i> <?= h($notice) ?></div><?php endif; ?>
  <form method="POST">
    <?= csrf_field() ?>
    <div class="form-group">
      <label class="form-label">Correo electrónico</label>
      <input type="email" name="email" class="form-control" required maxlength="254" value="<?= old('email') ?>">
    </div>
    <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;">
      <i class="fa-solid fa-paper-plane"></i> Enviar enlace
    </button>
  </form>
  <div style="text-align:center;margin-top:18px;color:var(--muted);font-size:.85rem;">
    <a href="<?= BASE_URL ?>/auth/login.php" style="color:var(--accent);">Volver al inicio de sesión</a>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
