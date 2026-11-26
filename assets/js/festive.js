/* =====================================================================
   GALAX PC REPAIR — efectos festivos configurables, zona America/Lima.
   Decorativos: canvas pointer-events:none, no alteran carrito ni precios.
   ===================================================================== */
(function () {
  'use strict';
  const TZ = 'America/Lima';
  let canvas = null;
  let ctx = null;
  let particles = [];
  let raf = 0;
  let running = false;
  let activeEvent = null;
  let lastTime = 0;
  let isPreview = false;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function nowInLima() {
    return new Date();
  }
  function eventActive(event, date) {
    if (!event || event.enabled === false) return false;
    const start = new Date(event.start || event.start_at).getTime();
    const end = new Date(event.end || event.end_at).getTime();
    const t = (date || nowInLima()).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && t >= start && t <= end;
  }
  function pickActive(events, date) {
    if (!Array.isArray(events)) return null;
    return events.filter((e) => eventActive(e, date)).sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;
  }
  function normalizeCloud(row) {
    return {
      id: 'db-' + row.id,
      name: row.name,
      theme: row.theme,
      effect: row.effect,
      message: row.message,
      cta: { text: row.cta_text, url: row.cta_url },
      colors: row.colors || ['#22d3ee', '#8b5cf6', '#ffffff'],
      density: row.density,
      priority: row.priority,
      start: row.start_at,
      end: row.end_at,
      enabled: row.enabled
    };
  }

  async function getEvents() {
    const state = window.GALAX && window.GALAX.state;
    let events = (state && state.festive && state.festive.events) || [];
    try {
      if (window.GalaxCloud && window.GalaxCloud.configured()) {
        const remote = await window.GalaxCloud.listFestive();
        if (Array.isArray(remote) && remote.length) events = remote.map(normalizeCloud);
      }
    } catch (error) {
      console.warn('[GALAX] Efectos festivos: se usa la programación local.', error.message);
    }
    return events;
  }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'festive-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (activeEvent) start();
    });
  }
  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function rand(min, max) { return min + Math.random() * (max - min); }

  function createParticle(effect, color, initial) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const base = { x: rand(0, w), y: initial ? rand(-h * .1, h) : rand(-80, -10), color, opacity: rand(.35, .9), rot: rand(0, Math.PI * 2), vr: rand(-.025, .025), size: rand(3, 7) };
    if (effect === 'confetti' || effect === 'ribbons') {
      return Object.assign(base, { vy: rand(.7, 2.2), vx: rand(-.55, .55), size: rand(4, 9), shape: Math.random() > .5 ? 'rect' : 'ribbon', sway: rand(.4, 1.2), phase: rand(0, 6.28) });
    }
    if (effect === 'hearts' || effect === 'petals') {
      return Object.assign(base, { vy: rand(.35, 1.1), vx: rand(-.3, .3), size: rand(6, 13), shape: effect === 'hearts' ? 'heart' : 'petal', sway: rand(.3, .9), phase: rand(0, 6.28) });
    }
    if (effect === 'snow') {
      return Object.assign(base, { vy: rand(.35, 1.3), vx: rand(-.25, .25), size: rand(1.2, 3.4), shape: 'dot', sway: rand(.3, .9), phase: rand(0, 6.28) });
    }
    if (effect === 'embers') {
      return Object.assign(base, { vy: rand(-.7, -.2), vx: rand(-.25, .25), size: rand(1, 3), shape: 'dot', sway: rand(.2, .6), phase: rand(0, 6.28) });
    }
    if (effect === 'stars') {
      return Object.assign(base, { vy: rand(.12, .4), vx: rand(-.1, .1), size: rand(1, 2.7), shape: 'star', sway: rand(.2, .5), phase: rand(0, 6.28) });
    }
    // spark
    return Object.assign(base, { vy: rand(.25, .9), vx: rand(-.25, .25), size: rand(1.2, 2.8), shape: 'dot', sway: rand(.2, .8), phase: rand(0, 6.28) });
  }

  function buildParticles(event, initial) {
    if (!ctx) return;
    const baseDensity = Math.max(12, Math.min(Number(event.density) || 45, 100));
    const small = window.innerWidth < 700;
    const lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    const count = Math.round(baseDensity * (small ? .55 : 1) * (lowPower ? .65 : 1));
    particles = [];
    const colors = event.colors && event.colors.length ? event.colors : ['#22d3ee', '#8b5cf6', '#ffffff'];
    for (let i = 0; i < count; i++) particles.push(createParticle(event.effect, colors[i % colors.length], initial));
  }

  function drawHeart(c, x, y, size, color, alpha, rot) {
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = alpha; c.fillStyle = color;
    c.beginPath(); c.moveTo(0, size * .3);
    c.bezierCurveTo(-size, -size * .5, -size * .6, -size * 1.1, 0, -size * .45);
    c.bezierCurveTo(size * .6, -size * 1.1, size, -size * .5, 0, size * .3);
    c.fill(); c.restore();
  }
  function drawStar(c, x, y, size, color, alpha, rot) {
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = alpha; c.fillStyle = color;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size : size * .42;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.fill(); c.restore();
  }
  function drawPetal(c, x, y, size, color, alpha, rot) {
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = alpha; c.fillStyle = color;
    c.beginPath(); c.ellipse(0, 0, size * .52, size, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }

  function frame(time) {
    if (!running || !ctx) return;
    if (time - lastTime < 33) { raf = requestAnimationFrame(frame); return; }
    lastTime = time;
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    const effect = activeEvent.effect;
    for (const p of particles) {
      p.phase += .015;
      p.x += p.vx + Math.sin(p.phase) * p.sway * .45;
      p.y += p.vy;
      p.rot += p.vr;
      if (effect !== 'embers' && p.y > h + 20) { p.y = rand(-50, -10); p.x = rand(0, w); }
      if (effect === 'embers' && p.y < -20) { p.y = h + rand(5, 40); p.x = rand(0, w); }
      if (p.x < -30) p.x = w + 20;
      if (p.x > w + 30) p.x = -20;
      if (p.shape === 'heart') drawHeart(ctx, p.x, p.y, p.size, p.color, p.opacity, p.rot);
      else if (p.shape === 'star') drawStar(ctx, p.x, p.y, p.size, p.color, p.opacity, p.rot);
      else if (p.shape === 'petal') drawPetal(ctx, p.x, p.y, p.size, p.color, p.opacity, p.rot);
      else if (p.shape === 'ribbon') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.opacity; ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, p.size / 3); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(p.size * 1.5, p.size, p.size, p.size * 2.4); ctx.stroke(); ctx.restore();
      } else {
        ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color;
        if (effect === 'confetti') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 5, p.size, p.size / 2.5); ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!activeEvent || !window.GALAX || !GALAX.settings.effects) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.body.classList.contains('reduced-fx') && !isPreview) return;
    ensureCanvas();
    if (!ctx) return;
    running = true;
    cancelAnimationFrame(raf);
    buildParticles(activeEvent, true);
    lastTime = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function dismissKey(event) { return 'galax_festive_' + (event && event.id ? event.id : 'none'); }
  function isDismissed(event) {
    try { return sessionStorage.getItem(dismissKey(event)) === '1'; } catch { return false; }
  }
  function dismiss(event) {
    try { sessionStorage.setItem(dismissKey(event), '1'); } catch {}
    const banner = document.querySelector('.festive-banner');
    if (banner) banner.remove();
  }

  function renderBanner(event) {
    document.querySelectorAll('.festive-banner').forEach((el) => el.remove());
    if (!event || isDismissed(event)) return;
    const header = document.getElementById('site-header');
    if (!header) return;
    const banner = document.createElement('div');
    banner.className = 'festive-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = '<div class="container">' + GALAX.icon('sparkles') + '<span><strong>' + GALAX.esc(event.name) + ':</strong> ' + GALAX.esc(event.message || '') + '</span>' +
      (event.cta && event.cta.text ? '<a href="' + GALAX.esc(event.cta.url || 'tienda.html') + '">' + GALAX.esc(event.cta.text) + '</a>' : '') +
      '<button type="button" aria-label="Cerrar aviso festivo">' + GALAX.icon('close', 'icon-sm') + '</button></div>';
    header.insertAdjacentElement('afterend', banner);
    banner.querySelector('button').addEventListener('click', () => dismiss(event));
  }

  function apply(events) {
    const event = pickActive(events);
    activeEvent = event;
    renderBanner(event);
    if (!event) { stop(); return; }
    if (!GALAX.settings.effects) { stop(); return; }
    start();
  }

  async function init() {
    if (!window.GALAX) return;
    await GALAX.ready();
    const events = await getEvents();
    apply(events);
    GALAX.on('settings', () => { if (activeEvent) { if (GALAX.settings.effects && GALAX.settings.motion) start(); else stop(); } });
    GALAX.on('ready', async () => { const list = await getEvents(); apply(list); });
  }

  function preview(event) {
    isPreview = true;
    activeEvent = event;
    if (!window.GALAX || !GALAX.settings.effects) { isPreview = false; return; }
    ensureCanvas();
    start();
    renderBanner(event);
    setTimeout(() => { isPreview = false; }, 5000);
  }
  function stopPreview() {
    isPreview = false;
    stop();
    document.querySelectorAll('.festive-banner').forEach((el) => el.remove());
  }

  window.GalaxFestive = { init, apply, preview, stopPreview, active: () => activeEvent, pickActive, eventActive, TZ };
  if (window.GALAX) init();
  else document.addEventListener('galax:ready', init, { once: true });
})();
