<?php $company = company_info(); ?>
</main>

<button class="chat-launcher" id="chatLauncher" title="Airi" aria-label="Abrir Airi">
  <i class="fa-solid fa-robot"></i><span class="dot" id="chatDot" title="Verificando servicio"></span>
</button>
<aside class="chat-panel sanara-panel" id="chatPanel" aria-label="Airi">
  <div class="sanara-stage">
    <img class="sanara-room" src="<?= BASE_URL ?>/assets/img/samer-room.svg" alt="">
    <div class="sanara-stage-glow"></div>
    <div class="sanara-stage-canvas" data-sanara-avatar>
      <img class="sanara-fallback" src="<?= BASE_URL ?>/assets/img/sanara-avatar.svg" alt="Airi">
    </div>
    <img class="sanara-desk" src="<?= BASE_URL ?>/assets/img/samer-desk.svg" alt="">
    <span class="sanara-mouth" id="sanaraMouth" aria-hidden="true"></span>
    <span class="sanara-stage-label">Airi</span>
  </div>
  <div class="sanara-chat">
    <div class="chat-head sanara-head">
      <div>
        <strong>Airi</strong>
        <small class="chat-status"><span class="pv-live"></span><span id="chatStatusText">Airi · Hablando…</span></small>
      </div>
      <button class="chat-close" id="chatClose" aria-label="Cerrar chat"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="chat-messages sanara-messages" id="chatMessages" role="log" aria-live="polite">
      <div class="chat-msg assistant">
        <div class="bubble sanara-welcome">
          <div class="welcome-title">¡Hola!</div>
          <p>Soy <strong>Airi</strong>, tu asistente oficial de <strong><?= h($company['nombre']) ?></strong>.</p>
          <p class="welcome-lead">Estoy aquí para ayudarte a:</p>
          <ul class="welcome-list">
            <li><i class="fa-solid fa-cart-shopping"></i> Encontrar productos y precios</li>
            <li><i class="fa-solid fa-screwdriver-wrench"></i> Conocer nuestros servicios</li>
            <li><i class="fa-solid fa-laptop-code"></i> Orientarte sobre reparaciones</li>
          </ul>
          <p class="welcome-ask">¿Qué necesitas hoy?</p>
          <button class="msg-audio" type="button" data-audio title="Reproducir audio" aria-label="Reproducir audio"><i class="fa-solid fa-volume-high"></i></button>
        </div>
      </div>
    </div>
    <form class="chat-form sanara-form" id="chatForm">
      <div class="sanara-input-box">
        <label class="pv-plus" title="Importar imagen" aria-label="Importar imagen"><i class="fa-solid fa-plus"></i><input type="file" id="sanaraImage" accept="image/*" hidden></label>
        <button class="pv-tool pv-palette" id="sanaraPalette" type="button" title="Cambiar color" aria-label="Cambiar color"><i class="fa-solid fa-palette"></i></button>
        <button class="pv-tool pv-voice" id="sanaraVoice" type="button" title="Voz femenina" aria-label="Cambiar voz"><i class="fa-solid fa-venus"></i></button>
        <input type="text" id="chatInput" maxlength="400" placeholder="Haz una pregunta" autocomplete="off" required>
        <button class="pv-send" type="submit" aria-label="Enviar"><i class="fa-solid fa-arrow-right"></i></button>
        <button class="pv-mic" type="button" aria-label="Micrófono"><i class="fa-solid fa-microphone"></i></button>
      </div>
    </form>
    <div class="chat-disclaimer">Las respuestas se basan en el catálogo real. Verifica precios antes de comprar.</div>
  </div>
</aside>

<footer class="site-footer">
  <div class="site-footer-inner">
    <div>
      <a class="brand-mark" href="<?= BASE_URL ?>/shop/index.php">
        <span class="brand-glyph sm"><i class="fa-solid fa-microchip"></i></span>
        <span class="brand-name">GALAX <span class="gradient-text">PC REPAIR</span></span>
      </a>
      <p style="margin-top:14px;"><?= h(config_value('eslogan', 'Tecnología que funciona. Servicio en el que confía.')) ?></p>
      <p><?= h($company['direccion'] ?? '') ?></p>
    </div>
    <div>
      <h4>Comprar</h4>
      <a href="<?= BASE_URL ?>/shop/catalog.php">Catálogo completo</a><br>
      <a href="<?= BASE_URL ?>/shop/catalog.php?destacado=1">Destacados</a><br>
      <a href="<?= BASE_URL ?>/shop/catalog.php?oferta=1">Ofertas</a><br>
      <a href="<?= BASE_URL ?>/shop/cart.php">Mi carrito</a>
    </div>
    <div>
      <h4>Atención</h4>
      <a href="<?= BASE_URL ?>/shop/repair_request.php">Solicitar reparación</a><br>
      <a href="<?= BASE_URL ?>/shop/portal.php">Mis pedidos y reparaciones</a><br>
      <a href="tel:<?= h(preg_replace('/[^0-9+]/','',(string)($company['telefono'] ?? ''))) ?>"><?= h($company['telefono'] ?: 'Atención por WhatsApp') ?></a><br>
      <?php if (!empty($company['whatsapp'])): ?>
      <a href="https://wa.me/<?= h(preg_replace('/[^0-9]/','',(string)$company['whatsapp'])) ?>" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
      <?php endif; ?>
    </div>
  </div>
  <div class="footer-bottom">
    © <?= date('Y') ?> <?= h($company['nombre']) ?> · Precios y stock en tiempo real ·
    <a href="<?= BASE_URL ?>/auth/register.php">Crear cuenta</a>
  </div>
</footer>

<div class="toast" id="storeToast" role="status" aria-live="polite"></div>
<input type="hidden" id="csrfToken" value="<?= h(csrf_token()) ?>">
<script src="<?= BASE_URL ?>/assets/js/main.js"></script>
<script src="<?= BASE_URL ?>/assets/js/store.js"></script>
<script type="importmap">
{"imports":{
  "three":"https://unpkg.com/three@0.160.0/build/three.module.js",
  "three/addons/":"https://unpkg.com/three@0.160.0/examples/jsm/"
}}
</script>
<script type="module" src="<?= BASE_URL ?>/assets/js/sanara-avatar.js"></script>
</body>
</html>
