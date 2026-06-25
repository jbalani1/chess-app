// Visual review harness.
//
// Captures every page of the app, as it renders with real data, at desktop and
// mobile widths. Dynamic routes (game id, opening slug, opening eco) are resolved
// by querying the live APIs so screenshots show true data, not placeholders.
//
// Usage:
//   make dev                     # start the dev server first (port 3000)
//   cd web && node scripts/screenshot.mjs
//   cd web && node scripts/screenshot.mjs --only mistakes,insights   # subset
//
// Output: web/.screenshots/latest/<route>.<viewport>.png  (git-ignored)
// Then: open / Read the PNGs and critique them against docs/PERSONA.md.

import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '.screenshots', 'latest');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

// Static routes always captured.
const STATIC_ROUTES = [
  '/',
  '/mistakes',
  '/mistakes/all',
  '/mistakes/piece',
  '/mistakes/opening',
  '/mistakes/recurring',
  '/insights',
  '/tactics',
  '/drill',
  '/openings',
  '/performance',
  '/positions',
];

// Best-effort: fetch a real id/slug so dynamic routes render real data.
async function resolveDynamicRoutes() {
  const routes = [];
  const tryJson = async (path) => {
    try {
      const res = await fetch(`${BASE}${path}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const games = await tryJson('/api/games?limit=1');
  const gameId = games?.games?.[0]?.id ?? games?.[0]?.id;
  if (gameId) routes.push(`/games/${gameId}`);

  const openings = await tryJson('/api/openings');
  const list = openings?.openings ?? openings;
  const slug = Array.isArray(list) ? (list[0]?.slug ?? list[0]?.eco) : null;
  if (slug) routes.push(`/openings/${slug}`);
  const eco = Array.isArray(list) ? list[0]?.eco : null;
  if (eco) routes.push(`/mistakes/opening/${eco}`);

  return routes;
}

function slugForFile(route) {
  return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '_');
}

async function main() {
  const onlyArg = process.argv.indexOf('--only');
  const only =
    onlyArg !== -1 ? process.argv[onlyArg + 1].split(',').map((s) => s.trim()) : null;

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const dynamic = await resolveDynamicRoutes();
  let routes = [...STATIC_ROUTES, ...dynamic];
  if (only) routes = routes.filter((r) => only.some((o) => r.includes(o)));

  console.log(`Capturing ${routes.length} routes at ${VIEWPORTS.length} widths → ${OUT}`);
  if (dynamic.length) console.log(`Resolved dynamic routes: ${dynamic.join(', ')}`);

  const browser = await chromium.launch();
  let ok = 0;
  let failed = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    for (const route of routes) {
      const file = join(OUT, `${slugForFile(route)}.${vp.name}.png`);
      try {
        // domcontentloaded first (some pages keep a connection open and never
        // reach networkidle), then best-effort wait for the network to settle.
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        // Let charts/boards finish their entrance animations.
        await page.waitForTimeout(1500);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`  ✓ ${route} [${vp.name}]`);
        ok++;
      } catch (err) {
        console.log(`  ✗ ${route} [${vp.name}] — ${err.message}`);
        failed++;
      }
    }
    await ctx.close();
  }

  await browser.close();
  console.log(`\nDone: ${ok} captured, ${failed} failed. Open ${OUT} to review.`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Harness failed:', err);
  console.error('Is the dev server running? Try: make dev');
  process.exit(1);
});
