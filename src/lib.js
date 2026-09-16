import { useEffect, useState } from 'react'

// Turns "Bendy and the Ink Machine" into "bendy-and-the-ink-machine" so a game
// gets a stable, shareable URL that does not change if the list is reordered.
export function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Hash routing keeps every URL a single static file request, so the site works
// on any host without server rewrite rules.
export function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '')
  const [route, setRoute] = useState(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

export function navigate(path) {
  window.location.hash = '/' + path
}

// `file` is a path under public/, so the same hook serves the built in list
// and every per source library.
export function useGames({ enabled = true, file = 'games.json' } = {}) {
  // The loaded file is stored alongside its games, so "this result belongs to
  // a library we are no longer showing" is derived during render instead of
  // being cleared by a setState inside the effect.
  const [loaded, setLoaded] = useState({ file: null, games: null, error: null })

  useEffect(() => {
    if (!enabled || !file) return
    let cancelled = false
    // no-cache revalidates instead of serving a stale copy. Without it the
    // browser keeps an old games.json and newly added games never appear
    // after a deploy, which is silent and very confusing.
    fetch(file, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(file + ' returned ' + r.status)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return

        // Slugs are URLs, so they have to be unique. Two games sharing a
        // title would otherwise collide as React keys and both resolve to
        // the same page.
        //
        // The suffix has to dodge real titles as well as earlier suffixes.
        // "Fancy Pants Adventures 2" already slugs to
        // fancy-pants-adventures-2, so a plain "-2" on a duplicate of
        // "Fancy Pants Adventures" would steal the sequel's URL. Checking
        // against every base slug up front is what prevents that.
        const bases = data.map((g) => slugify(g.title) || 'game')
        const allBases = new Set(bases)
        const taken = new Set()

        const withSlugs = data.map((g, i) => {
          let slug = bases[i]
          if (taken.has(slug)) {
            let n = 2
            while (taken.has(`${slug}-${n}`) || allBases.has(`${slug}-${n}`)) n++
            slug = `${slug}-${n}`
          }
          taken.add(slug)
          return { ...g, slug }
        })
        setLoaded({ file, games: withSlugs, error: null })
      })
      .catch((e) => !cancelled && setLoaded({ file, games: null, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [enabled, file])

  // A result for a different file is stale, so report "still loading" rather
  // than showing the previous library's games under the new library's name.
  const fresh = loaded.file === file
  return { games: fresh ? loaded.games : null, error: fresh ? loaded.error : null }
}

const FAVORITES_KEY = 'blocked:favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [])
    } catch {
      return new Set()
    }
  })

  const toggle = (slug) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]))
      } catch {
        // Private windows and blocked site data throw here. Favorites just
        // will not persist, which is fine.
      }
      return next
    })
  }

  return { favorites, toggle }
}

const RECENT_KEY = 'blocked:recent'
const RECENT_MAX = 12

// Recently played is the row every game site opens with, and it is the one
// piece of personalisation a static site can honestly offer.
export function useRecent() {
  const [recent, setRecent] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY))
      return Array.isArray(raw) ? raw : []
    } catch {
      return []
    }
  })

  const push = (slug) => {
    setRecent((prev) => {
      const next = [slug, ...prev.filter((s) => s !== slug)].slice(0, RECENT_MAX)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        // Not persisting is acceptable, the row just starts empty next time.
      }
      return next
    })
  }

  return { recent, push }
}

// Badges come from real data only. `featured` in games.json drives HOT, and an
// optional ISO `added` date inside the last two weeks drives NEW. Nothing here
// is invented from a hash, because a fake "HOT" on every card is noise.
const NEW_DAYS = 14

export function badgeFor(game) {
  if (game.added) {
    const age = (Date.now() - new Date(game.added).getTime()) / 86400000
    if (age >= 0 && age <= NEW_DAYS) return 'new'
  }
  return game.featured ? 'hot' : null
}

// Respects the OS setting. Used to skip the staggered entry animation, which
// is decorative and can be unpleasant for people who ask for less motion.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

// Picks one random on screen card every few seconds and lets it shimmer, so
// the wall has a small sign of life without 450 cards pulsing in unison.
//
// It walks the DOM rather than holding React state on purpose: re-rendering
// the whole grid to highlight one tile would be far more work than adding a
// class, and the effect is decoration that never needs to survive a render.
export function useIdleShimmer(enabled) {
  useEffect(() => {
    if (!enabled) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const SHIMMER_MS = 1150
    const GAP_MS = 1500
    let timer = 0
    let current = null

    const clear = () => {
      if (current) current.classList.remove('idle')
      current = null
    }

    const tick = () => {
      // Only cards actually in view are worth animating.
      const cards = [...document.querySelectorAll('.card')].filter((el) => {
        const r = el.getBoundingClientRect()
        return r.bottom > 0 && r.top < window.innerHeight && r.width > 0
      })

      if (cards.length) {
        current = cards[Math.floor(Math.random() * cards.length)]
        current.classList.add('idle')
      }

      // Drop the class as soon as the sweep ends rather than at the next
      // tick, otherwise the highlighted border never goes away and the wall
      // always has one lit card instead of an occasional one.
      timer = window.setTimeout(() => {
        clear()
        timer = window.setTimeout(tick, GAP_MS)
      }, SHIMMER_MS)
    }

    timer = window.setTimeout(tick, GAP_MS)

    return () => {
      window.clearTimeout(timer)
      clear()
    }
  }, [enabled])
}
