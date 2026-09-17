// Lends cover art between libraries at runtime.
//
// `scripts/share-icons.mjs` already does this at build time and writes the
// result into the json files, but it cannot touch Lumin: Lumin has no data
// file, its catalogue only exists once its SDK has answered, and its covers
// are tokens rather than urls. So Lumin could neither lend nor borrow, even
// though it is the single biggest pool of real cover art we have access to,
// 1169 books with a cover each.
//
// This closes that gap in both directions. Every catalogue loaded in a
// session registers its covers as donors, so whichever library is on screen
// can fill its gaps from the others.
//
// The matching rules are deliberately the same as the build script's, minus
// its fuzzy pass. Edit distance at build time is fine because a person reads
// the printed list afterwards; doing it here would be guessing at a book's
// identity with nobody checking, so runtime sticks to the three passes that
// are either exact or close to it.

import { getCatalogue, resolveImage } from './lumin.js'

// ------------------------------------------------------------------ keys

const exactKey = (title) =>
  String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

// Words that say nothing about which book this is. Dropping them lets
// "Slope Book" match "Slope" and "1v1 LOL unblocked" match "1v1lol".
const FILLER =
  /(game|games|gaming|online|unblocked|unblock|play|playable|free|the|a|an|official|html5|io|version|new|full)/g

const looseKey = (title) =>
  String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+/g, '')

// Sequel numbers have to agree exactly, so "ducklife2" never borrows from
// "ducklife3". Comparing the digits rather than banning them is what still
// lets "cookieclicker2" match a longer variant of itself.
const digitsOf = (s) => (s.match(/\d+/g) || []).join('.')

// Seven characters, the same floor the build script uses: "drift" is short
// enough to be a prefix of every drift book, "geometrydash" is not.
const PREFIX_MIN = 7

function prefixOk(short, long) {
  if (short.length < PREFIX_MIN) return false
  if (short === long) return false
  if (!long.startsWith(short)) return false
  // The extra words must not introduce a different sequel number.
  return digitsOf(short) === digitsOf(long) || !/\d/.test(long.slice(short.length))
}

// ------------------------------------------------------------------ index

// key -> donor. A donor is { url } for a normal library or { token } for
// Lumin, whose covers have to be resolved through its SDK before they can be
// used as an img src.
const exact = new Map()
const loose = new Map()
// Every exact key, kept sorted, so the prefix pass can look at the handful of
// neighbours around an insertion point instead of scanning every donor for
// every card.
let sorted = []
let sortedStale = false

const registered = new Set()

// Only original art may be lent. An entry that borrowed its own cover is
// excluded, exactly as in the build script: without that, one image chains
// across the whole wall and a dead url can be passed on.
function donorFor(book) {
  if (book.icon_from) return null
  if (book.book_image_icon) return { url: book.book_image_icon }
  if (book.imageToken) return { token: book.imageToken }
  return null
}

export function registerDonors(id, books) {
  if (!id || registered.has(id) || !Array.isArray(books)) return
  registered.add(id)

  for (const book of books) {
    const donor = donorFor(book)
    if (!donor) continue

    const k = exactKey(book.title)
    if (k && !exact.has(k)) {
      exact.set(k, donor)
      sortedStale = true
    }

    const l = looseKey(book.title)
    if (l && !loose.has(l)) loose.set(l, donor)
  }
}

export function hasDonors() {
  return exact.size > 0
}

export function donorCount() {
  return exact.size
}

function neighbours(key) {
  if (sortedStale) {
    sorted = [...exact.keys()].sort()
    sortedStale = false
  }
  // Binary search for where this key would sit. A prefix relationship puts
  // two keys next to each other in sort order, so the candidates are the few
  // entries either side.
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < key) lo = mid + 1
    else hi = mid
  }
  return sorted.slice(Math.max(0, lo - 4), lo + 5)
}

// Returns a donor, or null. Three passes, most exact first.
export function findDonor(title) {
  const k = exactKey(title)
  if (!k) return null

  const hit = exact.get(k)
  if (hit) return hit

  const l = looseKey(title)
  if (l) {
    const near = loose.get(l)
    if (near) return near
  }

  for (const cand of neighbours(k)) {
    if (prefixOk(cand, k) || prefixOk(k, cand)) {
      const d = exact.get(cand)
      if (d) return d
    }
  }

  return null
}

// A borrowed cover as something an img can use. A token donor goes through
// Lumin's SDK, which is why this is async.
export async function borrowCover(title) {
  const donor = findDonor(title)
  if (!donor) return null
  if (donor.url) return donor.url
  if (donor.token) return resolveImage(donor.token)
  return null
}

// ------------------------------------------------- filling the donor pool

// Selenite is our own static file and the richest json donor, 809 covers, so
// it can be pulled in whenever something needs art without involving anyone
// else's service.
const SELENITE = 'libraries/selenite.json'

let seleniteLoad = null

export function loadSeleniteDonors() {
  if (registered.has('selenite')) return Promise.resolve()
  if (seleniteLoad) return seleniteLoad

  seleniteLoad = fetch(import.meta.env.BASE_URL + SELENITE, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((books) => books && registerDonors('selenite', books))
    .catch(() => {
      // A missing donor pool is not worth surfacing. The cards fall back to
      // their generated art, which is what they were showing anyway.
      seleniteLoad = null
    })

  return seleniteLoad
}

let luminLoad = null

// Lumin's catalogue is the only donor pool that costs something to fetch: it
// means loading a third party's script on a page that was not otherwise going
// to. So this is never called on its own, only when the borrow setting is on
// and the library on screen actually has gaps. `getCatalogue` is shared, so
// if Lumin is the selected library this reuses the request already in
// flight rather than making a second one.
export function loadLuminDonors() {
  if (registered.has('lumin')) return Promise.resolve()
  if (luminLoad) return luminLoad

  luminLoad = getCatalogue()
    .then((books) => registerDonors('lumin', books))
    .catch(() => {
      luminLoad = null
    })

  return luminLoad
}
