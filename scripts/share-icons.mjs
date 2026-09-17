// Lends cover art between libraries.
//
// Most sources ship no thumbnails at all, but a handful do, and the same books
// appear again and again across collections. So when a book has no icon and a
// book with the same name somewhere else has one that actually loads, borrow
// it. Everything else keeps the generated art.
//
//   node scripts/share-icons.mjs             report only
//   node scripts/share-icons.mjs --write     write the libraries
//   node scripts/share-icons.mjs --write --no-verify   skip donor checks
//   node scripts/share-icons.mjs --max-distance 2      tighter matching
//   node scripts/share-icons.mjs --min-length 10       only longer titles
//   node scripts/share-icons.mjs --reset --write       re-lend from scratch
//   node scripts/share-icons.mjs --verify-own --write   blank dead own icons
//
// --verify-own requests every entry's own icon and clears the ones that do
// not return an image. Selenite's catalogue lists a cover filename per book
// and roughly one in seven is stale, so without this those cards fire a
// request that 404s before falling back to the generated art, and a dead url
// could be lent to another library as a donor.
//
// Matching runs in three passes, loosest last:
//   1. exact, on the title reduced to [a-z0-9]
//   2. loose, with filler words like "book" and "unblocked" dropped first
//   3. fuzzy, an edit distance scaled to the length of the title
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
  // Selenite first: it has a cover for nearly every one of its 914 books, so
  // it is by far the biggest donor pool.
  'libraries/selenite.json',
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
// Clears previously borrowed icons first, so changing the matching rules
// re-lends from scratch instead of being blocked by last run's results.
const reset = process.argv.includes('--reset')
const verifyOwn = process.argv.includes('--verify-own')

// Hosts known to be gone. Checked, not guessed: this subdomain is NXDOMAIN.
const DEAD_HOSTS = new Set(['mathematics-lessons.eclipsecastellon.com'])

const MAX_DISTANCE = num('--max-distance', 3)
const MIN_LENGTH = num('--min-length', 8)

function num(flag, fallback) {
  const i = process.argv.indexOf(flag)
  if (i === -1) return fallback
  const v = Number(process.argv[i + 1])
  return Number.isFinite(v) ? v : fallback
}

const key = (title) =>
  String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

// Words that say nothing about which book this is. Dropping them lets
// "Slope Book" match "Slope" and "1v1 LOL unblocked" match "1v1lol".
const FILLER = /(game|games|gaming|online|unblocked|unblock|play|playable|free|the|a|an|official|html5|io|version|new|full)/g

const looseKey = (title) =>
  String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+/g, '')

// Levenshtein. Only ever called on two short strings.
function distance(a, b, cap = MAX_DISTANCE) {
  // A length gap bigger than the allowance can never come back under it.
  if (Math.abs(a.length - b.length) > cap) return cap + 1
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

// Sequel numbers have to agree exactly. Comparing the digits rather than
// banning them outright is what lets "cookieclicker2" match
// "cookieclicker2online" while still refusing "geometrydash2" against
// "geometrydash3", and "ducklife2" against "ducklife3".
const digitsOf = (s) => (s.match(/\d+/g) || []).join('.')

// The allowance scales with length, because three characters out of nine is a
// different book while three out of twenty is a spelling variant. Short
// titles get no fuzzy matching at all: at eight characters almost anything is
// within two edits of something else.
function allowanceFor(a, b) {
  const longest = Math.max(a.length, b.length)
  return Math.min(MAX_DISTANCE, Math.max(1, Math.floor(longest / 5)))
}

function nearMatch(a, b) {
  if (a.length < MIN_LENGTH || b.length < MIN_LENGTH) return false
  if (digitsOf(a) !== digitsOf(b)) return false
  const allowed = allowanceFor(a, b)
  return distance(a, b, allowed) <= allowed
}

// A variant that only adds words catches what edit distance cannot:
// "Subway Surfers Winter" is six edits from "Subway Surfers" but obviously
// the same book. Requiring the shorter title to be a long prefix of the
// longer one is what keeps this from turning into a free for all. Seven
// characters means "drift" is too short to lend to every drift book, while
// "subwaysurfers" and "geometrydash" are long enough to be specific.
const PREFIX_MIN = num('--prefix-min', 7)

function prefixMatch(a, b) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length < PREFIX_MIN) return false
  if (short === long) return false
  if (!long.startsWith(short)) return false
  // The suffix must not introduce a different sequel number.
  return digitsOf(a) === digitsOf(b) || !/\d/.test(long.slice(short.length))
}

// ---------------------------------------------------------------- load

const loaded = []
for (const rel of FILES) {
  const url = new URL(rel, DIR)
  if (!existsSync(url)) continue
  loaded.push({ rel, url, books: JSON.parse(readFileSync(url, 'utf8')) })
}

// ---------------------------------------------------------------- donors
//
// Built after --verify-own has had its say, so a dead cover is never offered
// to another library.

const donors = new Map() // strict key -> { url, from, title }
const loose = new Map() // loose key -> same
for (const lib of loaded) {
  for (const g of lib.books) {
    if (!g.book_image_icon || g.icon_from) continue
    let host
    try {
      host = new URL(g.book_image_icon).hostname
    } catch {
      continue
    }
    if (DEAD_HOSTS.has(host)) continue
    const k = key(g.title)
    if (!k) continue
    const donor = { url: g.book_image_icon, from: lib.rel, title: g.title }
    if (!donors.has(k)) donors.set(k, donor)
    const lk = looseKey(g.title)
    if (lk && !loose.has(lk)) loose.set(lk, donor)
  }
}

