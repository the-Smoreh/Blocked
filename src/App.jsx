import { useEffect, useMemo, useState } from 'react'
import {
  useGames,
  useHashRoute,
  useFavorites,
  useRecent,
  usePrefersReducedMotion,
  useIdleShimmer,
} from './lib.js'
import { useSettings } from './settings.js'
import { categoryTone } from './icons.js'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import Hero from './components/Hero.jsx'
import Row from './components/Row.jsx'
import GameGrid from './components/GameGrid.jsx'
import GamePlayer from './components/GamePlayer.jsx'
import Skeleton from './components/Skeleton.jsx'
import Settings from './components/Settings.jsx'
import LuminLibrary from './components/LuminLibrary.jsx'

export default function App() {
  const route = useHashRoute()
  const { settings, set, reset } = useSettings()
  const { favorites, toggle } = useFavorites()
  const { recent, push } = useRecent()
  const reduced = usePrefersReducedMotion()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [menu, setMenu] = useState(false)
  const [panel, setPanel] = useState(false)

  const usingLumin = settings.library === 'lumin'

  // The built in list is only fetched when it is the selected library, so
  // choosing Lumin does not pull a 4500 line json nobody will look at.
  const { games, error } = useGames({ enabled: !usingLumin })

  const playing = route.startsWith('game/') ? route.slice('game/'.length) : null

  useIdleShimmer(settings.idleShimmer && !playing)

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
  }, [reduced])

  useEffect(() => {
    if (playing) push(playing)
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps

  // The player and the settings sheet are both full bleed, so the wall behind
  // them must not scroll.
  useEffect(() => {
    document.body.classList.toggle('locked', Boolean(playing) || panel)
  }, [playing, panel])

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

  const sheet = (
    <Settings
      open={panel}
      onClose={() => setPanel(false)}
      settings={settings}
      set={set}
      reset={reset}
    />
  )

  // --- The third party library replaces the whole browsing UI. ---
  if (usingLumin && !playing) {
    return (
      <div className="shell no-rail">
        <Header
          query={query}
          onQuery={setQuery}
          onSettings={() => setPanel(true)}
          onMenu={() => setMenu(false)}
          count={0}
          showMenu={false}
        />
        <main>
          <LuminLibrary
            key={settings.theme}
            theme={settings.theme}
            onUseLocal={() => set({ library: 'local' })}
          />
          <footer>
            <span className="brand-sm">Blocked</span>
            <span>Lumin library</span>
          </footer>
        </main>
        {sheet}
      </div>
    )
  }

  if (error) {
    return (
      <>
        <div className="state">
          <h2>Could not load the game list</h2>
          <p>{error}</p>
          <button className="cta" onClick={() => setPanel(true)}>
            Open settings
          </button>
        </div>
        {sheet}
      </>
    )
  }

  if (!games) {
    return (
      <>
        <Skeleton />
        {sheet}
      </>
    )
  }

  if (playing) {
    return (
      <>
        <GamePlayer
          key={playing}
          game={games.find((g) => g.slug === playing)}
          isFavorite={favorites.has(playing)}
          onFavorite={toggle}
        />
        {sheet}
      </>
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
        onSettings={() => setPanel(true)}
        onMenu={() => setMenu((m) => !m)}
        count={games.length}
        showMenu
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
            tone={9}
            games={recentGames}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}

        {!browsing && (
          <Row
            title="Your favorites"
            icon="star"
            tone={3}
            games={favoriteGames}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}

        {!browsing && featured.length > 1 && (
          <Row
            title="Featured"
            icon="action"
            tone={11}
            games={featured}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}

        <GameGrid
          title={browsing ? 'Results' : 'All games'}
          icon={browsing ? 'search' : 'all'}
          tone={browsing ? categoryTone(category) : 0}
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

      {sheet}
    </div>
  )
}
