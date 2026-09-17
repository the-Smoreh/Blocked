import { useEffect, useMemo, useState } from 'react'
import {
  useGames,
  useHashRoute,
  useFavorites,
  useRecent,
  usePrefersReducedMotion,
  useIdleShimmer,
} from './lib.js'
import { useSettings, LIBRARIES, libraryFile, pairTheme } from './settings.js'
import { categoryTone } from './icons.js'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import Hero from './components/Hero.jsx'
import Row from './components/Row.jsx'
import GameGrid from './components/GameGrid.jsx'
import GamePlayer from './components/GamePlayer.jsx'
import Skeleton from './components/Skeleton.jsx'
import Settings from './components/Settings.jsx'
import { useLuminCatalogue } from './lumin.js'
import { loadLuminDonors, loadSeleniteDonors, registerDonors } from './borrow.js'

// Libraries where pulling Lumin's catalogue in as a donor pool pays for the
// third party script it costs. See the effect below for the numbers.
const LUMIN_WORTH_IT = new Set(['selenite', 'lumin'])

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

  const activeLib = LIBRARIES[settings.library] || LIBRARIES.lumin
  const usingLumin = activeLib.kind === 'embed'

  // Only the selected library is fetched, so picking one of the small ones
  // does not pull a 4500 line json nobody will look at.
  const fromFile = useGames({
    enabled: !usingLumin,
    file: libraryFile(settings.library),
  })

  // Lumin is fetched over its SDK in headless mode rather than from a file,
  // and then rendered through exactly the same cards, hero, rows, search and
  // settings as every other library.
  const fromLumin = useLuminCatalogue(usingLumin)

  const games = usingLumin ? fromLumin.games : fromFile.games
  const error = usingLumin ? fromLumin.error : fromFile.error

  // Whatever is on screen becomes a donor for the other libraries, and the
  // pools that can fill this one's gaps get pulled in.
  //
  // Selenite is one of our own static files, so it is always worth having.
  //
  // Lumin is different: fetching it means loading a third party's obfuscated
  // script on a page that was not otherwise going to, so it has to earn that.
  // Measured against every library's missing covers, it only does for
  // Selenite, where it fills 79 of 105 gaps. Everywhere else it is 3 to 10
  // per cent, because `share-icons.mjs` has already lent them what Selenite
  // has and Lumin's catalogue is largely Selenite again, its ids are
  // namespaced `selenite/`. So the other libraries borrow from our own files
  // only.
  useEffect(() => {
    if (!games) return
    registerDonors(settings.library, games)
    if (!settings.borrowCovers) return

    loadSeleniteDonors()
    if (LUMIN_WORTH_IT.has(settings.library)) loadLuminDonors()
  }, [games, settings.library, settings.borrowCovers])

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

  if (error) {
    return (
      <>
        <div className="state">
          <h2>{usingLumin ? 'Could not reach that library' : 'Could not load the game list'}</h2>
          <p>Not loading? Try a different library and check here later.</p>
          <div className="state-row">
            {usingLumin && settings.library !== 'selenite' && (
              <button className="cta" onClick={() => set({ library: 'selenite' })}>
                Use Selenite instead
              </button>
            )}
            <button className="btn" onClick={() => setPanel(true)}>
              Open settings
            </button>
          </div>
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
          showFps={settings.showFps}
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
        theme={settings.theme}
        onTheme={() => set(pairTheme(settings, settings.theme === 'light' ? 'dark' : 'light'))}
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
          <span className="credit">
            {activeLib.credit ? (
              <>
                {games.length} games from <strong>{activeLib.label}</strong> by{' '}
                <a href={activeLib.credit} target="_blank" rel="noreferrer">
                  {activeLib.author}
                </a>
              </>
            ) : (
              <>
                {games.length} games, {categories.length - 1} categories
              </>
            )}
          </span>
        </footer>
      </main>

      {sheet}
    </div>
  )
}
