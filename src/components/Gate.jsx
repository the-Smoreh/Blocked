import { useEffect, useRef, useState } from 'react'

// A full screen intro in front of the whole site, shown on every load and
// never remembered, so entering is always a deliberate action.
//
// It wraps the app rather than living inside it, so it covers every route
// including the player, and does not have to be threaded through App's
// several early returns.
//
// The handoff is not a plain fade. Scrolling drives a progress value that
// pushes the intro away from the viewer while it blurs out, and pulls the site
// up from behind it at the same time, so the two are one movement. Past a
// commit point it finishes on its own, because requiring someone to scroll
// exactly to the end felt like work.
//
// Progress comes from accumulated wheel and touch input rather than real
// document scroll. A spacer plus native scroll would have to be removed at the
// end, which jumps the page, and it fights the player view's own locked
// scrolling.

const KEYS = new Set(['ArrowDown', 'PageDown', ' ', 'Enter', 'Escape'])

// Past this much scrolling the rest plays out by itself.
const COMMIT_AT = 0.42
// Has to match the transition in .gate.committing, or the layer is torn out
// mid animation.
const COMMIT_MS = 760

// Five drifting blobs. Used behind the intro and behind the site, so the two
// share the same moving red, which is what makes the handoff read as one
// surface rather than two screens.
//
// Five rather than three because the first three all sat on the same diagonal,
// top left to bottom right, which left the top right and bottom left corners
// permanently black. Four and five cover those.
function Fx() {
  return (
    <span className="fx" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

export default function Gate({ children }) {
  const [entered, setEntered] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [shown, setShown] = useState(0)
  // Also held in a ref, because the wheel handler is registered once and must
  // not close over a stale value.
  const progress = useRef(0)
  const committed = useRef(false)

  useEffect(() => {
    if (entered) return

    const commit = () => {
      if (committed.current) return
      committed.current = true
      progress.current = 1
      setShown(1)
      setCommitting(true)
      window.setTimeout(() => setEntered(true), COMMIT_MS)
    }

    // The distance that counts as one screen of scrolling. A little more than
    // the viewport, so a single flick does not blow straight through.
    const travel = () => Math.max(320, window.innerHeight * 1.15)

    const advance = (amount) => {
      if (committed.current) return
      const next = Math.min(1, Math.max(0, progress.current + amount / travel()))
      progress.current = next
      setShown(next)
      if (next >= COMMIT_AT) commit()
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

    // A key or a click runs the same commit, so it plays the transition rather
    // than snapping. This is also the way through for anyone who cannot
    // scroll, or who has reduced motion turned on.
    const onKey = (e) => {
      if (!KEYS.has(e.key)) return
      e.preventDefault()
      commit()
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

  // Hold the site still underneath. Removed on entry, and on unmount too, so
  // the page can never be left unscrollable.
  useEffect(() => {
    document.body.classList.toggle('gated', !entered)
    return () => document.body.classList.remove('gated')
  }, [entered])

  return (
    <>
      {/* The site's own moving background, always present. */}
      <div className="bgfx" aria-hidden="true">
        <Fx />
      </div>

      {/* The same blobs again, over the wall instead of behind it. On a dense
          grid the layer behind is almost entirely covered by cards, so the
          movement was invisible where it mattered. This sits above the cards
          and below the header on soft-light, which tints the wall without
          washing out the game art. */}
      <div className="bgfx-over" aria-hidden="true">
        <Fx />
      </div>

      {/* While the gate is up this scales and dims, so the site arrives
          rather than simply being uncovered. The inline style and the class
          are both dropped on entry, because a transform or a filter here
          would otherwise become the containing block for the sticky header
          and the settings sheet. */}
      <div
        className={entered ? 'under' : committing ? 'under gating committing' : 'under gating'}
        style={entered ? undefined : { '--p': shown }}
      >
        {children}
      </div>

      {!entered && (
        <div
          className={committing ? 'under-scrim committing' : 'under-scrim'}
          style={{ '--p': shown }}
          aria-hidden="true"
        />
      )}

      {!entered && (
        <div
          className={committing ? 'gate committing' : 'gate'}
          style={{ '--p': shown }}
          onClick={() => {
            if (!committed.current) {
              committed.current = true
              progress.current = 1
              setShown(1)
              setCommitting(true)
              window.setTimeout(() => setEntered(true), COMMIT_MS)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Scroll or press Enter to continue to Blocked"
        >
          <Fx />

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
