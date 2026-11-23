/* GALAX PC REPAIR — Interacción de tienda y asistente */
(function () {
  'use strict';

  const BASE = document.querySelector('script[src$="/assets/js/store.js"]')?.src.replace(/\/assets\/js\/store\.js.*$/, '') || '';
  const csrf = document.getElementById('csrfToken')?.value || '';
  const toastEl = document.getElementById('storeToast');
  let toastTimer = null;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }
  window.gxToast = toast;

  /* ---------- Menú móvil ---------- */
  const menuBtn = document.getElementById('storeMenuBtn');
  const nav = document.getElementById('storeNav');
  if (menuBtn && nav) {
    const closeNav = () => {
      nav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    };
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !menuBtn.contains(e.target)) closeNav();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeNav();
    });
  }

  /* ---------- Carrito vía API (sin recargas innecesarias) ---------- */
  document.addEventListener('click', async function (event) {
    const btn = event.target.closest('[data-cart-action]');
    if (!btn) return;
    event.preventDefault();
    const action = btn.dataset.cartAction;
    const productId = parseInt(btn.dataset.productId || '0', 10);
    const qty = parseInt(btn.dataset.qty || '1', 10);
    const body = new URLSearchParams({ action, product_id: String(productId), qty: String(qty) });
    try {
      const response = await fetch(BASE + '/api/cart.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf },
        body: body.toString()
      });
      const data = await response.json();
      if (!data.ok) { toast(data.error || 'No se pudo completar la acción'); return; }
      const countEl = document.getElementById('cartCount');
      if (countEl) countEl.textContent = String(data.count || 0);
      else if ((data.count || 0) > 0 && document.querySelector('.header-actions')) {
        document.querySelector('.header-actions a[href$="/shop/cart.php"]')?.insertAdjacentHTML('beforeend',
          '<span class="count" id="cartCount">' + data.count + '</span>');
      }
      toast(data.message || 'Carrito actualizado');
      if (action === 'add') btn.classList.add('btn-glow');
      setTimeout(() => btn.classList.remove('btn-glow'), 700);
      if (action === 'undo' && data.reload !== false) window.location.reload();
    } catch (e) {
      toast('Error de conexión con el carrito');
    }
  });

  /* ---------- Airi ---------- */
  const launcher = document.getElementById('chatLauncher');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');
  const statusText = document.getElementById('chatStatusText');
  const statusDot = document.getElementById('chatStatusDot');
  const launcherDot = document.getElementById('chatDot');
  let ready = false;

  function setStatus(ok, text) {
    ready = ok;
    if (statusText) statusText.textContent = text ? 'Airi · ' + text : 'Airi';
    if (statusDot) statusDot.classList.toggle('offline', !ok);
    if (launcherDot) launcherDot.classList.toggle('offline', !ok);
  }

  /* Botón de color: cicla paletas del asistente */
  const paletteBtn = document.getElementById('sanaraPalette');
  const PALETTES = [
    ['#4f46e5', '#22d3ee'], ['#7c3aed', '#ec4899'],
    ['#059669', '#34d399'], ['#d97706', '#f59e0b']
  ];
  let paletteIndex = parseInt(localStorage.getItem('sanaraPalette') || '0', 10) || 0;
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function applyPalette() {
    if (!panel) return;
    const [a, b] = PALETTES[paletteIndex];
    panel.style.setProperty('--sx', a);
    panel.style.setProperty('--sy', b);
    panel.style.setProperty('--sx-soft', rgba(a, .35));
    panel.style.setProperty('--sy-soft', rgba(b, .22));
  }
  paletteBtn?.addEventListener('click', () => {
    paletteIndex = (paletteIndex + 1) % PALETTES.length;
    localStorage.setItem('sanaraPalette', String(paletteIndex));
    applyPalette();
  });
  applyPalette();

  /* Botón de voz: elige entre las voces femeninas en español instaladas */
  const voiceBtn = document.getElementById('sanaraVoice');
  voiceBtn?.addEventListener('click', () => {
    const voices = femaleSpanishVoices();
    if (!voices.length) { toast('No hay voces femeninas en español disponibles'); return; }
    const idx = voices.findIndex((v) => v.voiceURI === assistantVoice?.voiceURI);
    const next = voices[(idx + 1) % voices.length];
    assistantVoice = next;
    try { localStorage.setItem(VOICE_STORAGE_KEY, next.voiceURI); } catch (e) {}
    voiceBtn.title = 'Voz: ' + next.name + ' — clic para cambiar';
    voiceBtn.classList.add('active');
    toast('Voz: ' + next.name);
    speakAssistant('Hola, soy Airi. ¿En qué puedo ayudarte?');
  });

  /* Importar imagen en el chat */
  const imageInput = document.getElementById('sanaraImage');
  imageInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file || !messages) return;
    if (!file.type.startsWith('image/')) { toast('Seleccione un archivo de imagen'); return; }
    const url = URL.createObjectURL(file);
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg user';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const img = document.createElement('img');
    img.className = 'chat-image';
    img.src = url;
    img.alt = 'Imagen adjunta';
    bubble.appendChild(img);
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    input.value = '';
    input.focus();
    e.target.value = '';
  });

  /* Voz del asistente: elige la mejor voz femenina en español disponible. */
  const FEMALE_VOICE_HINTS = [
    'helena', 'laura', 'sabina', 'elvira', 'ximena', 'dalia', 'camila', 'valentina',
    'salome', 'salomé', 'monica', 'mónica', 'paulina', 'lucia', 'lucía', 'sofia', 'sofía',
    'isabela', 'renata', 'marisol', 'jimena', 'luna', 'sol', 'carla', 'paula', 'alba',
    'triana', 'abril', 'miranda', 'natalia', 'andrea', 'elena', 'tania', 'vera', 'irene',
    'noelia', 'olalla', 'candela', 'estela', 'gloria', 'lola', 'manuela', 'martina',
    'nuria', 'paloma', 'rocio', 'rocío', 'susana', 'victoria', 'aria', 'jenny', 'michelle',
    'ana', 'clara', 'eva', 'marta', 'sara', 'silvia', 'cristina', 'beatriz', 'raquel',
    'pilar', 'carmen', 'mercedes', 'rosa', 'teresa', 'female', 'femenina', 'mujer'
  ];
  const MALE_VOICE_HINTS = [
    'pablo', 'raul', 'raúl', 'jorge', 'diego', 'carlos', 'juan', 'miguel', 'alvaro',
    'álvaro', 'dario', 'darío', 'enrique', 'gonzalo', 'javier', 'luis', 'pedro',
    'antonio', 'jose', 'josé', 'manuel', 'francisco', 'david', 'daniel', 'sergio',
    'adrian', 'adrián', 'fernando', 'ricardo', 'roberto', 'eduardo', 'alejandro',
    'andres', 'andrés', 'arturo', 'bruno', 'cesar', 'césar', 'elias', 'elías', 'emilio',
    'felix', 'félix', 'hugo', 'ivan', 'iván', 'jesus', 'jesús', 'joaquin', 'joaquín',
    'julio', 'mario', 'martin', 'martín', 'mateo', 'nicolas', 'nicolás', 'oscar',
    'óscar', 'ramon', 'ramón', 'ruben', 'rubén', 'salvador', 'tomas', 'tomás',
    'vicente', 'victor', 'víctor', 'arnau', 'nil', 'oriol', 'pau', 'teo', 'marc',
    'alex', 'alberto', 'alfonso', 'alonso', 'benito', 'borja', 'cristian', 'gabriel',
    'gerardo', 'guillermo', 'ignacio', 'jaime', 'leonardo', 'lorenzo', 'marcos',
    'mohamed', 'omar', 'rafael', 'rodrigo', 'samuel', 'santiago', 'saul', 'saúl',
    'simon', 'simón', 'ulises', 'valentin', 'valentín', 'xavier', 'male', 'masculina', 'hombre'
  ];
  const VOICE_PRIORITY = [
    'laura', 'helena', 'elvira', 'ximena', 'dalia', 'camila', 'valentina', 'sabina',
    'salome', 'salomé', 'elena', 'lucia', 'lucía', 'sofia', 'sofía', 'isabela', 'renata',
    'marisol', 'jimena', 'monica', 'mónica', 'paulina', 'carla', 'paula', 'alba',
    'triana', 'abril', 'miranda', 'natalia', 'andrea', 'tania', 'vera', 'irene',
    'noelia', 'candela', 'estela', 'gloria', 'lola', 'manuela', 'martina', 'nuria',
    'paloma', 'rocio', 'rocío', 'susana', 'victoria'
  ];

  function scoreSpanishVoice(v) {
    const name = (v.name || '').toLowerCase();
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    if (!lang.startsWith('es')) return -Infinity;
    let score = 50;
    if (FEMALE_VOICE_HINTS.some((h) => name.includes(h))) score += 35;
    if (MALE_VOICE_HINTS.some((h) => name.includes(h))) score -= 120;
    if (/natural|neural|online/.test(name)) score += 22;
    if (!v.localService) score += 12;
    if (lang === 'es-es') score += 8;
    else if (lang === 'es-mx') score += 7;
    else if (lang === 'es-us') score += 5;
    else if (lang === 'es-419') score += 4;
    const idx = VOICE_PRIORITY.findIndex((n) => name.includes(n));
    if (idx >= 0) score += 25 - idx * 0.5;
    if (name.includes('laura')) score += 4;  // timbre cálido y juvenil
    if (name.includes('elvira')) score += 6; // voz natural joven de Edge
    if (name.includes('ximena') || name.includes('dalia')) score += 3;
    if (v.default) score += 2;
    return score;
  }

  function femaleSpanishVoices() {
    if (!('speechSynthesis' in window)) return [];
    return speechSynthesis.getVoices()
      .map((v) => ({ v, score: scoreSpanishVoice(v) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.v);
  }

  function pickFemaleSpanishVoice() {
    return femaleSpanishVoices()[0] || null;
  }

  const VOICE_STORAGE_KEY = 'sanaraVoiceURI';
  let assistantVoice = null;
  const refreshAssistantVoice = () => {
    const voices = femaleSpanishVoices();
    let saved = null;
    try { saved = localStorage.getItem(VOICE_STORAGE_KEY); } catch (e) {}
    assistantVoice = voices.find((v) => v.voiceURI === saved) || voices[0] || null;
    const btn = document.getElementById('sanaraVoice');
    if (btn && assistantVoice) btn.title = 'Voz: ' + assistantVoice.name + ' — clic para cambiar';
  };
  refreshAssistantVoice();
  if ('speechSynthesis' in window) {
    speechSynthesis.addEventListener?.('voiceschanged', refreshAssistantVoice);
  }

  /* Voz del asistente: habla cada respuesta y mueve la boca mientras habla */
  let speechSeq = 0;
  function speakAssistant(text) {
    if (!('speechSynthesis' in window) || !text) return false;
    try {
      const seq = ++speechSeq;
      speechSynthesis.cancel();
      const clean = String(text).replace(/[•*#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'es-ES';
      utterance.rate = 0.93;   // ritmo pausado, seguro y cercano
      utterance.pitch = 0.99;  // tono femenino adulto, cálido (no infantil)
      utterance.volume = 1;
      const voice = assistantVoice || pickFemaleSpanishVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'es-ES';
      }
      utterance.onstart = () => { if (seq === speechSeq) window.sanaraSpeakStart?.(); };
      utterance.onend = () => { if (seq === speechSeq) window.sanaraSpeakStop?.(); };
      // Si el navegador no puede reproducir audio, se mantiene el respaldo visual.
      utterance.onerror = () => {};
      speechSynthesis.speak(utterance);
      // Respaldo: mover la boca durante la reproducción aunque no disparen onstart/onend.
      window.sanaraSpeak?.(Math.min(9000, Math.max(1800, clean.length * 55)));
      return true;
    } catch (e) {
      return false;
    }
  }

  function addMessage(text, role, products) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg ' + (role === 'user' ? 'user' : 'assistant');
    if (role === 'error') wrap.classList.add('error');
    const avatar = document.createElement('img');
    avatar.className = 'avatar-img';
    avatar.src = BASE + '/assets/img/' + (role === 'user' ? 'neutral-avatar.svg' : 'sanara-avatar.svg');
    avatar.alt = role === 'user' ? 'Tú' : 'Airi';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    if (Array.isArray(products) && products.length) {
      const list = document.createElement('div');
      list.className = 'chat-products';
      products.forEach(function (p) {
        const link = document.createElement('a');
        link.className = 'chat-product';
        link.href = BASE + '/shop/product.php?id=' + encodeURIComponent(p.id) + (p.slug ? '&slug=' + encodeURIComponent(p.slug) : '');
        const img = document.createElement('img');
        img.src = p.imagen_url || (BASE + '/assets/img/product-placeholder.svg');
        img.alt = '';
        const info = document.createElement('span');
        const strong = document.createElement('strong');
        strong.textContent = p.nombre;
        const small = document.createElement('small');
        small.textContent = p.precio;
        info.appendChild(strong); info.appendChild(small);
        link.appendChild(img); link.appendChild(info);
        list.appendChild(link);
      });
      bubble.appendChild(list);
    }
    if (role === 'assistant') {
      const audioBtn = document.createElement('button');
      audioBtn.className = 'msg-audio';
      audioBtn.type = 'button';
      audioBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      audioBtn.title = 'Reproducir audio';
      audioBtn.setAttribute('aria-label', 'Reproducir audio');
      audioBtn.addEventListener('click', () => speakAssistant(text));
      bubble.appendChild(audioBtn);
    }
    wrap.appendChild(avatar); wrap.appendChild(bubble);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    if (role === 'assistant') {
      if (!speakAssistant(text)) window.sanaraSpeak?.(2400);
    } else if (role === 'user') window.sanaraSpeak?.(1400);
  }

  const HEALTH_LABELS = {
    ready: 'Modelo listo',
    unavailable: '',
    loading: 'Cargando modelo…',
    error: ''
  };

  function checkHealth() {
    fetch(BASE + '/api/ai.php?health=1', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(data => setStatus(
        !!data.ready,
        data.ready ? 'Modelo listo' : (HEALTH_LABELS[data.status] || '')
      ))
      .catch(() => setStatus(false, 'Sin conexión con el modelo'));
  }

  document.querySelector('.sanara-welcome [data-audio]')?.addEventListener('click', (e) => {
    e.preventDefault();
    const text = e.currentTarget.closest('.sanara-welcome').innerText.trim();
    speakAssistant(text);
  });

  let greeted = false;
  if (launcher && panel) {
    launcher.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        checkHealth(); input?.focus();
        if (!greeted) {
          greeted = true;
          const welcome = document.querySelector('#chatMessages .chat-msg.assistant .bubble')?.textContent;
          if (welcome) speakAssistant(welcome);
        }
      }
    });
    closeBtn?.addEventListener('click', () => panel.classList.remove('open'));
    checkHealth();
  }

  if (form) {
    input?.addEventListener('input', () => window.sanaraSpeak?.(900));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const text = (input.value || '').trim();
      if (!text) return;
      addMessage(text, 'user');
      input.value = '';
      const typing = document.createElement('div');
      typing.className = 'chat-msg assistant typing';
      typing.innerHTML = '<div class="bubble"><span></span><span></span><span></span></div>';
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;
      window.sanaraSpeak?.(6000);
      try {
        const response = await fetch(BASE + '/api/ai.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          body: JSON.stringify({ message: text })
        });
        const data = await response.json();
        typing.remove();
        if (data.ok) {
          addMessage(data.reply || '', 'assistant', data.products || []);
          setStatus(data.mode === 'ia', data.mode === 'ia' ? 'Modelo listo' : '');
        } else {
          addMessage(data.error || 'No se pudo obtener una respuesta.', 'error');
          if (data.status === 'unavailable') setStatus(false, 'Modelo no disponible');
        }
      } catch (e) {
        typing.remove();
        addMessage('No se pudo conectar con el asistente. Intente nuevamente.', 'error');
        setStatus(false, 'Sin conexión');
      }
    });
  }
})();
