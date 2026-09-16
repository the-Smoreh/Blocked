import { useState } from 'react'
import { artFor } from '../art.js'
import { badgeFor } from '../lib.js'
import Icon from './Icon.jsx'
import { categoryIcon, categoryTone } from '../icons.js'

export default function GameCard({ game, isFavorite, onFavorite, size = 'sm', index = 0 }) {
  const [broken, setBroken] = useState(false)
  const art = artFor(game.title, game.category)
  const badge = badgeFor(game)
  const hasImage = game.game_image_icon && !broken

  return (
    <a
      className={`card card-${size}`}
      href={`#/game/${game.slug}`}
      title={game.title}
      aria-label={game.title}
      style={{ ...art.style, '--i': index }}
      data-pattern={art.pattern}
    >
      <div className="thumb">
        {/* The generated art is always painted. A real image just covers it,
            so a 404 leaves art behind instead of a hole. */}
        <span className="art" aria-hidden="true" />
        <span className="art-initials" aria-hidden="true">
          {art.initials}
        </span>
        {hasImage && (
          <img src={game.game_image_icon} alt="" loading="lazy" onError={() => setBroken(true)} />
        )}

        <span className="shine" aria-hidden="true" />

        <span className="playwrap" aria-hidden="true">
          <span className="playbtn">
            <Icon name="play" size={size === 'lg' ? 26 : 20} filled />
          </span>
        </span>

        {badge && <span className={`badge badge-${badge}`}>{badge === 'hot' ? 'HOT' : 'NEW'}</span>}

        <button
          className={isFavorite ? 'fav on' : 'fav'}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.preventDefault()
            onFavorite(game.slug)
          }}
        >
          <Icon name="star" size={15} filled={isFavorite} />
        </button>
      </div>

      <div className="meta">
        <h3>{game.title}</h3>
        <span className="tag" data-tone={categoryTone(game.category)}>
          <Icon name={categoryIcon(game.category)} size={13} />
          {game.category}
        </span>
      </div>
    </a>
  )
}
