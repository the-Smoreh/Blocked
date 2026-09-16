// Checks whether the game URLs in public/games.json are still alive, and
// whether they allow being embedded in an iframe.
//
// This exists because hotlinked games rot constantly and a dead link looks
// identical to a slow one in the player: a blank frame, no error event.
//
//   node scripts/checklinks.mjs                        sample 40 urls
//   node scripts/checklinks.mjs --all                  check every url
//   node scripts/checklinks.mjs --file libraries/goblin.json --all
//   node scripts/checklinks.mjs --all --json out.json  also write a report
//
// --file takes a path under public/, so any of the per source libraries can
// be checked the same way as the built in list.
//
// Two things make a game unplayable in the frame, and they are separate:
//   dead      the host is gone, or returns 4xx/5xx
//   noframe   it loads, but sets X-Frame-Options or a frame-ancestors CSP

import { readFileSync, writeFileSync } from 'node:fs'

const fileAt = process.argv.indexOf('--file')
const REL = fileAt === -1 ? 'games.json' : process.argv[fileAt + 1]
const FILE = new URL(`../public/${REL}`, import.meta.url)
const games = JSON.parse(readFileSync(FILE, 'utf8'))

const all = process.argv.includes('--all')
const jsonAt = process.argv.indexOf('--json')
const SAMPLE = 40
// Low enough that GitHub Pages does not start refusing the burst.
const CONCURRENCY = 4
const RETRIES = 3
const TIMEOUT = 12000

const targets = all
  ? games
  : games.filter((_, i) => i % Math.ceil(games.length / SAMPLE) === 0).slice(0, SAMPLE)

function blockedBy(headers) {
  const xfo = headers.get('x-frame-options')
  if (xfo && /deny|sameorigin/i.test(xfo)) return `X-Frame-Options: ${xfo}`
  const csp = headers.get('content-security-policy')
  if (csp) {
    const m = csp.match(/frame-ancestors[^;]*/i)
    // frame-ancestors listing only self or specific hosts blocks us. A bare
    // * would not, so only report when it is actually restrictive.
    if (m && !/\*\s*$/.test(m[0])) return m[0].trim()
  }
  return null
}

// Only these mean the game is really gone. A 429 or a 5xx or a timeout means
// we hammered the host or the network wobbled, and treating those as dead
// once deleted 31 working games from p0xx: GitHub Pages rate limited a burst
// of concurrent requests and every one of them looked like a 404.
function isGone(status) {
  return status === 404 || status === 410
}

async function attempt(url) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT)
  try {
    // GET, not HEAD. Plenty of static hosts answer HEAD with 405.
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; blocked-linkcheck)' },
    })
    return { status: res.status, headers: res.headers, finalUrl: res.url }
  } catch (e) {
    return { status: 0, error: e.name === 'AbortError' ? `timeout after ${TIMEOUT}ms` : e.cause?.code || e.message }
  } finally {
    clearTimeout(timer)
  }
}

async function check(game) {
  let r
  // Retry anything that is not a definite answer, with a growing pause.
  for (let i = 0; i < RETRIES; i++) {
    r = await attempt(game.url)
    const settled = isGone(r.status) || (r.status >= 200 && r.status < 400)
    if (settled) break
    if (i < RETRIES - 1) await new Promise((res) => setTimeout(res, 700 * (i + 1)))
  }

  const base = { title: game.title, url: game.url, status: r.status }

  if (r.status === 0) {
    return { ...base, verdict: r.error?.startsWith('ENOTFOUND') ? 'dead' : 'unknown', reason: r.error }
  }
  if (isGone(r.status)) return { ...base, verdict: 'dead', reason: `HTTP ${r.status}` }
  if (r.status >= 400) {
    // Throttled or broken upstream. Not proof the game is gone.
    return { ...base, verdict: 'unknown', reason: `HTTP ${r.status}, retried ${RETRIES}x` }
  }

  const noframe = blockedBy(r.headers)
  return {
    ...base,
    finalUrl: r.finalUrl !== game.url ? r.finalUrl : undefined,
    verdict: noframe ? 'noframe' : 'ok',
    reason: noframe || undefined,
  }
}

// Fixed size worker pool, so a 450 url run does not open 450 sockets at once.
const results = []
let cursor = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < targets.length) {
      const game = targets[cursor++]
      results.push(await check(game))
    }
  }),
)

const by = (v) => results.filter((r) => r.verdict === v)
const ok = by('ok')
const noframe = by('noframe')
const dead = by('dead')
const unknown = by('unknown')
const pct = (n) => `${Math.round((n / results.length) * 100)}%`

console.log(`checked ${results.length} of ${games.length} game urls\n`)
console.log(`  ok       ${String(ok.length).padStart(4)}  ${pct(ok.length)}`)
console.log(`  noframe  ${String(noframe.length).padStart(4)}  ${pct(noframe.length)}`)
console.log(`  dead     ${String(dead.length).padStart(4)}  ${pct(dead.length)}`)
console.log(`  unknown  ${String(unknown.length).padStart(4)}  ${pct(unknown.length)}  (kept, not proof of anything)`)

for (const [label, list] of [
  ['REFUSES TO EMBED', noframe],
  ['DEAD', dead],
  ['UNKNOWN', unknown],
]) {
  if (!list.length) continue
  console.log(`\n${label}`)
  for (const r of list.slice(0, 25)) {
    console.log(`  ${r.title}\n    ${r.reason}`)
  }
  if (list.length > 25) console.log(`  ...and ${list.length - 25} more`)
}

if (jsonAt !== -1 && process.argv[jsonAt + 1]) {
  writeFileSync(process.argv[jsonAt + 1], JSON.stringify(results, null, 2) + '\n')
  console.log(`\nwrote ${process.argv[jsonAt + 1]}`)
}

// Pruning only makes sense after checking everything. On a sample it would
// delete entries that were never tested.
//   node scripts/checklinks.mjs --file libraries/hell.json --all --prune
if (process.argv.includes('--prune')) {
  if (!all) {
    console.log('\n--prune needs --all, otherwise untested entries get dropped')
  } else if (!dead.length) {
    console.log('\nnothing to prune')
  } else {
    const drop = new Set(dead.map((d) => d.url))
    const kept = games.filter((g) => !drop.has(g.url))
    writeFileSync(FILE, JSON.stringify(kept, null, 2) + '\n')

    // Record the removal so it survives a rebuild. build-libraries.mjs reads
    // this and skips these urls, otherwise every rebuild reinstates games we
    // already proved were 404 and the verification has to be redone.
    const LIST = new URL('../public/libraries/pruned.json', import.meta.url)
    let prunedList = {}
    try {
      prunedList = JSON.parse(readFileSync(LIST, 'utf8'))
    } catch {
      // First prune, nothing to merge.
    }
    const today = new Date().toISOString().slice(0, 10)
    for (const d of dead) prunedList[d.url] = { reason: d.reason, checked: today }
    writeFileSync(LIST, JSON.stringify(prunedList, null, 2) + '\n')

    console.log(`\npruned ${games.length - kept.length}, ${kept.length} left in ${REL}`)
    console.log(
      `recorded in public/libraries/pruned.json, now ${Object.keys(prunedList).length} urls`,
    )
  }
}
