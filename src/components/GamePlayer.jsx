import { useEffect, useRef, useState } from 'react'
import { artFor } from '../art.js'
import { freshGameUrl } from '../lumin.js'
import Icon from './Icon.jsx'
import { categoryIcon } from '../icons.js'

export default function GamePlayer({ game, isFavorite, onFavorite }) {
  const frameRef = useRef(null)
  const [slow, setSlow] = useState(false)
  // A Lumin url carries a single use token, so it has to be fetched per
  // launch. Caching one would play once and then fail silently.
  const [luminUrl, setLuminUrl] = useState(null)
  const [luminError, setLuminError] = useState(null)

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
  // when they do. Show the escape hatch after a few seconds either way.
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
          <span className="np-art" data-pattern={art.pattern} aria-hidden="true">
            {art.initials}
          </span>
          <span className="np-text">
            <strong>{game.title}</strong>
            <em>
              <Icon name={categoryIcon(game.category)} size={12} />
              {game.category}
            </em>
          </span>
        </span>

        <span className="spacer" />

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
        <a className="iconbtn" href={game.url} target="_blank" rel="noreferrer" title="Open in new tab">
          <Icon name="external" />
        </a>
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
          Not loading? Some sites refuse to run inside a frame. Use the new tab button.
        </p>
      )}
    </div>
  )
}
