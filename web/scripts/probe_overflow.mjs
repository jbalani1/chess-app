import { chromium } from 'playwright';

const FILE = 'file:///Users/jeevanbalani/claude-projects/chess-app/worker/reports/2026-08-20/report.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
await page.goto(FILE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const out = await page.evaluate(() => {
  const res = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.closest('.scroll') && el !== el.closest('.scroll')) continue; // scrollable content is fine
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth + 1) {
      res.push({
        sel: `${el.tagName}.${el.className || '-'}`,
        right: Math.round(r.right),
        w: Math.round(r.width),
        sw: el.scrollWidth,
        text: (el.textContent || '').trim().slice(0, 40),
      });
    }
  }
  return res.slice(0, 20);
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
