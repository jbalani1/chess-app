// Page smoke test: start the app, visit every route, and fail on any page
// error or failing API call.
//
// Type-checking cannot catch a route that returns 500 because it builds a
// 33 KB URL, or a page that throws because an emoji was used as a component.
// Both of those shipped and went unnoticed; this is the check that finds them.
//
// Usage: node scripts/smoke.mjs            (starts its own dev server)
//        BASE_URL=http://localhost:3000 node scripts/smoke.mjs   (reuse one)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const ROUTES = [
  '/', '/mistakes', '/explorer', '/insights', '/openings',
  '/performance', '/tactics', '/drill', '/positions',
  '/mistakes/all', '/mistakes/opening', '/mistakes/piece', '/mistakes/recurring',
  '/explorer?color=black&vs_first_move=d4&view=list',
  '/explorer?edge=winning&view=recurring',
]

// The dynamic routes need a real id, so they are discovered at run time rather
// than hard-coded. They were the blind spot: nine static pages were covered and
// none of the [eco]/[id]/[slug] ones, which is how /api/openings/[eco] kept an
// unpaginated .in('game_id', …) long after the same bug was fixed elsewhere.
// `pick` sorts by `by` so the busiest opening — the one most likely to hit a row
// cap — is the one tested.
async function discoverRoutes(base) {
  const routes = []
  const json = async (path) => {
    const r = await fetch(base + path)
    if (!r.ok) throw new Error(`${path} returned ${r.status}`)
    return r.json()
  }
  const pick = (rows, by) =>
    Array.isArray(rows) && rows.length
      ? [...rows].sort((a, b) => (b[by] ?? 0) - (a[by] ?? 0))[0]
      : null

  try {
    const opening = pick(await json('/api/openings'), 'games_played')
    if (opening?.eco) {
      routes.push(`/openings/${opening.eco}`, `/mistakes/opening/${opening.eco}`)
    }
  } catch (e) {
    console.log(`     (could not discover an opening: ${e.message})`)
  }

  try {
    const games = await json('/api/games')
    const game = (Array.isArray(games) ? games : games?.games)?.[0]
    if (game?.id) routes.push(`/games/${game.id}`)
  } catch (e) {
    console.log(`     (could not discover a game: ${e.message})`)
  }

  return routes
}

const PORT = process.env.SMOKE_PORT ?? '3411'
const reuse = !!process.env.BASE_URL
const base = process.env.BASE_URL ?? `http://localhost:${PORT}`

let server
if (!reuse) {
  server = spawn('npm', ['run', 'dev', '--', '--port', PORT], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })
  const ready = await Promise.race([
    new Promise((res) => {
      const onData = (d) => {
        if (/Ready in|started server/i.test(String(d))) res(true)
      }
      server.stdout.on('data', onData)
      server.stderr.on('data', onData)
    }),
    sleep(90_000).then(() => false),
  ])
  if (!ready) {
    server.kill('SIGKILL')
    console.error('smoke: dev server never became ready')
    process.exit(1)
  }
  await sleep(1500)
}

const routes = [...ROUTES, ...(await discoverRoutes(base))]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
let failures = 0

for (const route of routes) {
  const page = await ctx.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 100)}`))
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400) {
      problems.push(`API ${r.status()} ${r.url().split('/api/')[1]?.slice(0, 60)}`)
    }
  })

  try {
    await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(4000)
  } catch (e) {
    problems.push(`navigation: ${String(e).slice(0, 80)}`)
  }

  if (problems.length) {
    failures++
    console.log(`FAIL ${route}`)
    for (const p of problems.slice(0, 4)) console.log(`       ${p}`)
  } else {
    console.log(`ok   ${route}`)
  }
  await page.close()
}

await browser.close()
if (server) server.kill('SIGKILL')

console.log(failures ? `\n${failures} route(s) failing` : `\nall ${routes.length} routes clean`)
process.exit(failures ? 1 : 0)
