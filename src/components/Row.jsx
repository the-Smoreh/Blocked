import { useEffect, useRef, useState } from 'react'
import GameCard from './GameCard.jsx'
import Icon from './Icon.jsx'

// A horizontal shelf with paging arrows, the shape every big game site uses
// for "recently played" and "featured". Arrows hide when there is nothing
// further to scroll to, so they never sit there dead.
export default function Row({ title, icon, tone, games, favorites, onFavorite }) {
  const trackRef = useRef(null)
  const [edge, setEdge] = useState({ start: true, end: false })

  const measure = () => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 })
  }

  useEffect(() => {
    measure()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [games])

  const page = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' })
  }

  if (!games.length) return null

  return (
    <section className="shelf">
      <h2>
        {icon && (
          <span className="secicon" data-tone={tone}>
            <Icon name={icon} size={15} />
          </span>
        )}
        {title}
        <span className="rule" />
        <span className="arrows">
          <button className="arrow" disabled={edge.start} onClick={() => page(-1)} title="Scroll left">
            <Icon name="back" size={16} />
          </button>
          <button className="arrow" disabled={edge.end} onClick={() => page(1)} title="Scroll right">
            <Icon name="chevron" size={16} />
          </button>
        </span>
      </h2>

      <div className="track" ref={trackRef} onScroll={measure}>
        {games.map((g, i) => (
          <GameCard
            key={g.slug}
            game={g}
            index={i}
            isFavorite={favorites.has(g.slug)}
            onFavorite={onFavorite}
          />
        ))}
      </div>
    </section>
  )
}
