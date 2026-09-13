// One-off: render the chess report HTML and capture it in both themes.
import { chromium } from 'playwright';

const FILE = 'file:///Users/jeevanbalani/claude-projects/chess-app/worker/reports/2026-08-20/report.html';
const OUT = '/Users/jeevanbalani/claude-projects/chess-app/worker/reports/2026-08-20';

const browser = await chromium.launch();
for (const [scheme, w] of [['light', 1280], ['dark', 1280], ['light', 390]]) {
  const ctx = await browser.newContext({
    colorScheme: scheme,
    viewport: { width: w, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // flag any element whose box escapes the viewport horizontally
  const overflow = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
        bad.push(`${el.tagName}.${el.className || '-'} right=${Math.round(r.right)}`);
      }
    }
    return { bad: bad.slice(0, 12), scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth };
  });
  console.log(`[${scheme} ${w}px] scrollW=${overflow.scrollW} innerW=${overflow.innerW}`);
  if (overflow.bad.length) console.log('  overflowing:', overflow.bad);

  await page.screenshot({ path: `${OUT}/shot-${scheme}-${w}.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
console.log('done');
