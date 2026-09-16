import { useEffect, useRef, useState } from 'react'
import { artFor } from '../art.js'
import Icon from './Icon.jsx'
import { categoryIcon } from '../icons.js'

export default function GamePlayer({ game, isFavorite, onFavorite }) {
  const frameRef = useRef(null)
  const [slow, setSlow] = useState(false)

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
        <iframe
          ref={frameRef}
          src={game.url}
          title={game.title}
          allow="fullscreen; gamepad; autoplay"
        />
      </div>

      {slow && (
        <p className="hint">
          Not loading? Some sites refuse to run inside a frame. Use the new tab button.
        </p>
      )}
    </div>
  )
}
