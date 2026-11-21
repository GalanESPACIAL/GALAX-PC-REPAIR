<?php
require_once __DIR__ . '/../includes/repository.php';
$pageTitle = 'Confirmar pedido';
$activeNav = 'catalogo';
$metodoEntrega = (string)($_POST['metodo_entrega'] ?? 'tienda');
if (!in_array($metodoEntrega, ['tienda', 'domicilio'], true)) {
    $metodoEntrega = 'tienda';
}
$cart = cart_totals($metodoEntrega);
$user = currentUser();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    if (!$cart['items']) {
        flash('error', 'El carrito está vacío.');
        redirect(BASE_URL . '/shop/cart.php');
    }
    $result = place_order($_POST);
    if (!$result['ok']) {
        set_old($_POST);
        flash('error', 'No se pudo confirmar el pedido: ' . $result['error']);
        redirect(BASE_URL . '/shop/checkout.php');
    }
    clear_old();
    flash('success', 'Pedido ' . $result['codigo'] . ' confirmado correctamente.');
    redirect(BASE_URL . '/shop/success.php?pedido=' . (int)$result['id']);
}

if (!$cart['items']) {
    flash('error', 'Agregue productos al carrito antes de confirmar.');
    redirect(BASE_URL . '/shop/cart.php');
}
require_once __DIR__ . '/../includes/store_header.php';
?>
<div class="section-head" style="margin-top:6px;">
  <div><span class="eyebrow">Último paso</span><h1 style="font-size:2rem;">Confirmar pedido</h1><p>Revisa tus datos. El total se recalcula de forma segura en el servidor.</p></div>
  <a class="chip" href="<?= BASE_URL ?>/shop/cart.php"><i class="fa-solid fa-arrow-left"></i> Volver al carrito</a>
</div>

<form method="post" action="<?= BASE_URL ?>/shop/checkout.php" class="store-form">
  <?= csrf_field() ?>
  <div class="cart-layout">
    <div>
      <section class="card" style="padding:22px;margin-bottom:18px;">
        <h2 class="form-section-title" style="margin-top:0;"><i class="fa-solid fa-user"></i> Datos de contacto</h2>
        <div class="grid grid-2">
          <div class="form-group">
            <label for="nombre">Nombre completo *</label>
            <input class="form-control" id="nombre" name="nombre" maxlength="160" required value="<?= old('nombre', $user ? $user['nombre'] . ' ' . $user['apellido'] : '') ?>">
          </div>
          <div class="form-group">
            <label for="documento">DNI / RUC (opcional)</label>
            <input class="form-control" id="documento" name="documento" maxlength="30" value="<?= old('documento') ?>">
          </div>
          <div class="form-group">
            <label for="email">Correo electrónico *</label>
            <input class="form-control" id="email" name="email" type="email" maxlength="254" required value="<?= old('email', $user['email'] ?? '') ?>">
          </div>
          <div class="form-group">
            <label for="telefono">Teléfono / celular *</label>
            <input class="form-control" id="telefono" name="telefono" maxlength="32" required value="<?= old('telefono', $user['telefono'] ?? '') ?>">
          </div>
        </div>
      </section>

      <section class="card" style="padding:22px;margin-bottom:18px;">
        <h2 class="form-section-title" style="margin-top:0;"><i class="fa-solid fa-truck"></i> Entrega y pago</h2>
        <div class="grid grid-2">
          <div class="form-group">
            <label for="metodo_entrega">Método de entrega *</label>
            <select class="form-control" id="metodo_entrega" name="metodo_entrega" required onchange="document.getElementById('direccionGroup').style.display=this.value==='domicilio'?'block':'none'">
              <option value="tienda" <?= old('metodo_entrega')==='tienda'?'selected':'' ?>>Retiro en tienda (sin costo)</option>
              <option value="domicilio" <?= old('metodo_entrega')==='domicilio'?'selected':'' ?>>Envío a domicilio</option>
            </select>
          </div>
          <div class="form-group">
            <label for="metodo_pago">Método de pago *</label>
            <select class="form-control" id="metodo_pago" name="metodo_pago" required>
              <option value="efectivo" <?= old('metodo_pago')==='efectivo'?'selected':'' ?>>Efectivo</option>
              <option value="tarjeta" <?= old('metodo_pago')==='tarjeta'?'selected':'' ?>>Tarjeta</option>
              <option value="transferencia" <?= old('metodo_pago')==='transferencia'?'selected':'' ?>>Transferencia</option>
              <option value="yape" <?= old('metodo_pago')==='yape'?'selected':'' ?>>Yape</option>
              <option value="plin" <?= old('metodo_pago')==='plin'?'selected':'' ?>>Plin</option>
            </select>
          </div>
        </div>
        <div class="form-group" id="direccionGroup" style="display:<?= old('metodo_entrega')==='domicilio'?'block':'none' ?>;">
          <label for="direccion">Dirección de entrega *</label>
          <input class="form-control" id="direccion" name="direccion" maxlength="255" value="<?= old('direccion') ?>" placeholder="Av. Calle y número, distrito">
        </div>
        <div class="form-group">
          <label for="referencia">Referencia (opcional)</label>
          <input class="form-control" id="referencia" name="referencia" maxlength="255" value="<?= old('referencia') ?>">
        </div>
        <div class="form-group">
          <label for="notas">Comentarios (opcional)</label>
          <textarea class="form-control" id="notas" name="notas" rows="3" maxlength="1000"><?= old('notas') ?></textarea>
        </div>
      </section>
    </div>

    <aside class="card" style="padding:20px;position:sticky;top:86px;">
      <h3 style="font-size:1.05rem;margin-bottom:14px;"><i class="fa-solid fa-list-check"></i> Tu pedido</h3>
      <?php foreach ($cart['items'] as $item): ?>
        <div class="summary-row"><span style="max-width:190px;"><?= h($item['nombre']) ?> ×<?= (int)$item['cantidad'] ?></span><strong><?= h(money((float)$item['precio']*(int)$item['cantidad'])) ?></strong></div>
      <?php endforeach; ?>
      <div class="summary-row" style="border-top:1px solid var(--gx-border);margin-top:10px;padding-top:10px;"><span>Subtotal</span><strong><?= h(money($cart['subtotal'])) ?></strong></div>
      <?php if ($cart['descuento'] > 0): ?><div class="summary-row" style="color:#34d399;"><span>Descuento</span><strong>−<?= h(money($cart['descuento'])) ?></strong></div><?php endif; ?>
      <div class="summary-row"><span>Impuestos</span><strong><?= h(money($cart['impuestos'])) ?></strong></div>
      <div class="summary-row"><span>Envío</span><strong><?= $cart['envio'] > 0 ? h(money($cart['envio'])) : 'Gratis' ?></strong></div>
      <div class="summary-row total"><span>Total estimado</span><span><?= h(money($cart['total'])) ?></span></div>
      <button class="btn btn-glow" type="submit" style="width:100%;justify-content:center;margin-top:18px;"><i class="fa-solid fa-check"></i> Confirmar pedido</button>
      <p style="color:var(--gx-muted);font-size:.72rem;margin-top:12px;line-height:1.6;">Al confirmar, el sistema valida stock y precios nuevamente. El envío se agrega si eliges entrega a domicilio.</p>
    </aside>
  </div>
</form>

<?php require_once __DIR__ . '/../includes/store_footer.php'; ?>
