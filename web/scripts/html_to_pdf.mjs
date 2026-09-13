// Print a local HTML file to PDF via Chromium (Playwright).
// Usage: node scripts/html_to_pdf.mjs <input.html> <output.pdf>
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [, , inArg, outArg] = process.argv;
if (!inArg || !outArg) {
  console.error('usage: node html_to_pdf.mjs <input.html> <output.pdf>');
  process.exit(1);
}
const input = pathToFileURL(resolve(inArg)).href;
const output = resolve(outArg);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(input, { waitUntil: 'networkidle' });
await page.pdf({
  path: output,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
});
await browser.close();
console.log('wrote', output);
