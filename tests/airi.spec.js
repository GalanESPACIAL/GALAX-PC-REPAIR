/** Verificación del widget Airi en 3 viewports. node tests/airi.spec.js */
const { chromium } = require('playwright');
const URL = process.env.GALAX_TEST_URL || 'http://127.0.0.1:8099/docs/galax_preview.html';
const VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 812 },
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  let failed = 0;
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 768, hasTouch: vp.width < 768 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const issues = [];
    await page.goto(URL, { waitUntil: 'load' });
    const btn = page.locator('#chatLauncher, button:has-text("Iniciar Chat")').first();
    await btn.click();
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const rect = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
      const panel = document.querySelector('.chat-panel.sanara-panel');
      const stage = document.querySelector('.sanara-stage');
      const canvas = document.querySelector('.sanara-stage-canvas canvas, .sanara-stage-canvas img, .sanara-stage-canvas video');
      return {
        panel: rect('.chat-panel.sanara-panel'),
        stage: rect('.sanara-stage'),
        canvas: canvas ? (() => { const b = canvas.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; })() : null,
        head: rect('.sanara-head'),
        messages: rect('.sanara-messages'),
        form: rect('.sanara-form'),
        input: rect('.sanara-form input'),
        nav: rect('.mpl-header, .site-header'),
        chatCol: rect('.sanara-chat'),
        panelScroll: panel ? { sw: panel.scrollWidth, cw: panel.clientWidth } : null,
        chatScroll: (() => { const e = document.querySelector('.sanara-chat'); return e ? { sw: e.scrollWidth, cw: e.clientWidth } : null; })(),
        open: panel ? panel.classList.contains('open') : false,
        display: panel ? getComputedStyle(panel).display : null,
      };
    });
    if (!r.open) issues.push('widget no abre');
    if (r.display !== 'grid') issues.push('display=' + r.display + ' (esperado grid)');
    if (r.panel && r.panel.w > 760) issues.push('modal demasiado ancho: ' + r.panel.w);
    if (r.panel && r.panel.l < 0) issues.push('modal fuera por izquierda');
    if (r.panel && r.panel.t < 8) issues.push('modal demasiado alto: panel.top=' + r.panel.t);
    if (r.panel && r.nav && r.nav.t >= 0 && r.panel.t < r.nav.b) issues.push('modal tapa navbar: panel.top=' + r.panel.t + ' nav.bottom=' + r.nav.b);
    for (const k of ['head', 'messages', 'form']) {
      if (r.chatCol && r[k] && (Math.abs(r[k].l - r.chatCol.l) > 3 || Math.abs(r[k].r - r.chatCol.r) > 3)) {
        issues.push(k + ' no ocupa 100% de la columna de chat: ' + JSON.stringify(r[k]) + ' vs ' + JSON.stringify(r.chatCol));
      }
    }
    if (r.input && r.panel && r.input.r > r.panel.r - 2) issues.push('input se sale del borde derecho');
    if (r.panelScroll && r.panelScroll.sw > r.panelScroll.cw + 1) issues.push('scroll horizontal en modal');
    if (r.chatScroll && r.chatScroll.sw > r.chatScroll.cw + 1) issues.push('scroll horizontal en chat');
    if (r.stage && r.canvas) {
      if (r.canvas.w < 10 || r.canvas.h < 10) issues.push('avatar no renderiza');
      if (r.canvas.l < r.stage.l - 2 || r.canvas.r > r.stage.r + 2) issues.push('avatar cortado horizontalmente');
      if (r.canvas.b > r.stage.b + 2 || r.canvas.t < r.stage.t - 2) issues.push('avatar cortado verticalmente');
    } else issues.push('no se encontró canvas/imagen del avatar');
    issues.push(...errors.slice(0, 5).map(e => 'consola: ' + e));
    const ok = issues.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${vp.name} ${vp.width}x${vp.height}` + (ok ? '' : '\n   - ' + issues.join('\n   - ')));
    console.log('   measure: ' + JSON.stringify({ panel: r.panel, stage: r.stage, canvas: r.canvas, nav: r.nav }));
    await ctx.close();
  }
  await browser.close();
  console.log(`\nAIRI: ${VIEWPORTS.length - failed}/${VIEWPORTS.length} OK`);
  process.exit(failed ? 1 : 0);
})();
