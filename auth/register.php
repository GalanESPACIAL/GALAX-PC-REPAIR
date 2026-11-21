<?php
require_once __DIR__ . '/../includes/functions.php';
if (isLoggedIn()) {
    redirect(BASE_URL . '/shop/portal.php');
}
$pageTitle = 'Crear cuenta';
$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $nombre = trim((string)($_POST['nombre'] ?? ''));
    $apellido = trim((string)($_POST['apellido'] ?? ''));
    $email = mb_strtolower(trim((string)($_POST['email'] ?? '')));
    $pass = (string)($_POST['password'] ?? '');
    $pass2 = (string)($_POST['password2'] ?? '');
    $telefono = trim((string)($_POST['telefono'] ?? ''));
    $avatar = (string)($_POST['avatar'] ?? 'neutro');

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
    if (mb_strlen($pass) < 8) {
        $errors[] = 'La contraseña debe tener al menos 8 caracteres';
    }
    if (!in_array($avatar, array_merge(avatar_candidates(), ['neutro']), true)) {
        $avatar = 'neutro';
    }
    $stmt = db()->prepare('SELECT id FROM usuarios WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        $errors[] = 'El correo ya está registrado';
    }

    if (!$errors) {
        $db = db();
        $db->beginTransaction();
        try {
            $hash = password_hash($pass, PASSWORD_DEFAULT);
            $stmt = $db->prepare(
                "INSERT INTO usuarios (nombre, apellido, email, password, telefono, avatar, rol_id, estado)
                 VALUES (?,?,?,?,?,?,4,'activo')"
            );
            $stmt->execute([$nombre, $apellido, $email, $hash, $telefono, $avatar === 'neutro' ? null : $avatar]);
            $uid = (int)$db->lastInsertId();
            $stmt = $db->prepare(
                'INSERT INTO clientes (nombre, apellido, email, telefono, usuario_id) VALUES (?,?,?,?,?)'
            );
            $stmt->execute([$nombre, $apellido, $email, $telefono, $uid]);
            $db->commit();
            audit_log('register', 'usuarios', $uid, 'Nueva cuenta de cliente');
            flash('success', 'Cuenta creada correctamente. Ahora puede iniciar sesión.');
            redirect(BASE_URL . '/auth/login.php');
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('[GALAX][REGISTER] ' . $e->getMessage());
            $errors[] = 'No se pudo crear la cuenta. Intente nuevamente.';
        }
    }
}
require_once __DIR__ . '/../includes/header.php';
?>
<div class="auth-card" style="max-width:520px;">
  <div class="logo">
    <i class="fa-solid fa-user-plus"></i>
    <h1>Crear cuenta</h1>
    <p>Compre, solicite reparaciones y siga sus pedidos</p>
  </div>
  <?php if ($errors): ?>
    <div class="alert alert-danger"><i class="fa-solid fa-circle-xmark"></i> <?= h(implode('. ', $errors)) ?></div>
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
      <div class="form-group"><label class="form-label">Contraseña</label><input type="password" name="password" class="form-control" minlength="8" required autocomplete="new-password"></div>
      <div class="form-group"><label class="form-label">Confirmar</label><input type="password" name="password2" class="form-control" minlength="8" required autocomplete="new-password"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Elija su avatar</label>
      <div style="display:flex;gap:12px;align-items:center;">
        <?php foreach (array_merge(avatar_candidates(), ['neutro']) as $key): ?>
        <label style="cursor:pointer;" title="<?= h($key) ?>">
          <input type="radio" name="avatar" value="<?= h($key) ?>" <?= old('avatar','neutro')===$key?'checked':'' ?>>
          <img class="avatar" src="<?= h($key==='neutro' ? BASE_URL.'/assets/img/neutral-avatar.svg' : BASE_URL.'/'.AVATAR_FILES[$key]) ?>" alt="<?= h($key) ?>" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
        </label>
        <?php endforeach; ?>
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px;">
      <i class="fa-solid fa-user-check"></i> Registrarme
    </button>
  </form>
  <div style="text-align:center;margin-top:18px;color:var(--muted);font-size:.85rem;">
    ¿Ya tiene cuenta? <a href="<?= BASE_URL ?>/auth/login.php" style="color:var(--accent);">Inicie sesión</a>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
