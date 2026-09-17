import { useState } from 'react'
import { artFor } from '../art.js'
import Icon from './Icon.jsx'
import { categoryIcon } from '../icons.js'
import { useCover } from '../cover.js'

// The spotlight. One game, big.
//
// When the game has a cover it fills the panel: a scaled up blurred copy
// behind everything, plus a crisp copy on the right at its own aspect ratio.
// The blurred copy is what makes it work at this size, because these covers
// are small and mostly square, so stretching one across a wide panel on its
// own would just look soft and cropped.
//
// Without a cover, or if the image fails, it falls back to the generated art
// and the oversized initials, which is what every library other than Selenite
// and Alexx743 gets.
// Below this the poster is not upscaled, and is rendered without smoothing.
// Some covers are 16 or 32px favicons, and stretching one to fill 76% of the
// hero turns it to mush. Pixelated keeps a small pixel art cover looking
// deliberate instead of broken.
const SMALL_COVER = 96

export default function Hero({ game }) {
  const [small, setSmall] = useState(false)
  const art = artFor(game.title, game.category)
  // Eager, because the hero is one element and always on screen, so there is
  // nothing to wait for. Same resolution order as the cards otherwise: own
  // url, Lumin token, then a cover borrowed from another library.
  const { src: cover, onError } = useCover(game, { eager: true })

  return (
    <section
      className="hero"
      style={art.style}
      data-pattern={art.pattern}
      data-art={cover ? 'cover' : 'generated'}
    >
      {cover ? (
        <>
          <span
            className="hero-fill"
            aria-hidden="true"
            style={{ backgroundImage: `url("${cover}")` }}
          />
          {/* An img rather than a second background, so a dead cover raises
              onError and the whole panel can fall back. A background-image
              would fail silently and leave a blank panel. */}
          <img
            className={small ? 'hero-poster small' : 'hero-poster'}
            src={cover}
            alt=""
            onError={onError}
            onLoad={(e) => setSmall(e.currentTarget.naturalWidth < SMALL_COVER)}
          />
        </>
      ) : (
        <span className="hero-art" aria-hidden="true" />
      )}

      <span className="hero-mesh" aria-hidden="true" />

      <div className="hero-inner">
        <span className="hero-kicker">
          <span className="dot" />
          Spotlight
        </span>
        <h1>{game.title}</h1>
        {game.description && <p>{game.description}</p>}
        <div className="hero-row">
          <a className="cta" href={`#/game/${game.slug}`}>
            <Icon name="play" size={18} filled />
            Play now
          </a>
          <span className="hero-tag">
            <Icon name={categoryIcon(game.category)} size={14} />
            {game.category}
          </span>
        </div>
      </div>

      {!cover && (
        <span className="hero-glyph" aria-hidden="true">
          {art.initials}
        </span>
      )}
    </section>
  )
}
