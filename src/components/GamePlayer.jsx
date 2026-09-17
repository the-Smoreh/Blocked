import { useEffect, useRef, useState } from 'react'
import { artFor } from '../art.js'
import { freshGameUrl } from '../lumin.js'
import { useCover } from '../cover.js'
import Icon from './Icon.jsx'
import { categoryIcon } from '../icons.js'

// Frames per second, sampled twice a second.
//
// This is **our** frame rate, not the game's. A cross origin iframe cannot be
// measured from out here, and nothing in the browser exposes another
// document's rate. In practice the two track each other, because the tab
// shares a compositor, so a game that is struggling drags this number down
// with it. But if the browser has put the game in its own process, this can
// sit at a healthy 60 while the game itself stutters. Read it as "is the page
// keeping up", not as a benchmark of the game.
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

// How long this game has been open, this visit.
//
// Counted from a timestamp rather than by adding a second per tick, because
// setInterval is not punctual and the error would accumulate: a tab left in
// the background throttles the callback and a counter that trusted its own
// tick count would drift minutes behind the clock.
//
// It resets on navigating to another game, since `App` gives the player a
// `key` of the game slug and so remounts it.
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

export default function GamePlayer({ game, isFavorite, onFavorite, showFps = true }) {
  const frameRef = useRef(null)
  const [slow, setSlow] = useState(false)
  // A Lumin url carries a single use token, so it has to be fetched per
  // launch. Caching one would play once and then fail silently.
  const [luminUrl, setLuminUrl] = useState(null)
  const [luminError, setLuminError] = useState(null)
  const fps = useFps(showFps && Boolean(game))
  const elapsed = useElapsed(Boolean(game))

  useEffect(() => {
    if (!game?.luminId) return
    let cancelled = false
    freshGameUrl(game.luminId)
      .then((url) => !cancelled && setLuminUrl(url))
      .catch((e) => !cancelled && setLuminError(e.message))
    return () => {
      cancelled = true
    }
  }, [game?.luminId])

  // Plenty of hosts refuse to be framed, and the iframe gives no error event
  // when they do. Say something after a few seconds either way.
  useEffect(() => {
    if (!game) return
    const t = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(t)
  }, [game])

  if (!game) {
    return (
      <div className="state">
        <h2>Game not found</h2>
        <a className="cta" href="#/">
          Back to all games
        </a>
      </div>
    )
  }

  const art = artFor(game.title, game.category)
  const src = game.luminId ? luminUrl : game.url

  return (
    <div className="player" style={art.style}>
      <div className="playerbar">
        <a className="iconbtn" href="#/" title="Back">
          <Icon name="back" />
        </a>

        <span className="nowplaying">
          <NowArt game={game} art={art} />
          <span className="np-text">
            <strong>{game.title}</strong>
            <em>
              <Icon name={categoryIcon(game.category)} size={12} />
              {game.category}
            </em>
          </span>
        </span>

        <span className="spacer" />

        <span className="playtime" title="Time on this game, this visit">
          <Icon name="clock" size={12} />
          <b>{clock(elapsed)}</b>
        </span>

        {showFps && <Fps value={fps} />}

        <button
          className={isFavorite ? 'iconbtn fav-on' : 'iconbtn'}
          onClick={() => onFavorite(game.slug)}
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
            title={game.title}
            allow="autoplay; fullscreen; gamepad; pointer-lock"
          />
        )}
      </div>

      {luminError && <p className="hint">Could not start that game. {luminError}.</p>}

      {slow && !luminError && (
        <p className="hint">
          Not loading? Some sites refuse to run inside a frame. Try another game, or come
          back to this one later.
        </p>
      )}
    </div>
  )
}

// The game's own cover, at badge size, falling back to the generated initials.
// This used to always be the initials, which meant the bar showed "FC" next
// to a game whose real artwork was sitting right there in the library.
function NowArt({ game, art }) {
  const { src, onError } = useCover(game, { eager: true })

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
