import { useEffect, useRef, useState } from 'react'
import BookCard from './BookCard.jsx'
import Icon from './Icon.jsx'

// The wall. Every seventh card is promoted to a wide tile so the grid has some
// rhythm instead of reading as one uniform sheet of squares.
const BIG_EVERY = 7

// The wall is built up in batches rather than all at once.
//
// This is the single biggest thing that made the site slow. A library is 900
// to 1200 books and each card is 18 elements, so mounting the lot put about
// 17,000 nodes and 824 img tags in the document at the same time. Measured on
// the live site before this change, scrolling ran at a median 33ms per frame
// with 13 frames out of 59 over 50ms, on a fast machine. Layout and paint at
// that size are simply more work than a frame has room for, and a low end
// laptop has far less of it.
//
// 120 is enough to fill a large screen twice over, so nobody sees the seam.
const FIRST = 120
const STEP = 120

export default function BookGrid({
  title,
  icon,
  tone,
  books,
  favorites,
  onFavorite,
  empty,
  bento,
}) {
  // No observer support means render everything, which is the old behaviour:
  // slow, but never missing books. Decided at init rather than in an effect.
  const [shown, setShown] = useState(() =>
    typeof IntersectionObserver === 'function' ? FIRST : Number.MAX_SAFE_INTEGER,
  )
  const sentinel = useRef(null)

  // Searching or changing category replaces the list, so the count has to
  // start over or the first 120 of the old list would bound the new one.
  // Adjusted during render: an effect would paint one frame of the wrong
  // slice first.
  const identity = `${title}|${books.length}|${books[0]?.slug ?? ''}`
  const [seen, setSeen] = useState(identity)
  if (seen !== identity) {
    setSeen(identity)
    setShown(typeof IntersectionObserver === 'function' ? FIRST : Number.MAX_SAFE_INTEGER)
  }

  const more = shown < books.length

  useEffect(() => {
    if (!more) return
    const el = sentinel.current
    if (!el) return

    // 600px ahead, so the next batch is mounted before it is scrolled into.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown((s) => Math.min(s + STEP, books.length))
        }
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [more, books.length])

  const visible = more ? books.slice(0, shown) : books

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
        <span className="count">{books.length}</span>
      </h2>

      {books.length === 0 ? (
        <p className="empty">{empty || 'Nothing here yet.'}</p>
      ) : (
        <>
          <div className="grid">
            {visible.map((g, i) => (
              <BookCard
                key={g.slug}
                book={g}
                index={i}
                size={bento && i % BIG_EVERY === 0 ? 'lg' : 'sm'}
                isFavorite={favorites.has(g.slug)}
                onFavorite={onFavorite}
              />
            ))}
          </div>

          {/* What the observer watches. Deliberately after the grid and
              outside it, so it is not a grid item and cannot disturb the
              bento layout. */}
          {more && <div className="grid-more" ref={sentinel} aria-hidden="true" />}
        </>
      )}
    </section>
  )
}
