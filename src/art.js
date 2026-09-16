// Generated cover art.
//
// Almost no game in the library has a usable image. The ones that do are
// hotlinked to image proxies and Google's thumbnail cache, which rot and are
// often blocked on school networks. So the art here is not a fallback, it is
// the default layer every card sits on. A real image, when it loads, just
// covers it up. When that image 404s there is nothing to swap in and no gap,
// because the art was already behind it.
//
// Everything is derived from the title, so a game's art is identical on every
// machine and every reload, and adding games never reshuffles the wall.

// FNV-1a, 32 bit. Small, fast, and spreads short strings like titles well.
export function hash32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// These are OFFSETS in degrees, not absolute hues. The stylesheet adds
// --art-base, which settings.js sets from the chosen accent, so switching
// accent retints all 450 cards at once.
//
// Offsets rather than a free hue because a free hue would give a rainbow of
// 450 unrelated colours. A narrow family keeps the grid reading as one set,
// and the variety comes from lightness, pattern and angle instead.
const HUE_OFFSETS = [-8, 2, 12, 24, 36, -26, -44, 8]

const PATTERNS = 6
const ANGLES = [25, 65, 115, 155, 205, 245, 295, 335]

// Words that should not supply an initial. "The Legend of Zelda" reads as LZ.
const SKIP = new Set(['the', 'of', 'and', 'a', 'an', 'to', 'in', 'for', 'vs'])

function initials(title) {
  const words = String(title)
    .split(/[\s:_/-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)

  const strong = words.filter((w) => !SKIP.has(w.toLowerCase()))
  const use = strong.length ? strong : words
  if (!use.length) return '?'

  // One big glyph for a single word reads as deliberate. Two words get two.
  if (use.length === 1) {
    const w = use[0]
    // A short all digit title is the name. "2048" must not become "20".
    if (/^\d+$/.test(w)) return w.length <= 4 ? w : w.slice(0, 2)
    if (/^\d/.test(w)) return w.slice(0, 2).toUpperCase()
    return w.slice(0, 1).toUpperCase()
  }
  return (use[0][0] + use[1][0]).toUpperCase()
}

export function artFor(title, category) {
  const h = hash32(String(title) + '|' + String(category || ''))

  // Separate bit ranges per decision, so two games that share a hue do not
  // also share a pattern and an angle.
  const anchor = HUE_OFFSETS[h % HUE_OFFSETS.length]
  const jitter = ((h >>> 3) % 21) - 10
  const hue = anchor + jitter

  // Second stop stays analogous, 24 to 56 degrees away, so gradients read as
  // one color moving rather than two colors fighting.
  const spread = 24 + ((h >>> 8) % 33)
  const dir = (h >>> 6) & 1 ? 1 : -1
  const hue2 = hue + dir * spread

  return {
    pattern: String((h >>> 13) % PATTERNS),
    initials: initials(title),
    style: {
      '--h': hue,
      '--h2': hue2,
      '--ang': ANGLES[(h >>> 17) % ANGLES.length] + 'deg',
      // Shifts the pattern so tiles do not line up across the grid.
      '--ox': ((h >>> 21) % 100) + '%',
      '--oy': ((h >>> 25) % 100) + '%',
    },
  }
}
