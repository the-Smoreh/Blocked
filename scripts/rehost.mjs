// Repoints game URLs from one host to another, in bulk.
//
// Why this exists: 440 of the games in this library share a single host,
// `mathematics-lessons.eclipsecastellon.com`. That subdomain is NXDOMAIN as of
// 2026-09-15, which is why those games open as a blank frame. The parent
// domain eclipsecastellon.com still resolves, only the subdomain is gone.
//
// So the entire library is one hostname away from working. Find a host that
// serves the same game paths and swap it in:
//
//   node scripts/rehost.mjs --list
//       show every host in games.json with a count
//
//   node scripts/rehost.mjs --probe
//       check which hosts still resolve and respond
//
//   node scripts/rehost.mjs --from old.example.com --to new.example.com
//       dry run, prints what would change
//
//   node scripts/rehost.mjs --from old --to new --write
//       apply it
//
// The path and query are preserved, only the hostname changes. Verify a few
// games in the player afterwards, since a host that answers 200 on the root
// does not prove it serves the same game paths.

import { readFileSync, writeFileSync } from 'node:fs'
import { promises as dns } from 'node:dns'

const FILE = new URL('../public/games.json', import.meta.url)
const games = JSON.parse(readFileSync(FILE, 'utf8'))

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : process.argv[i + 1]
}
const has = (name) => process.argv.includes(`--${name}`)

function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

const hosts = new Map()
// Keep one real URL per host. Probing `https://host/` is misleading: a
// project page like user.github.io/game/ answers 404 at the domain root even
// though the game itself is fine.
const sampleUrl = new Map()
for (const g of games) {
  const h = hostOf(g.url)
  if (!h) continue
  hosts.set(h, (hosts.get(h) || 0) + 1)
  if (!sampleUrl.has(h)) sampleUrl.set(h, g.url)
}
const ranked = [...hosts].sort((a, b) => b[1] - a[1])

if (has('list') || process.argv.length <= 2) {
  console.log(`${games.length} games across ${hosts.size} hosts\n`)
  for (const [h, n] of ranked) console.log(`  ${String(n).padStart(4)}  ${h}`)
  if (process.argv.length <= 2) console.log('\nsee the comment at the top of this file for usage')
  process.exit(0)
}

if (has('probe')) {
  console.log('resolving and requesting each host\n')
  for (const [h, n] of ranked) {
    let line = `  ${String(n).padStart(4)}  ${h.padEnd(44)} `
    try {
      await dns.resolve4(h)
    } catch (e) {
      console.log(line + `DNS ${e.code}`)
      continue
    }
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 10000)
      const res = await fetch(sampleUrl.get(h), { signal: ctl.signal }).finally(() =>
        clearTimeout(t),
      )
      console.log(line + `HTTP ${res.status}`)
    } catch (e) {
      console.log(line + `REQ ${e.cause?.code || e.name}`)
    }
  }
  process.exit(0)
}

const from = arg('from')
const to = arg('to')

if (!from || !to) {
  console.error('need both --from <host> and --to <host>. Use --list to see hosts.')
  process.exit(1)
}

let changed = 0
const examples = []
for (const g of games) {
  if (hostOf(g.url) !== from) continue
  const u = new URL(g.url)
  u.hostname = to
  if (examples.length < 5) examples.push([g.title, g.url, u.toString()])
  g.url = u.toString()
  changed++
}

console.log(`${changed} of ${games.length} games would move from ${from} to ${to}\n`)
for (const [title, before, after] of examples) {
  console.log(`  ${title}\n    - ${before}\n    + ${after}`)
}
if (changed > examples.length) console.log(`\n  ...and ${changed - examples.length} more`)

if (has('write')) {
  writeFileSync(FILE, JSON.stringify(games, null, 2) + '\n')
  console.log(`\nwrote public/games.json. Now spot check a few games in the player.`)
} else {
  console.log('\ndry run, pass --write to apply')
}
