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
    fetch('games.json')
      .then((r) => {
        if (!r.ok) throw new Error('games.json returned ' + r.status)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        const withSlugs = data.map((g) => ({ ...g, slug: slugify(g.title) }))
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
      next.has(slug) ? next.delete(slug) : next.add(slug)
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
