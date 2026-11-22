<?php
/**
 * Registro de clientes con Supabase Auth.
 * La contraseña se envía únicamente a Supabase (nunca se guarda en la BD local).
 * El nombre completo vive en la tabla profiles, separado de las credenciales.
 */
require_once __DIR__ . '/../includes/functions.php';
if (isLoggedIn()) {
    redirect(BASE_URL . '/shop/portal.php');
}
$pageTitle = 'Crear cuenta';
$errors = [];
$notice = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $nombre   = trim((string)($_POST['nombre'] ?? ''));
    $apellido = trim((string)($_POST['apellido'] ?? ''));
    $email    = mb_strtolower(trim((string)($_POST['email'] ?? '')));
    $pass     = (string)($_POST['password'] ?? '');
    $pass2    = (string)($_POST['password2'] ?? '');
    $telefono = trim((string)($_POST['telefono'] ?? ''));

    if (mb_strlen($nombre) < 2 || mb_strlen($nombre) > 100 || mb_strlen($apellido) < 2 || mb_strlen($apellido) > 100) {
        $errors[] = 'Ingrese nombre y apellido válidos';
    }
    if (!valid_email($email)) {
        $errors[] = 'Correo electrónico inválido';
    }
    if (!preg_match('/^[0-9+\s()-]{7,32}$/', $telefono)) {
        $errors[] = 'Teléfono inválido';
    }
    if ($pass !== $pass2) {
        $errors[] = 'Las contraseñas no coinciden';
    }
    if (mb_strlen($pass) < 16) {
        $errors[] = 'La contraseña debe tener al menos 16 caracteres';
    }

    if (!$errors) {
        if (!supabase_is_configured()) {
            $errors[] = 'El registro con Supabase no está configurado en este servidor.';
        } else {
            try {
                $auth = supabase_sign_up($email, $pass, [
                    'nombre'    => $nombre,
                    'apellido'  => $apellido,
                    'telefono'  => $telefono,
                ]);
                $uid = (string)($auth['user']['id'] ?? '');
                if ($uid !== '') {
                    try {
                        supabase_request('POST', '/rest/v1/profiles', [
                            'id'              => $uid,
                            'nombre_completo' => $nombre . ' ' . $apellido,
                            'telefono'        => $telefono,
                        ], true);
                    } catch (Throwable $e) {
                        error_log('[GALAX][PROFILE] ' . $e->getMessage());
                    }
                }
                audit_log('register_supabase', 'usuarios', null, 'Nueva cuenta: ' . $email);
                $notice = 'Cuenta creada. Revise su correo electrónico para confirmarla y luego inicie sesión.';
            } catch (Throwable $e) {
                $msg = $e->getMessage();
                if (stripos($msg, 'already registered') !== false || stripos($msg, '409') !== false) {
                    $errors[] = 'El correo ya está registrado';
                } else {
                    $errors[] = 'No se pudo crear la cuenta. ' . mb_substr($msg, 0, 160);
                }
            }
        }
    }
}
require_once __DIR__ . '/../includes/header.php';
?>
<div class="auth-card" style="max-width:560px;">
  <div class="logo">
    <i class="fa-solid fa-user-plus"></i>
    <h1>Crear cuenta</h1>
    <p>Compre, solicite reparaciones y siga sus pedidos</p>
  </div>
  <?php if ($errors): ?>
    <div class="alert alert-danger"><i class="fa-solid fa-circle-xmark"></i> <?= h(implode('. ', $errors)) ?></div>
  <?php endif; ?>
  <?php if ($notice !== ''): ?>
    <div class="alert alert-success"><i class="fa-solid fa-envelope-circle-check"></i> <?= h($notice) ?></div>
  <?php endif; ?>
  <form method="POST">
    <?= csrf_field() ?>
    <div class="grid grid-2">
      <div class="form-group"><label class="form-label">Nombre</label><input name="nombre" class="form-control" required maxlength="100" value="<?= old('nombre') ?>"></div>
      <div class="form-group"><label class="form-label">Apellido</label><input name="apellido" class="form-control" required maxlength="100" value="<?= old('apellido') ?>"></div>
    </div>
    <div class="form-group"><label class="form-label">Correo electrónico</label><input type="email" name="email" class="form-control" required maxlength="254" value="<?= old('email') ?>"></div>
    <div class="form-group"><label class="form-label">Teléfono</label><input name="telefono" class="form-control" required maxlength="32" value="<?= old('telefono') ?>"></div>
    <div class="grid grid-2">
      <div class="form-group"><label class="form-label">Contraseña (mín. 16 caracteres)</label><input type="password" name="password" class="form-control" minlength="16" required autocomplete="new-password"></div>
      <div class="form-group"><label class="form-label">Confirmar contraseña</label><input type="password" name="password2" class="form-control" minlength="16" required autocomplete="new-password"></div>
    </div>
    <p style="color:var(--muted);font-size:.8rem;">Puede usar letras, números y símbolos. Su contraseña se gestiona de forma segura en Supabase Auth.</p>
    <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px;">
      <i class="fa-solid fa-user-check"></i> Registrarme
    </button>
  </form>
  <div style="text-align:center;margin-top:18px;color:var(--muted);font-size:.85rem;">
    ¿Ya tiene cuenta? <a href="<?= BASE_URL ?>/auth/login.php" style="color:var(--accent);">Inicie sesión</a>
    · <a href="<?= BASE_URL ?>/auth/recover.php" style="color:var(--accent);">Olvidé mi contraseña</a>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
