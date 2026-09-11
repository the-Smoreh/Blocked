import { useMemo, useState } from 'react'
import { useGames, useHashRoute, useFavorites } from './lib.js'
import Header from './components/Header.jsx'
import GameGrid from './components/GameGrid.jsx'
import GamePlayer from './components/GamePlayer.jsx'

export default function App() {
  const route = useHashRoute()
  const { games, error } = useGames()
  const { favorites, toggle } = useFavorites()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  const categories = useMemo(() => {
    if (!games) return ['All']
    return ['All', ...new Set(games.map((g) => g.category).filter(Boolean))].sort(
      (a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)),
    )
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

  if (!games) {
    return <div className="state">Loading</div>
  }

  if (route.startsWith('game/')) {
    const slug = route.slice('game/'.length)
    const game = games.find((g) => g.slug === slug)
    return <GamePlayer game={game} />
  }

  const favoriteGames = games.filter((g) => favorites.has(g.slug))
  const showFavorites = favoriteGames.length > 0 && !query && category === 'All'
  const featured = games.filter((g) => g.featured)
  const showFeatured = featured.length > 0 && !query && category === 'All'

  return (
    <>
      <Header
        query={query}
        onQuery={setQuery}
        categories={categories}
        category={category}
        onCategory={setCategory}
      />
      <main>
        {showFavorites && (
          <GameGrid
            title="Your favorites"
            games={favoriteGames}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}
        {showFeatured && (
          <GameGrid
            title="Featured"
            games={featured}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}
        <GameGrid
          title={
            query || category !== 'All'
              ? `${visible.length} result${visible.length === 1 ? '' : 's'}`
              : 'All games'
          }
          games={visible}
          favorites={favorites}
          onFavorite={toggle}
          empty="Nothing matched that search."
        />
      </main>
      <footer>
        <span>Blocked</span>
        <span>{games.length} games</span>
      </footer>
    </>
  )
}
