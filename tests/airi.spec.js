/** Verificación del botón Asistente IA en 3 viewports. node tests/airi.spec.js */
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
    await page.click('#assistantBtn');
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const p = document.getElementById('chatPanel');
      const b = p.getBoundingClientRect();
      return {
        open: p.classList.contains('open'),
        left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom),
        vw: innerWidth, vh: innerHeight,
        mojibake: (document.body.innerText.match(/[\u00c2\u00c3]/g) || []).length,
      };
    });
    if (!r.open) issues.push('panel no abre');
    if (r.left < -2 || r.right > r.vw + 2 || r.top < -2 || r.bottom > r.vh + 2) issues.push('panel fuera del viewport: ' + JSON.stringify(r));
    if (r.mojibake > 0) issues.push('mojibake: ' + r.mojibake);
    issues.push(...errors.slice(0, 5).map(e => 'consola: ' + e));
    const ok = issues.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${vp.name} ${vp.width}x${vp.height}` + (ok ? '' : '\n   - ' + issues.join('\n   - ')));
    await ctx.close();
  }
  await browser.close();
  console.log(`\nASISTENTE: ${VIEWPORTS.length - failed}/${VIEWPORTS.length} OK`);
  process.exit(failed ? 1 : 0);
})();
