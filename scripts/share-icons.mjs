// Lends cover art between libraries.
//
// Most sources ship no thumbnails at all, but a handful do, and the same games
// appear again and again across collections. So when a game has no icon and a
// game with the same name somewhere else has one that actually loads, borrow
// it. Everything else keeps the generated art.
//
//   node scripts/share-icons.mjs             report only
//   node scripts/share-icons.mjs --write     write the libraries
//   node scripts/share-icons.mjs --write --no-verify   skip donor checks
//
// Two rules that matter:
//
//   1. A donor must be an ORIGINAL icon, never a borrowed one, or the second
//      run would spread one image across half the wall by chaining.
//      Borrowed entries are stamped with `icon_from`, and those are skipped
//      as donors.
//   2. A donor url must actually load. 392 of the built in list's icons point
//      at the host that died, so lending those would replace working
//      generated art with a broken image.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const DIR = new URL('../public/', import.meta.url)
const FILES = [
  'games.json',
  'libraries/goblin.json',
  'libraries/hell.json',
  'libraries/nova.json',
  'libraries/amplify.json',
  'libraries/alexx.json',
  'libraries/gams.json',
  'libraries/p0xx.json',
  'libraries/astro.json',
]

const write = process.argv.includes('--write')
const verify = !process.argv.includes('--no-verify')

// Hosts known to be gone. Checked, not guessed: this subdomain is NXDOMAIN.
const DEAD_HOSTS = new Set(['mathematics-lessons.eclipsecastellon.com'])

const key = (title) =>
  String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

// Levenshtein, capped. Only ever called on two short strings.
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 9
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = prev[j]
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      last = cur
    }
  }
  return prev[b.length]
}

// A one character difference is only a near match when no digit is involved.
// Otherwise "geometrydash2" would borrow from "geometrydash3", and
// "ducklife2" from "ducklife3", which are different games.
function nearMatch(a, b) {
  if (a.length < 8 || b.length < 8) return false
  if (/\d/.test(a) || /\d/.test(b)) return false
  return distance(a, b) === 1
}

// ---------------------------------------------------------------- load

const loaded = []
for (const rel of FILES) {
  const url = new URL(rel, DIR)
  if (!existsSync(url)) continue
  loaded.push({ rel, url, games: JSON.parse(readFileSync(url, 'utf8')) })
}

// ---------------------------------------------------------------- donors

const donors = new Map() // key -> { url, from, title }
for (const lib of loaded) {
  for (const g of lib.games) {
    if (!g.game_image_icon || g.icon_from) continue
    let host
    try {
      host = new URL(g.game_image_icon).hostname
    } catch {
      continue
    }
    if (DEAD_HOSTS.has(host)) continue
    const k = key(g.title)
    if (!k || donors.has(k)) continue
    donors.set(k, { url: g.game_image_icon, from: lib.rel, title: g.title })
  }
}

console.log(`${donors.size} candidate donor icons from ${loaded.length} files`)

// ---------------------------------------------------------------- verify

async function alive(url) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 12000)
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow' })
    if (!res.ok) return false
    // A host that answers 200 with an HTML error page is not an image.
    const type = res.headers.get('content-type') || ''
    return type.startsWith('image/')
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

if (verify) {
  const entries = [...donors.entries()]
  let cursor = 0
  let dropped = 0
  const POOL = 6

  await Promise.all(
    Array.from({ length: POOL }, async () => {
      while (cursor < entries.length) {
        const [k, d] = entries[cursor++]
        if (!(await alive(d.url))) {
          donors.delete(k)
          dropped++
        }
      }
    }),
  )
  console.log(`${dropped} donors dropped as unreachable, ${donors.size} usable`)
} else {
  console.log('skipping donor verification')
}

// ---------------------------------------------------------------- lend

const donorKeys = [...donors.keys()]
let exact = 0
let near = 0
const examples = []

for (const lib of loaded) {
  for (const g of lib.games) {
    if (g.game_image_icon) continue
    const k = key(g.title)
    if (!k) continue

    let hit = donors.get(k)
    let how = 'exact'

    if (!hit) {
      const nk = donorKeys.find((d) => nearMatch(k, d))
      if (nk) {
        hit = donors.get(nk)
        how = 'near'
      }
    }
    if (!hit) continue

    g.game_image_icon = hit.url
    g.icon_from = hit.from
    if (how === 'exact') exact++
    else near++
    if (examples.length < 12) examples.push(`${g.title}  <-  ${hit.title} (${hit.from}, ${how})`)
  }
}

console.log(`\nlent ${exact} exact and ${near} near matches`)
for (const e of examples) console.log('  ' + e)

console.log('\nper library:')
const onDeadHost = (g) => {
  try {
    return DEAD_HOSTS.has(new URL(g.game_image_icon).hostname)
  } catch {
    return false
  }
}

for (const lib of loaded) {
  // Count only icons that can actually load. Counting the built in list's
  // 392 dead host icons as "own" made it look the best supplied of the lot.
  const own = lib.games.filter((g) => g.game_image_icon && !g.icon_from && !onDeadHost(g)).length
  const dead = lib.games.filter((g) => g.game_image_icon && onDeadHost(g)).length
  const borrowed = lib.games.filter((g) => g.icon_from).length
  const none = lib.games.filter((g) => !g.game_image_icon).length
  console.log(
    `  ${lib.rel.padEnd(24)} own ${String(own).padStart(3)}  borrowed ${String(borrowed).padStart(3)}` +
      `  dead ${String(dead).padStart(3)}  art only ${String(none).padStart(4)}`,
  )
}

if (write) {
  for (const lib of loaded) {
    writeFileSync(lib.url, JSON.stringify(lib.games, null, 2) + '\n')
  }
  console.log('\nwrote the libraries')
} else {
  console.log('\ndry run, pass --write to save')
}
