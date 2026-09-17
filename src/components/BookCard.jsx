import { artFor } from '../art.js'
import { badgeFor } from '../lib.js'
import { useCover } from '../cover.js'
import Icon from './Icon.jsx'
import { categoryIcon, categoryTone } from '../icons.js'

export default function BookCard({ book, isFavorite, onFavorite, size = 'sm', index = 0 }) {
  const art = artFor(book.title, book.category)
  const badge = badgeFor(book)
  // Own url, then a resolved Lumin token, then a cover borrowed from another
  // library, all behind an observer so only cards near the viewport do any of
  // it. See src/cover.js.
  const { ref, src, onError } = useCover(book)

  return (
    <a
      ref={ref}
      className={`card card-${size}`}
      href={`#/book/${book.slug}`}
      title={book.title}
      aria-label={book.title}
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
        {src && <img src={src} alt="" loading="lazy" onError={onError} />}

        <span className="shine" aria-hidden="true" />

        <span className="playwrap" aria-hidden="true">
          <span className="playbtn">
            <Icon name="play" size={size === 'lg' ? 26 : 20} filled />
          </span>
        </span>

        {badge && <span className={`badge badge-${badge}`}>NEW</span>}

        <button
          className={isFavorite ? 'fav on' : 'fav'}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.preventDefault()
            onFavorite(book.slug)
          }}
        >
          <Icon name="star" size={15} filled={isFavorite} />
        </button>
      </div>

      <div className="meta">
        <h3>{book.title}</h3>
        <span className="tag" data-tone={categoryTone(book.category)}>
          <Icon name={categoryIcon(book.category)} size={13} />
          {book.category}
        </span>
      </div>
    </a>
  )
}
