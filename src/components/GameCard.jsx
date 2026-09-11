import { useState } from 'react'

export default function GameCard({ game, isFavorite, onFavorite }) {
  const [broken, setBroken] = useState(false)

  return (
    <a className="card" href={`#/game/${game.slug}`}>
      <div className="thumb">
        {game.game_image_icon && !broken ? (
          <img
            src={game.game_image_icon}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="fallback">{game.title.slice(0, 1)}</span>
        )}
        <button
          className={isFavorite ? 'fav on' : 'fav'}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.preventDefault()
            onFavorite(game.slug)
          }}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>
      <div className="meta">
        <h3>{game.title}</h3>
        {game.category && <span className="tag">{game.category}</span>}
      </div>
    </a>
  )
}
