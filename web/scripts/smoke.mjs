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
  '/explorer?color=black&vs_first_move=d4&view=list',
  '/explorer?edge=winning&view=recurring',
  // Tabs render different components; '/performance' alone only covers the first.
  '/performance?tab=time', '/performance?tab=repertoire',
]

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

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
let failures = 0

for (const route of ROUTES) {
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

console.log(failures ? `\n${failures} route(s) failing` : `\nall ${ROUTES.length} routes clean`)
process.exit(failures ? 1 : 0)
