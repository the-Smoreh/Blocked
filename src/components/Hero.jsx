import { artFor } from '../art.js'
import Icon from './Icon.jsx'
import { categoryIcon } from '../icons.js'

// The spotlight. One game, big, with the animated red mesh behind it. Every
// reference game site opens with something at this scale.
export default function Hero({ game }) {
  const art = artFor(game.title, game.category)

  return (
    <section className="hero" style={art.style} data-pattern={art.pattern}>
      <span className="hero-art" aria-hidden="true" />
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

      <span className="hero-glyph" aria-hidden="true">
        {art.initials}
      </span>
    </section>
  )
}
