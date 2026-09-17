import { useEffect, useRef, useState } from 'react'
import { artFor } from '../art.js'
import { badgeFor } from '../lib.js'
import { resolveImage } from '../lumin.js'
import Icon from './Icon.jsx'
import { categoryIcon, categoryTone } from '../icons.js'

export default function GameCard({ game, isFavorite, onFavorite, size = 'sm', index = 0 }) {
  const [broken, setBroken] = useState(false)
  // Lumin gives an image token rather than a url, so its cover has to be
  // resolved. Only once the card is near the viewport: resolving a thousand
  // at once would mean a thousand blob urls for cards nobody has scrolled to.
  const [tokenSrc, setTokenSrc] = useState(null)
  const ref = useRef(null)
  const art = artFor(game.title, game.category)
  const badge = badgeFor(game)
  const src = game.game_image_icon || tokenSrc
  const hasImage = src && !broken

  useEffect(() => {
    if (!game.imageToken || tokenSrc) return
    const el = ref.current
    if (!el) return

    // No IntersectionObserver means resolve immediately rather than never.
    if (typeof IntersectionObserver !== 'function') {
      resolveImage(game.imageToken).then(setTokenSrc)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        resolveImage(game.imageToken).then(setTokenSrc)
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [game.imageToken, tokenSrc])

  return (
    <a
      ref={ref}
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
        {hasImage && <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} />}

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
