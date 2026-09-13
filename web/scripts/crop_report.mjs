import { chromium } from 'playwright';

const FILE = 'file:///Users/jeevanbalani/claude-projects/chess-app/worker/reports/2026-08-20/report.html';
const OUT = '/Users/jeevanbalani/claude-projects/chess-app/worker/reports/2026-08-20';
const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    colorScheme: scheme, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/crop-${scheme}-top.png` });
  await page.locator('figure').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/crop-${scheme}-mid.png` });
  await ctx.close();
}
await browser.close();
console.log('done');
