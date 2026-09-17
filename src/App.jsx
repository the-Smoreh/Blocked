import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  useBooks,
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
import BookGrid from './components/BookGrid.jsx'
import BookPlayer from './components/BookPlayer.jsx'
import Skeleton from './components/Skeleton.jsx'
import Settings from './components/Settings.jsx'
// Loaded only when the room is opened, not on every visit.
//
// The Firebase sdk it pulls in is larger than the entire rest of the app:
// bundling it in took the first load from 88kB to 248kB gzipped, for a
// feature most visitors never touch. Split out, the wall loads at its old
// weight and the chat fetches its own chunk on the click that needs it.
const ChatRoom = lazy(() => import('./components/ChatRoom.jsx'))
import { useLuminCatalogue } from './lumin.js'
import { loadLuminDonors, loadSeleniteDonors, registerDonors } from './borrow.js'

// Where Lumin falls through to when its service does not answer.
const FALLBACK_LIBRARY = 'selenite'

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
  // The chat room deliberately lives in state rather than in the url, which
  // is what makes a category, a search or a reload leave it. Putting it on a
  // route would survive a refresh, and being returned to a chat room you did
  // not ask for is not what was wanted.
  const [chat, setChat] = useState(false)

  const selected = LIBRARIES[settings.library] || LIBRARIES.lumin
  const usingLumin = selected.kind === 'embed'

  // Lumin is fetched over its SDK in headless mode rather than from a file,
  // and then rendered through exactly the same cards, hero, rows, search and
  // settings as every other library.
  const fromLumin = useLuminCatalogue(usingLumin)

  // Lumin is the default, and it is somebody else's service reached over
  // somebody else's cdn. A default that shows an error as the front page is a
  // defect, so a failure falls through to Selenite for this visit instead.
  //
  // The setting is deliberately not rewritten: the choice stays Lumin, and a
  // later visit tries it again. Silently changing what someone picked is
  // worse than a quiet fallback.
  const luminFailed = usingLumin && Boolean(fromLumin.error)
  const fileId = luminFailed ? FALLBACK_LIBRARY : settings.library

  // Only the library actually on screen is fetched, so picking one of the
  // small ones does not pull a 4500 line json nobody will look at.
  const fromFile = useBooks({
    enabled: !usingLumin || luminFailed,
    file: libraryFile(fileId),
  })

  const onLumin = usingLumin && !luminFailed
  const books = onLumin ? fromLumin.books : fromFile.books
  const error = onLumin ? fromLumin.error : fromFile.error

  // What is on screen, which is what the footer must credit. Crediting the
  // library someone picked while showing a different one's books would be a
  // lie about whose work it is.
  const activeLib = LIBRARIES[onLumin ? settings.library : fileId] || selected

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
    if (!books) return
    registerDonors(onLumin ? settings.library : fileId, books)
    if (!settings.borrowCovers) return

    loadSeleniteDonors()
    if (LUMIN_WORTH_IT.has(settings.library)) loadLuminDonors()
  }, [books, settings.library, settings.borrowCovers, onLumin, fileId])

  // `game/` is still accepted. The route was renamed, and a url is a promise
  // to whoever saved it: every link shared or bookmarked before the rename
  // points at `#/game/<slug>` and would otherwise land on the wall with no
  // explanation. New links are written as `book/`; this only reads.
  const playing = route.startsWith('book/')
    ? route.slice('book/'.length)
    : route.startsWith('game/')
      ? route.slice('game/'.length)
      : null

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
    if (!books) return ['All']
    const rest = [...new Set(books.map((g) => g.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
    return ['All', ...rest]
  }, [books])

  const counts = useMemo(() => {
    if (!books) return {}
    const out = { All: books.length }
    for (const g of books) out[g.category] = (out[g.category] || 0) + 1
    return out
  }, [books])

  const visible = useMemo(() => {
    if (!books) return []
    const q = query.trim().toLowerCase()
    return books.filter((g) => {
      if (category !== 'All' && g.category !== category) return false
      if (!q) return true
      return (
        g.title.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q) ||
        (g.tags || []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [books, query, category])

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
          <h2>{onLumin ? 'Could not reach that library' : 'Could not load the book list'}</h2>
          <p>Not loading? Try a different library and check here later.</p>
          <div className="state-row">
            {/* Only worth offering when it has not already been tried. A
                Lumin failure falls through to Selenite on its own, so
                reaching here means that failed as well. */}
            {settings.library !== FALLBACK_LIBRARY && !luminFailed && (
              <button className="cta" onClick={() => set({ library: FALLBACK_LIBRARY })}>
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

  if (!books) {
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
        <BookPlayer
          key={playing}
          book={books.find((g) => g.slug === playing)}
          isFavorite={favorites.has(playing)}
          onFavorite={toggle}
          showFps={settings.showFps}
        />
        {sheet}
      </>
    )
  }

  const browsing = Boolean(query.trim()) || category !== 'All'
  const byIndex = new Map(books.map((g, i) => [g.slug, i]))
  const recentBooks = recent.map((s) => books.find((g) => g.slug === s)).filter(Boolean)
  const favoriteBooks = [...favorites]
    .map((s) => books.find((g) => g.slug === s))
    .filter(Boolean)
    .sort((a, b) => byIndex.get(a.slug) - byIndex.get(b.slug))
  const featured = books.filter((g) => g.featured)
  const hero = featured[0] || books[0]

  return (
    <div className="shell">
      <Header
        query={query}
        onQuery={(q) => {
          setQuery(q)
          if (q) setChat(false)
        }}
        onSettings={() => setPanel(true)}
        onMenu={() => setMenu((m) => !m)}
        count={books.length}
        showMenu
        theme={settings.theme}
        onTheme={() => set(pairTheme(settings, settings.theme === 'light' ? 'dark' : 'light'))}
      />

      <Sidebar
        categories={categories}
        category={category}
        onCategory={(c) => {
          setCategory(c)
          setChat(false)
        }}
        counts={counts}
        open={menu}
        onClose={() => setMenu(false)}
        chatOpen={chat}
        onChat={() => setChat((c) => !c)}
      />

      <main>
        {chat && (
          <Suspense
            fallback={
              <div className="chat chat-state">
                <span className="spinner" />
              </div>
            }
          >
            <ChatRoom onClose={() => setChat(false)} />
          </Suspense>
        )}

        {!chat && !browsing && hero && <Hero book={hero} />}

        {!chat && !browsing && (
          <Row
            title="Jump back in"
            icon="clock"
            tone={9}
            books={recentBooks}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}

        {!chat && !browsing && (
          <Row
            title="Your favorites"
            icon="star"
            tone={3}
            books={favoriteBooks}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}

        {!chat && !browsing && featured.length > 1 && (
          <Row
            title="Featured"
            icon="action"
            tone={11}
            books={featured}
            favorites={favorites}
            onFavorite={toggle}
          />
        )}

        {!chat && (
        <BookGrid
          title={browsing ? 'Results' : 'All books'}
          icon={browsing ? 'search' : 'all'}
          tone={browsing ? categoryTone(category) : 0}
          books={visible}
          favorites={favorites}
          onFavorite={toggle}
          bento={!browsing}
          empty={`Nothing matched ${query ? `"${query}"` : 'that'}.`}
        />
        )}

        <footer>
          <span className="brand-sm">Blocked</span>
          <span className="credit">
            {activeLib.credit ? (
              <>
                {/* Plain text, not a link. Every outbound link is being
                    collected onto one links page instead, so there are no
                    stray redirects dotted around the interface. The credit
                    itself stays, because naming the source is the point. */}
                {books.length} books from <strong>{activeLib.label}</strong> by{' '}
                <strong>{activeLib.author}</strong>
              </>
            ) : (
              <>
                {books.length} books, {categories.length - 1} categories
              </>
            )}
          </span>
        </footer>
      </main>

      {sheet}
    </div>
  )
}
