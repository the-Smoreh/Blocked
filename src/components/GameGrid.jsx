import GameCard from './GameCard.jsx'
import Icon from './Icon.jsx'

// The wall. Every seventh card is promoted to a wide tile so the grid has some
// rhythm instead of reading as one uniform sheet of squares.
const BIG_EVERY = 7

export default function GameGrid({ title, icon, tone, games, favorites, onFavorite, empty, bento }) {
  return (
    <section>
      <h2>
        {icon && (
          <span className="secicon" data-tone={tone}>
            <Icon name={icon} size={15} />
          </span>
        )}
        {title}
        <span className="rule" />
        <span className="count">{games.length}</span>
      </h2>

      {games.length === 0 ? (
        <p className="empty">{empty || 'Nothing here yet.'}</p>
      ) : (
        <div className="grid">
          {games.map((g, i) => (
            <GameCard
              key={g.slug}
              game={g}
              index={i}
              size={bento && i % BIG_EVERY === 0 ? 'lg' : 'sm'}
              isFavorite={favorites.has(g.slug)}
              onFavorite={onFavorite}
            />
          ))}
        </div>
      )}
    </section>
  )
}
