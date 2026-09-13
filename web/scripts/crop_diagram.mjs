import { chromium } from 'playwright';

const FILE = 'file:///Users/jeevanbalani/claude-projects/chess-app/worker/reports/2026-08-20/report.html';
const OUT = '/Users/jeevanbalani/claude-projects/chess-app/worker/reports/2026-08-20';
const targets = process.argv.slice(2);

const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    colorScheme: scheme, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  for (const id of targets) {
    const el = page.locator(`#${id}`);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await el.screenshot({ path: `${OUT}/dg-${id}-${scheme}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log('done');
