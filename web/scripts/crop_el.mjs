import { chromium } from 'playwright';

const FILE = 'file:///Users/jeevanbalani/claude-projects/chess-app/worker/reports/2026-08-20/report.html';
const OUT = '/Users/jeevanbalani/claude-projects/chess-app/worker/reports/2026-08-20';
const sel = process.argv[2];
const name = process.argv[3] ?? 'el';

const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    colorScheme: scheme, viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await el.screenshot({ path: `${OUT}/el-${name}-${scheme}.png` });
  await ctx.close();
}
await browser.close();
console.log('done');
