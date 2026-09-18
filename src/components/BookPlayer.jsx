import { useEffect, useRef, useState } from 'react'
import { artFor } from '../art.js'
import { freshBookUrl } from '../lumin.js'
import { useCover } from '../cover.js'
import { useAccount } from '../account.js'
import Icon from './Icon.jsx'
import { categoryIcon } from '../icons.js'

// Frames per second, sampled twice a second.
//
// This is **our** frame rate, not the book's. A cross origin iframe cannot be
// measured from out here, and nothing in the browser exposes another
// document's rate. In practice the two track each other, because the tab
// shares a compositor, so a book that is struggling drags this number down
// with it. But if the browser has put the book in its own process, this can
// sit at a healthy 60 while the book itself stutters. Read it as "is the page
// keeping up", not as a benchmark of the book.
//
// Sampled rather than reported per frame: setting state sixty times a second
// to draw a number that changes twice a second is pure waste.
const SAMPLE_MS = 500

function useFps(enabled) {
  const [fps, setFps] = useState(null)

  useEffect(() => {
    if (!enabled) return

    let raf = 0
    let frames = 0
    let last = performance.now()

    const loop = (now) => {
      frames += 1
      const elapsed = now - last
      if (elapsed >= SAMPLE_MS) {
        setFps(Math.round((frames * 1000) / elapsed))
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [enabled])

  return fps
}

// How long this book has been open, this visit.
//
// Counted from a timestamp rather than by adding a second per tick, because
// setInterval is not punctual and the error would accumulate: a tab left in
// the background throttles the callback and a counter that trusted its own
// tick count would drift minutes behind the clock.
//
// It resets on navigating to another book, since `App` gives the player a
// `key` of the book slug and so remounts it.
function useElapsed(active) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!active) return

    const started = Date.now()
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000))
    }, 1000)

    return () => clearInterval(id)
  }, [active])

  return seconds
}

function clock(total) {
  const pad = (n) => String(n).padStart(2, '0')
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// Adds the time a book is open to the account's total on the leaderboard.
//
// Only time the tab is actually visible counts. A book left open in a
// background tab is not being played, and counting it would let anyone
// top the board by leaving one open overnight in a tab they never look at.
//
// Written once a minute rather than continuously. That is about 60 writes an
// hour per player against a free allowance of 20,000 a day, and it is what
// the rules expect: each write may add no more than 90 seconds, and no more
// than has really passed since the last one. See the leaderboard block in
// firestore.rules.
//
// Nothing happens without an account, and the Firebase sdk is not fetched
// until the first minute is up, so a short visit never downloads it.
const FLUSH_MS = 60_000

function usePlaytime(slug) {
  const name = useAccount()?.name

  useEffect(() => {
    if (!name || !slug) return

    let pending = 0
    let last = performance.now()
    let visible = document.visibilityState === 'visible'

    // Banks the time since the last look, if the tab was visible for it.
    const tick = () => {
      const now = performance.now()
      if (visible) pending += (now - last) / 1000
      last = now
    }

    const flush = async () => {
      tick()
      const send = Math.floor(pending)
      // Not worth a write. It stays banked and goes with the next one.
      if (send < 5) return
      pending -= send

      try {
        const { addPlaytime } = await import('../playtime.js')
        await addPlaytime(send, name)
      } catch (e) {
        // Refused means the rules judged it too fast, which in practice is a
        // second tab of the same account that already wrote this minute. That
        // time was counted there, so drop it. Anything else is the network,
        // and the time goes back in the bank for the next attempt.
        if (e?.code !== 'permission-denied') pending += send
      }
    }

    const onVisibility = () => {
      tick()
      visible = document.visibilityState === 'visible'
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    const id = setInterval(flush, FLUSH_MS)

    // Leaving the book writes whatever is banked, so the last partial minute
    // is not lost.
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [name, slug])
}

export default function BookPlayer({ book, isFavorite, onFavorite, showFps = true }) {
  const frameRef = useRef(null)
  const [slow, setSlow] = useState(false)
  // A Lumin url carries a single use token, so it has to be fetched per
  // launch. Caching one would play once and then fail silently.
  const [luminUrl, setLuminUrl] = useState(null)
  const [luminError, setLuminError] = useState(null)
  const fps = useFps(showFps && Boolean(book))
  const elapsed = useElapsed(Boolean(book))
  usePlaytime(book?.slug)

  useEffect(() => {
    if (!book?.luminId) return
    let cancelled = false
    freshBookUrl(book.luminId)
      .then((url) => !cancelled && setLuminUrl(url))
      .catch((e) => !cancelled && setLuminError(e.message))
    return () => {
      cancelled = true
    }
  }, [book?.luminId])

  // Plenty of hosts refuse to be framed, and the iframe gives no error event
  // when they do. Say something after a few seconds either way.
  useEffect(() => {
    if (!book) return
    const t = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(t)
  }, [book])

  if (!book) {
    return (
      <div className="state">
        <h2>Book not found</h2>
        <a className="cta" href="#/">
          Back to all books
        </a>
      </div>
    )
  }

  const art = artFor(book.title, book.category)
  const src = book.luminId ? luminUrl : book.url

  return (
    <div className="player" style={art.style}>
      <div className="playerbar">
        <a className="iconbtn" href="#/" title="Back">
          <Icon name="back" />
        </a>

        <span className="nowplaying">
          <NowArt book={book} art={art} />
          <span className="np-text">
            <strong>{book.title}</strong>
            <em>
              <Icon name={categoryIcon(book.category)} size={12} />
              {book.category}
            </em>
          </span>
        </span>

        <span className="spacer" />

        <span className="playtime" title="Time on this book, this visit">
          <Icon name="clock" size={12} />
          <b>{clock(elapsed)}</b>
        </span>

        {showFps && <Fps value={fps} />}

        <button
          className={isFavorite ? 'iconbtn fav-on' : 'iconbtn'}
          onClick={() => onFavorite(book.slug)}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Icon name="star" filled={isFavorite} />
        </button>
        <button
          className="iconbtn"
          onClick={() => frameRef.current?.requestFullscreen?.()}
          title="Fullscreen"
        >
          <Icon name="expand" />
        </button>
      </div>

      <div className="stage">
        <span className="stage-load" aria-hidden="true">
          <span className="spinner" />
        </span>
        {src && (
          <iframe
            ref={frameRef}
            src={src}
            title={book.title}
            allow="autoplay; fullscreen; gamepad; pointer-lock"
          />
        )}
      </div>

      {luminError && <p className="hint">Could not start that book. {luminError}.</p>}

      {slow && !luminError && (
        <p className="hint">
          Not loading? Some sites refuse to run inside a frame. Try another book, or come
          back to this one later.
        </p>
      )}
    </div>
  )
}

// The book's own cover, at badge size, falling back to the generated initials.
// This used to always be the initials, which meant the bar showed "FC" next
// to a book whose real artwork was sitting right there in the library.
function NowArt({ book, art }) {
  const { src, onError } = useCover(book, { eager: true })

  return (
    <span
      className={src ? 'np-art has-cover' : 'np-art'}
      data-pattern={art.pattern}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" onError={onError} /> : art.initials}
    </span>
  )
}

// Under 50 reads as a problem, under 30 reads as unplayable, so the number is
// banded rather than left as a bare figure nobody can calibrate.
function Fps({ value }) {
  if (value == null) return null
  const band = value >= 50 ? 'good' : value >= 30 ? 'ok' : 'bad'

  return (
    <span className="fps" data-band={band} title="Frames per second on this page">
      <b>{value}</b>
      <em>fps</em>
    </span>
  )
}
