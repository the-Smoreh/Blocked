import { useEffect, useRef, useState } from 'react'

// A full screen intro that sits in front of the entire site and fades away as
// you scroll. It does not move: only its opacity changes, so the site is
// revealed through it rather than from under it. A click also lets you in.
// It appears on every load and is not remembered, so entering is always a
// deliberate action.
//
// It wraps the app rather than living inside it, so it covers every route
// including the player, and does not have to be threaded through App's
// several early returns.
//
// Scroll is driven by accumulated input rather than real document scroll.
// A spacer plus native scroll would need the spacer removed at the end, which
// jumps the page, and it fights the player view's own locked scrolling. This
// way the gate owns its own progress and the document is never touched.

const KEYS = new Set(['ArrowDown', 'PageDown', ' ', 'Enter', 'Escape'])

export default function Gate({ children }) {
  const [entered, setEntered] = useState(false)
  // Kept in a ref as well, because the wheel handler is registered once and
  // must not close over a stale value.
  const progress = useRef(0)
  const [shown, setShown] = useState(0)
  const layer = useRef(null)

  useEffect(() => {
    if (entered) return

    // The distance that counts as "one screen" of scrolling. A little more
    // than the viewport, so a single flick does not blow straight through.
    const travel = () => Math.max(320, window.innerHeight * 1.15)

    const advance = (amount) => {
      const next = Math.min(1, Math.max(0, progress.current + amount / travel()))
      progress.current = next
      setShown(next)
      if (next >= 1) setEntered(true)
    }

    const onWheel = (e) => {
      e.preventDefault()
      advance(e.deltaY)
    }

    let lastTouch = null
    const onTouchStart = (e) => {
      lastTouch = e.touches[0]?.clientY ?? null
    }
    const onTouchMove = (e) => {
      if (lastTouch === null) return
      const y = e.touches[0]?.clientY ?? lastTouch
      e.preventDefault()
      advance(lastTouch - y)
      lastTouch = y
    }

    // Keyboard and a plain click are the way through for anyone who cannot
    // scroll, or who has reduced motion turned on. The gate still has to be
    // dismissed on purpose, it just does not demand a wheel.
    const onKey = (e) => {
      if (!KEYS.has(e.key)) return
      e.preventDefault()
      setEntered(true)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [entered])

  // Hold the site still underneath. The class is removed on entry, and also
  // if this unmounts mid gate, so the page can never be left unscrollable.
  useEffect(() => {
    document.body.classList.toggle('gated', !entered)
    return () => document.body.classList.remove('gated')
  }, [entered])

  return (
    <>
      {children}

      {!entered && (
        <div
          className="gate"
          ref={layer}
          style={{ '--p': shown }}
          onClick={() => setEntered(true)}
          role="button"
          tabIndex={0}
          aria-label="Scroll or press Enter to continue to Blocked"
        >
          <span className="gate-mesh" aria-hidden="true" />

          <div className="gate-inner">
            <span className="gate-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <h1>Blocked</h1>
          </div>

          {/* No label. The bar is the only cue, and it fills as you scroll. */}
          <div className="gate-cue" aria-hidden="true">
            <span className="gate-track">
              <span className="gate-fill" />
            </span>
          </div>
        </div>
      )}
    </>
  )
}
