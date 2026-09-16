// Checks whether the game URLs in public/games.json are still alive, and
// whether they allow being embedded in an iframe.
//
// This exists because hotlinked games rot constantly and a dead link looks
// identical to a slow one in the player: a blank frame, no error event.
//
//   node scripts/checklinks.mjs                 sample 40 urls
//   node scripts/checklinks.mjs --all           check every url
//   node scripts/checklinks.mjs --all --json out.json   also write a report
//
// Two things make a game unplayable in the frame, and they are separate:
//   dead      the host is gone, or returns 4xx/5xx
//   noframe   it loads, but sets X-Frame-Options or a frame-ancestors CSP

import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../public/games.json', import.meta.url)
const games = JSON.parse(readFileSync(FILE, 'utf8'))

const all = process.argv.includes('--all')
const jsonAt = process.argv.indexOf('--json')
const SAMPLE = 40
const CONCURRENCY = 10
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

async function check(game) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT)
  try {
    // GET, not HEAD. Plenty of static hosts answer HEAD with 405.
    const res = await fetch(game.url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; blocked-linkcheck)' },
    })
    const noframe = blockedBy(res.headers)
    return {
      title: game.title,
      url: game.url,
      status: res.status,
      finalUrl: res.url !== game.url ? res.url : undefined,
      verdict: !res.ok ? 'dead' : noframe ? 'noframe' : 'ok',
      reason: !res.ok ? `HTTP ${res.status}` : noframe || undefined,
    }
  } catch (e) {
    return {
      title: game.title,
      url: game.url,
      status: 0,
      verdict: 'dead',
      reason: e.name === 'AbortError' ? `timeout after ${TIMEOUT}ms` : e.cause?.code || e.message,
    }
  } finally {
    clearTimeout(timer)
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
const pct = (n) => `${Math.round((n / results.length) * 100)}%`

console.log(`checked ${results.length} of ${games.length} game urls\n`)
console.log(`  ok       ${String(ok.length).padStart(4)}  ${pct(ok.length)}`)
console.log(`  noframe  ${String(noframe.length).padStart(4)}  ${pct(noframe.length)}`)
console.log(`  dead     ${String(dead.length).padStart(4)}  ${pct(dead.length)}`)

for (const [label, list] of [
  ['REFUSES TO EMBED', noframe],
  ['DEAD', dead],
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