if (reset) {
  let cleared = 0
  for (const lib of loaded) {
    for (const g of lib.books) {
      if (!g.icon_from) continue
      delete g.icon_from
      g.book_image_icon = ''
      cleared++
    }
  }
  console.log(`cleared ${cleared} previously borrowed icons`)
}

if (verifyOwn) {
  const own = []
  for (const lib of loaded) {
    for (const g of lib.books) {
      if (!g.book_image_icon || g.icon_from) continue
      let host
      try {
        host = new URL(g.book_image_icon).hostname
      } catch {
        continue
      }
      if (DEAD_HOSTS.has(host)) continue
      own.push(g)
    }
  }

  let cursor = 0
  let blanked = 0
  const POOL = 8
  await Promise.all(
    Array.from({ length: POOL }, async () => {
      while (cursor < own.length) {
        const g = own[cursor++]
        if (await alive(g.book_image_icon)) continue
        g.book_image_icon = ''
        blanked++
      }
    }),
  )
  console.log(`checked ${own.length} own icons, blanked ${blanked} that did not return an image`)
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
          // Drop it from the loose index too, otherwise a donor proved dead
          // would still be lent through the second pass.
          for (const [lk, ld] of loose) if (ld.url === d.url) loose.delete(lk)
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
const counts = { exact: 0, loose: 0, prefix: 0, fuzzy: 0 }
const fuzzyLog = []
const looseLog = []
const prefixLog = []

for (const lib of loaded) {
  for (const g of lib.books) {
    if (g.book_image_icon) continue
    const k = key(g.title)
    if (!k) continue

    let hit = donors.get(k)
    let how = 'exact'

    if (!hit) {
      const lk = looseKey(g.title)
      if (lk) {
        hit = loose.get(lk)
        if (hit) how = 'loose'
      }
    }

    if (!hit) {
      // A donor whose whole title is a prefix of this one. Longest wins, so
      // "Subway Surfers Winter" prefers "Subway Surfers" over "Subway".
      let best = null
      for (const d of donorKeys) {
        if (!prefixMatch(k, d)) continue
        if (!best || d.length > best.length) best = d
      }
      if (best) {
        hit = donors.get(best)
        how = 'prefix'
      }
    }

    if (!hit) {
      // Prefer the closest donor rather than the first one that happens to
      // fall inside the allowance.
      let best = null
      let bestAt = Infinity
      for (const d of donorKeys) {
        if (!nearMatch(k, d)) continue
        const at = distance(k, d)
        if (at < bestAt) {
          bestAt = at
          best = d
        }
      }
      if (best) {
        hit = donors.get(best)
        how = 'fuzzy'
      }
    }

    if (!hit) continue

    g.book_image_icon = hit.url
    g.icon_from = hit.from
    counts[how]++
    const line = `${g.title}  <-  ${hit.title}   (${hit.from})`
    if (how === 'fuzzy') fuzzyLog.push(line)
    else if (how === 'loose') looseLog.push(line)
    else if (how === 'prefix') prefixLog.push(line)
  }
}

console.log(
  `\nlent ${counts.exact} exact, ${counts.loose} loose, ${counts.prefix} prefix, ${counts.fuzzy} fuzzy` +
    `  (max distance ${MAX_DISTANCE}, min length ${MIN_LENGTH})`,
)

// The inexact passes are the ones worth eyeballing, so print all of them
// rather than a sample.
if (looseLog.length) {
  console.log('\nloose matches, filler words ignored:')
  for (const l of looseLog) console.log('  ' + l)
}
if (prefixLog.length) {
  console.log('\nprefix matches, a longer name reusing a shorter one:')
  for (const l of prefixLog) console.log('  ' + l)
}
if (fuzzyLog.length) {
  console.log('\nfuzzy matches, check these:')
  for (const l of fuzzyLog) console.log('  ' + l)
}

console.log('\nper library:')
const onDeadHost = (g) => {
  try {
    return DEAD_HOSTS.has(new URL(g.book_image_icon).hostname)
  } catch {
    return false
  }
}

for (const lib of loaded) {
  // Count only icons that can actually load. Counting the built in list's
  // 392 dead host icons as "own" made it look the best supplied of the lot.
  const own = lib.books.filter((g) => g.book_image_icon && !g.icon_from && !onDeadHost(g)).length
  const dead = lib.books.filter((g) => g.book_image_icon && onDeadHost(g)).length
  const borrowed = lib.books.filter((g) => g.icon_from).length
  const none = lib.books.filter((g) => !g.book_image_icon).length
  console.log(
    `  ${lib.rel.padEnd(24)} own ${String(own).padStart(3)}  borrowed ${String(borrowed).padStart(3)}` +
      `  dead ${String(dead).padStart(3)}  art only ${String(none).padStart(4)}`,
  )
}

if (write) {
  for (const lib of loaded) {
    writeFileSync(lib.url, JSON.stringify(lib.books, null, 2) + '\n')
  }
  console.log('\nwrote the libraries')
} else {
  console.log('\ndry run, pass --write to save')
}
