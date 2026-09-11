import GameCard from './GameCard.jsx'

export default function GameGrid({ title, games, favorites, onFavorite, empty }) {
  return (
    <section>
      <h2>{title}</h2>
      {games.length === 0 ? (
        <p className="empty">{empty || 'Nothing here yet.'}</p>
      ) : (
        <div className="grid">
          {games.map((g) => (
            <GameCard
              key={g.slug}
              game={g}
              isFavorite={favorites.has(g.slug)}
              onFavorite={onFavorite}
            />
          ))}
        </div>
      )}
    </section>
  )
}
