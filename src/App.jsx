import { useEffect, useMemo, useState } from 'react'
import {
  useGames,
  useHashRoute,
  useFavorites,
  useTheme,
  useRecent,
  usePrefersReducedMotion,
} from './lib.js'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import Hero from './components/Hero.jsx'
import Row from './components/Row.jsx'
import GameGrid from './components/GameGrid.jsx'
import GamePlayer from './components/GamePlayer.jsx'
import Skeleton from './components/Skeleton.jsx'

export default function App() {
  const route = useHashRoute()
  const { games, error } = useGames()
  const { favorites, toggle } = useFavorites()
  const { theme, toggleTheme } = useTheme()
  const { recent, push } = useRecent()
  const reduced = usePrefersReducedMotion()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [menu, setMenu] = useState(false)

  const playing = route.startsWith('game/') ? route.slice('game/'.length) : null

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
  }, [reduced])

  // Opening a game records it. Keyed on the slug so a reload of the same game
  // does not push a duplicate.
  useEffect(() => {
    if (playing) push(playing)
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps

  // The player is a full screen view, so the wall must not scroll behind it.
  useEffect(() => {
    document.body.classList.toggle('locked', Boolean(playing))
  }, [playing])

  const categories = useMemo(() => {
    if (!games) return ['All']
    const rest = [...new Set(games.map((g) => g.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
    return ['All', ...rest]
  }, [games])

  const counts = useMemo(() => {
    if (!games) return {}
    const out = { All: games.length }
    for (const g of games) out[g.category] = (out[g.category] || 0) + 1
    return out
  }, [games])

  const visible = useMemo(() => {
    if (!games) return []
    const q = query.trim().toLowerCase()
    return games.filter((g) => {
      if (category !== 'All' && g.category !== category) return false
      if (!q) return true
      return (
        g.title.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q) ||
        (g.tags || []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [games, query, category])

  if (error) {
    return (
      <div className="state">
        <h2>Could not load the game list</h2>
        <p>{error}</p>
      </div>
    )
  }

  if (!games) return <Skeleton />

  if (playing) {
    return (
      <GamePlayer
        key={playing}
        game={games.find((g) => g.slug === playing)}
        isFavorite={favorites.has(playing)}
        onFavorite={toggle}
      />
    )
  }

  const browsing = Boolean(query.trim()) || category !== 'All'
  const byIndex = new Map(games.map((g, i) => [g.slug, i]))
  const recentGames = recent.map((s) => games.find((g) => g.slug === s)).filter(Boolean)
  const favoriteGames = [...favorites]
    .map((s) => games.find((g) => g.slug === s))
    .filter(Boolean)
    .sort((a, b) => byIndex.get(a.slug) - byIndex.get(b.slug))
  const featured = games.filter((g) => g.featured)
  const hero = featured[0] || games[0]

  return (
    <div className="shell">
      <Header
        query={query}
        onQuery={setQuery}
        theme={theme}
        onTheme={toggleTheme}
        onMenu={() => setMenu((m) => !m)}
        count={games.length}
      />

      <Sidebar
        categories={categories}
        category={category}
        onCategory={setCategory}
        counts={counts}
        open={menu}
        onClose={() => setMenu(false)}
      />

      <main>
        {!browsing && hero && <Hero game={hero} />}

        {!browsing && (
          <Row
            title="Jump back in"
            icon="clock"
            games={recentGames}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}

        {!browsing && (
          <Row
            title="Your favorites"
            icon="star"
            games={favoriteGames}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}

        {!browsing && featured.length > 1 && (
          <Row
            title="Featured"
            icon="action"
            games={featured}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}

        <GameGrid
          title={browsing ? 'Results' : 'All games'}
          icon={browsing ? 'search' : 'all'}
          games={visible}
          favorites={favorites}
          onFavorite={toggle}
          bento={!browsing}
          empty={`Nothing matched ${query ? `"${query}"` : 'that'}.`}
        />

        <footer>
          <span className="brand-sm">Blocked</span>
          <span>
            {games.length} games, {categories.length - 1} categories
          </span>
        </footer>
      </main>
    </div>
  )
}
