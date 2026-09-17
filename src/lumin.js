import { useEffect, useState } from 'react'
import { withUniqueSlugs } from './lib.js'
import { categoryFor } from './categorize.js'

// Client for the Lumin SDK in headless mode.
//
// Headless means the SDK renders nothing and only provides data plus the book
// player, so its catalogue can go through our own cards, hero, search,
// categories, favourites and settings like any other library. That is the
// whole point of using it this way rather than letting it draw its own grid.
//
// Written against their documented contract. Every call is wrapped in a
// timeout because these promises do not reject when the service refuses a
// caller: `init` rejects with "domain fetch failed" but `getGames` and
// `getCategories` simply never settle, which would otherwise hang the UI
// forever with no error.
//
// It will not work from localhost. The service checks the domain it runs on,
// and that check sits upstream of the whole API, headless included.

// Both filenames in their repo are byte identical, same sha256. "fonts" is a
// decoy name, so a filter that blocks one by URL usually lets the other
// through. Try them in order.
const SOURCES = [
  'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js',
  'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/fonts.min.js',
]

const SCRIPT_TIMEOUT = 20000
const CALL_TIMEOUT = 20000
// One request per page of the catalogue. Their grid defaults to 24, but for a
// one off catalogue load a bigger page means far fewer round trips.
const PAGE_SIZE = 200
// A guard, not a target. Stops a service that keeps reporting more pages from
// looping until the tab dies.
const MAX_BOOKS = 4000

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} did not respond`)), ms),
    ),
  ])
}

let loader = null

function loadOne(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      script.remove()
      reject(new Error('timeout'))
    }, SCRIPT_TIMEOUT)

    script.addEventListener('load', () => {
      clearTimeout(timer)
      if (window.Lumin) resolve(window.Lumin)
      else reject(new Error('loaded but did not register'))
    })
    script.addEventListener('error', () => {
      clearTimeout(timer)
      script.remove()
      reject(new Error('blocked or unreachable'))
    })

    script.src = src
    script.async = true
    script.dataset.luminSdk = 'true'
    document.body.appendChild(script)
  })
}

// One shared promise for the page, so switching library back and forth does
// not append the tag again.
export function loadSdk() {
  if (loader) return loader

  loader = (async () => {
    if (window.Lumin) return window.Lumin
    const failures = []
    for (const src of SOURCES) {
      try {
        return await loadOne(src)
      } catch (e) {
        failures.push(`${src.split('/').pop()}: ${e.message}`)
      }
    }
    throw new Error(`Could not load the library. Tried ${failures.join(', ')}.`)
  })().catch((err) => {
    // Let a later attempt retry rather than caching the failure forever.
    loader = null
    throw err
  })

  return loader
}

// Maps one of their book objects onto the shape the rest of the app uses.
// `url` and `book_image_icon` stay empty on purpose: both have to be resolved
// per use, the image because it is a token rather than a url, and the book
// because its url carries a single use token.
function toEntry(book) {
  return {
    title: String(book.name ?? '').trim() || 'Untitled',
    description: '',
    book_image_icon: '',
    // Their objects carry only id, name and image_token, with no category,
    // and getCategories() comes back empty. So the category is derived from
    // the title using the same rules the json libraries are built with.
    category: book.category || categoryFor({ title: book.name, tags: book.tags }),
    tags: Array.isArray(book.tags) ? book.tags : [],
    featured: false,
    url: '',
    luminId: book.id,
    imageToken: book.image_token,
    source: 'lumin',
  }
}

export async function fetchCatalogue() {
  const sdk = await loadSdk()

  await withTimeout(sdk.init({ headless: true }), CALL_TIMEOUT, 'Connecting')

  const all = []
  let page = 1
  let pages = 1

  do {
    const res = await withTimeout(
      sdk.getGames({ page, limit: PAGE_SIZE }),
      CALL_TIMEOUT,
      'Loading books',
    )
    // `games`, not `books`. This is Lumin's response, so the property is
    // theirs to name. The books rename reached in here once and turned it
    // into `res.books`, which is always undefined, so every page came back
    // empty and the room reported the library as unreachable rather than as
    // returning nothing. Their api names stay their api names.
    const rows = Array.isArray(res?.games) ? res.games : []
    if (!rows.length) break

    all.push(...rows.filter((g) => g && g.id && g.name).map(toEntry))
    pages = Number(res.pages) || 1
    page += 1
  } while (page <= pages && all.length < MAX_BOOKS)

  if (!all.length) throw new Error('The library returned no books')
  return withUniqueSlugs(all)
}

// Image tokens resolve to blob urls. Cached per token, because a blob url is
// created per call and a card can mount more than once as the grid filters.
const imageCache = new Map()

export async function resolveImage(token) {
  if (!token) return null
  if (imageCache.has(token)) return imageCache.get(token)

  const promise = (async () => {
    const sdk = await loadSdk()
    return withTimeout(sdk.getImageUrl(token), CALL_TIMEOUT, 'Loading cover')
  })().catch(() => {
    // A cover that will not resolve falls back to the generated art, so this
    // is not worth surfacing. Drop it so a later attempt can retry.
    imageCache.delete(token)
    return null
  })

  imageCache.set(token, promise)
  return promise
}

// Must be called fresh every launch: their url carries a single use token, so
// a cached one will not play a second time.
export async function freshBookUrl(id) {
  const sdk = await loadSdk()
  const res = await withTimeout(sdk.getGameUrl(id), CALL_TIMEOUT, 'Starting book')
  if (!res?.url) throw new Error('No playable url came back')
  return res.url
}

export async function fetchCategories() {
  try {
    const sdk = await loadSdk()
    const res = await withTimeout(sdk.getCategories(), CALL_TIMEOUT, 'Loading categories')
    return Array.isArray(res?.categories) ? res.categories : []
  } catch {
    // The categories in the rail are derived from the books themselves
    // anyway, so this is a nicety rather than a requirement.
    return []
  }
}

// One shared catalogue promise for the page, the same shape as `loader`
// above.
//
// This is not just a cache. The effect below cannot own the request, because
// StrictMode invokes it, cleans it up, then invokes it again: the first run
// starts the fetch, the cleanup flips its `cancelled` flag, and the second run
// has nothing left to attach to. An earlier version guarded the second run
// with a ref, which meant the only request in flight was one whose result was
// already being discarded, so neither the books nor the error ever arrived and
// the grid sat on its skeletons forever. Sharing the promise lets the second
// run attach fresh handlers to the same request.
let catalogue = null

export function getCatalogue() {
  if (catalogue) return catalogue

  catalogue = fetchCatalogue().catch((err) => {
    // Drop it so switching away and back retries rather than replaying a
    // failure that may have been a one off.
    catalogue = null
    throw err
  })

  return catalogue
}

// Loads the catalogue once per selection of the Lumin library.
export function useLuminCatalogue(enabled) {
  const [state, setState] = useState({ books: null, error: null })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    getCatalogue()
      .then((books) => !cancelled && setState({ books, error: null }))
      .catch((e) => !cancelled && setState({ books: null, error: e.message }))

    return () => {
      cancelled = true
    }
  }, [enabled])

  return state
}
