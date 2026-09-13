import { chromium } from 'playwright';

const OUT = '/Users/jeevanbalani/claude-projects/chess-app/web/.screenshots';
const shots = [
  ['explorer-default', 'http://localhost:3000/explorer'],
  ['explorer-d4-black', 'http://localhost:3000/explorer?color=black&vs_first_move=d4'],
  ['explorer-recurring', 'http://localhost:3000/explorer?color=black&vs_first_move=d4&view=recurring'],
  ['explorer-list', 'http://localhost:3000/explorer?color=black&vs_first_move=d4&view=list'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

for (const [name, url] of shots) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(`${name}: ${overflow ? 'HORIZONTAL OVERFLOW' : 'ok'}`);
}
if (errors.length) console.log('console errors:\n  ' + errors.slice(0, 8).join('\n  '));
else console.log('no console errors');
await browser.close();
