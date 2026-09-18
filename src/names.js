// Names and the colour each one gets.
//
// Kept out of chat.js on purpose. That module imports the Firebase sdk, which
// is bigger than the rest of the app put together and is only loaded when
// somebody opens the chat or the leaderboard. The account system needs these
// on every page, so they live here where importing them costs nothing.

export const MAX_NAME = 18

// Built from character codes, so the source holds no escapes and no raw bytes.
//
// Both obvious spellings went wrong in this repo. Written as escape
// sequences, the tool that wrote the file read them as its own escapes and
// put the actual NUL, 0x1F and 0x7F bytes into the regex. That still matched,
// but grep then called the file binary and it was one careless edit away from
// an unterminated regex. Character codes cannot be misread by anything.
const CONTROL = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  'g',
)

export function cleanName(raw) {
  return String(raw || '')
    .replace(CONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
}

export function cleanText(raw, max) {
  return String(raw || '')
    .replace(CONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

// 32 hues, walked by the golden angle rather than in order.
//
// Evenly spaced hues put neighbouring slots 11 degrees apart, so two people
// whose names happen to hash next to each other would be the same colour to
// look at. Stepping by 137.5 degrees means consecutive slots land on opposite
// sides of the wheel, so near miss hashes are still obviously different.
export const COLOUR_COUNT = 32

export const HUES = Array.from({ length: COLOUR_COUNT }, (_, i) =>
  Math.round((i * 137.508) % 360),
)

// Only the hue is stored. Lightness comes from the theme, see `--chat-l`.
//
// FNV-1a over the lowercased name, so the same person is the same colour in
// everyone's window and across reloads.
export function hueFor(name) {
  let h = 0x811c9dc5
  const s = cleanName(name).toLowerCase()
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return HUES[h % COLOUR_COUNT]
}

export function initialFor(name) {
  return cleanName(name).charAt(0).toUpperCase() || '?'
}
