/**
 * GALAX PC REPAIR — Auditoría automatizada de distribución responsive.
 * Requiere: npm install --no-save playwright@1.65.1
 * Uso: node tests/responsive.spec.js
 */
const { chromium } = require('playwright');

const BASE = process.env.GALAX_TEST_URL || 'http://127.0.0.1:8099/docs/galax_preview.html';

const VIEWPORTS = [
  { name: 'Mobile S',        width: 320,  height: 568 },
  { name: 'Mobile M',        width: 375,  height: 812 },
  { name: 'Mobile L',        width: 430,  height: 932 },
  { name: 'Mobile Landscape',width: 844,  height: 390 },
  { name: 'Tablet Portrait', width: 768,  height: 1024 },
  { name: 'Tablet/Laptop',   width: 1024, height: 768 },
  { name: 'Desktop',         width: 1440, height: 900 },
  { name: 'Ultrawide',       width: 1920, height: 1080 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  let failed = 0;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text()); });

    const issues = [];
    try {
      await page.goto(BASE, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
      });
      await page.waitForTimeout(200);

      const result = await page.evaluate((isMobile) => {
        const out = { outside: [], tiny: [], brokenImages: [], overlaps: [], chatOpen: false, overflowX: 0, counts: {} };
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        out.overflowX = Math.max(0, document.documentElement.scrollWidth - vw);

        const all = [...document.querySelectorAll('body *')];
        const visible = el => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        out.counts.elements = all.length;

        const intentionallyHidden = el =>
          el.closest('.drawer:not(.open)') || el.closest('.chat-panel:not(.open)') ||
          el.classList.contains('skip-link');

        for (const el of all) {
          if (!visible(el) || intentionallyHidden(el)) continue;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (cs.position !== 'fixed' && (r.right > vw + 2 || r.left < -2)) {
            out.outside.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), left: Math.round(r.left), right: Math.round(r.right) });
          }
        }

        if (isMobile) {
          for (const el of document.querySelectorAll('a,button,input,select,textarea')) {
            if (!visible(el) || intentionallyHidden(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 44 || r.height < 44) {
              out.tiny.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 50), parent: (el.parentElement?.className || '').toString().slice(0, 40), text: (el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
            }
          }
        }

        for (const img of document.querySelectorAll('img')) {
          if (!visible(img)) continue;
          if (img.complete && img.naturalWidth === 0) out.brokenImages.push((img.src || '').slice(-70));
        }

        const keys = ['.site-header', '.hero', '.promo-banner', '.section', '.site-footer'];
        const boxes = keys.map(k => {
          const el = document.querySelector(k);
          return el && visible(el) ? { k, r: el.getBoundingClientRect() } : null;
        }).filter(Boolean);
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i].r, b = boxes[j].r;
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 10 && h > 10) out.overlaps.push(boxes[i].k + ' ∩ ' + boxes[j].k);
          }
        }

        const panel = document.getElementById('chatPanel');
        out.chatOpen = panel ? panel.classList.contains('open') : false;
        return out;
      }, vp.width < 768);

      issues.push(...result.outside.slice(0, 8).map(o => 'fuera de pantalla: ' + JSON.stringify(o)));
      issues.push(...result.tiny.slice(0, 8).map(o => 'target táctil: ' + JSON.stringify(o)));
      issues.push(...result.brokenImages.map(s => 'imagen rota: ' + s));
      issues.push(...result.overlaps.map(o => 'superposición: ' + o));
      if (result.overflowX > 1) issues.push('overflow-x: ' + result.overflowX + 'px');
      if (result.chatOpen) issues.push('chat abierto al cargar');

      // Panel del chat: tamaño y contención
      const chatBtn = page.locator('#chatLauncher, button:has-text("Iniciar Chat")').first();
      if (await chatBtn.count()) {
        await chatBtn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(250);
        const chat = await page.evaluate(() => {
          const p = document.getElementById('chatPanel');
          if (!p) return null;
          const r = p.getBoundingClientRect();
          return { open: p.classList.contains('open'), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight };
        });
        if (chat && chat.open) {
          if (chat.left < -2 || chat.right > chat.vw + 2 || chat.top < -2 || chat.bottom > chat.vh + 2) {
            issues.push('chat fuera del viewport: ' + JSON.stringify(chat));
          }
          const maxChat = Math.min(720, chat.vw - 20);
          if (chat.w > maxChat + 2) issues.push('chat demasiado ancho: ' + chat.w + ' > ' + maxChat);
        }
      }

      issues.push(...consoleErrors.slice(0, 8).map(e => 'consola: ' + e));
    } catch (e) {
      issues.push('error de ejecución: ' + e.message);
    }

    const ok = issues.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${vp.name} ${vp.width}x${vp.height}` + (ok ? '' : '\n   - ' + issues.join('\n   - ')));
    await context.close();
  }

  await browser.close();
  console.log(`\nRESUMEN: ${VIEWPORTS.length - failed}/${VIEWPORTS.length} viewports OK`);
  process.exit(failed ? 1 : 0);
})();
