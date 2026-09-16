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

export function useGames() {
  const [games, setGames] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    // no-cache revalidates instead of serving a stale copy. Without it the
    // browser keeps an old games.json and newly added games never appear
    // after a deploy, which is silent and very confusing.
    fetch('games.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('games.json returned ' + r.status)
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
        setGames(withSlugs)
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  return { games, error }
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

const THEME_KEY = 'blocked:theme'

// Dark is the default. The choice is written to the root element so the CSS
// variable overrides in styles.css can pick it up.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Same story as favorites. Not persisting is acceptable.
    }
  }, [theme])

  return { theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }
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
