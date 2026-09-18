// Total time on each book, across every visit, in this browser.
//
// The player bar shows it next to the time for this visit. Kept in
// localStorage rather than on the server: the account is tied to this browser
// anyway, so a server copy would last exactly as long, and this works without
// an account, offline, and with no request at all.
//
// One object of slug to seconds. A slug comes from the title, so the same
// book in two libraries shares one total, which is what "this book" means to
// whoever is playing it.

const KEY = 'blocked:booktime'

function readAll() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}')
    return all && typeof all === 'object' ? all : {}
  } catch {
    return {}
  }
}

export function totalFor(slug) {
  const seconds = Number(readAll()[slug])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
}

// Adds to the stored total and returns the new one, or null if it could not
// be saved. Reads fresh every time rather than trusting a copy, so two tabs
// of the same book each add their own time instead of overwriting each other.
export function addTime(slug, seconds) {
  if (!slug || !(seconds > 0)) return null
  try {
    const all = readAll()
    all[slug] = Math.floor((Number(all[slug]) || 0) + seconds)
    localStorage.setItem(KEY, JSON.stringify(all))
    return all[slug]
  } catch {
    // Private windows and full storage. The counter still runs for this visit.
    return null
  }
}
