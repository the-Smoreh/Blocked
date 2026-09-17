import { useEffect, useRef, useState } from 'react'
import { resolveImage } from './lumin.js'
import { borrowCover } from './borrow.js'

// Works out which image a game should actually show, in one place.
//
// There are four ways a cover can arrive and they have to be tried in order,
// which is why this is a hook rather than a line in each component:
//
//   1. the library shipped a url
//   2. Lumin shipped a token, which its SDK has to turn into a url
//   3. neither, or both failed, so borrow one from another library
//   4. nothing, and the generated art stays visible underneath
//
// The grid waits until a card is near the viewport before doing any of it.
// A thousand cards resolving a thousand Lumin tokens and a thousand donor
// lookups for tiles nobody has scrolled to is the whole reason step 2 exists
// behind an observer. The hero passes `eager` because it is one element and
// always on screen.
//
// `''` means tried and failed, `null` means not tried yet. The difference
// matters: only a failure should fall through to the next source, and without
// the distinction a card would either borrow before its own cover had a
// chance or never borrow at all.

const FAILED = ''

export function useCover(game, { eager = false, borrow = true } = {}) {
  const ref = useRef(null)
  // No observer support means resolve everything immediately rather than
  // never, so that decision belongs in the initial value, not an effect.
  const [near, setNear] = useState(
    () => eager || typeof IntersectionObserver !== 'function',
  )
  const [ownBroken, setOwnBroken] = useState(false)
  const [tokenSrc, setTokenSrc] = useState(null)
  const [borrowed, setBorrowed] = useState(null)

  const token = game?.imageToken
  const title = game?.title
  const shipped = game?.game_image_icon || null

  // The grid reuses a card for a different game as filters change, so the
  // resolution has to start over when that happens. Adjusted during render
  // rather than in an effect: an effect would paint the previous game's cover
  // for a frame first, and React re-runs this pass before committing anything
  // to the DOM.
  const identity = `${title}|${token}|${shipped}`
  const [seen, setSeen] = useState(identity)
  if (seen !== identity) {
    setSeen(identity)
    setOwnBroken(false)
    setTokenSrc(null)
    setBorrowed(null)
  }

  useEffect(() => {
    if (near) return
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        setNear(true)
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near])

  useEffect(() => {
    if (!near || !token || tokenSrc !== null) return
    let cancelled = false
    resolveImage(token).then((url) => !cancelled && setTokenSrc(url || FAILED))
    return () => {
      cancelled = true
    }
  }, [near, token, tokenSrc])

  const own = shipped && !ownBroken ? shipped : null
  const fromToken = tokenSrc || null
  // Borrow only once this game's own sources are exhausted: no url of its
  // own, or one that failed, and either no token or a token that failed.
  const exhausted = !own && (!token || tokenSrc === FAILED)

  useEffect(() => {
    if (!near || !borrow || !exhausted || borrowed !== null || !title) return
    let cancelled = false
    borrowCover(title).then((url) => !cancelled && setBorrowed(url || FAILED))
    return () => {
      cancelled = true
    }
  }, [near, borrow, exhausted, borrowed, title])

  const src = own || fromToken || borrowed || null

  return {
    ref,
    src,
    // True when the image on screen came from another library, so the card
    // can say so rather than passing someone else's art off as its own.
    isBorrowed: Boolean(!own && !fromToken && borrowed),
    onError: () => {
      if (own) setOwnBroken(true)
      else if (borrowed) setBorrowed(FAILED)
      else if (fromToken) setTokenSrc(FAILED)
    },
  }
}
