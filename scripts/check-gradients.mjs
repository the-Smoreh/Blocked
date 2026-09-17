// Checks that every background preset is readable in the mode it claims.
//
//   node scripts/check-gradients.mjs
//
// The point: a preset can look good as a 54px tile in the picker and still
// leave the page unreadable, because the text colour comes from the mode, not
// from the preset. Dark mode writes #f5f5f7 and light mode writes #121216, so
// a preset's `tone` is a promise about which of those it can carry.
//
// Every declared colour is checked, not an average. The gradient layers fade
// to transparent over the base, so the real background sits somewhere between
// the base and each stop. Checking the extremes is the conservative version:
// if the brightest stop in a dark preset still clears the bar against light
// text, everything mixed from it does too.
//
// Contrast is WCAG 2.1: linearise each channel, take the relative luminance,
// then (lighter + 0.05) / (darker + 0.05). 4.5:1 is the AA threshold for body
// text, which is what the page is mostly made of.

import { GRADIENTS, SLATES } from '../src/settings.js'

const TEXT = { dark: '#f5f5f7', light: '#121216' }
const MIN = 4.5

function channel(v) {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = parseInt(full, 16)
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  )
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Every hex in the css, plus whichever flat colours the preset carries.
// Gradients have `base`; the solids have `bg`, `bg2` and `panel` and no css
// at all. `transparent` holds no colour of its own so there is nothing in it
// to measure.
function coloursOf(preset) {
  const found = String(preset.css || '').match(/#[0-9a-fA-F]{3,8}/g) || []
  const flat = [preset.base, preset.bg, preset.bg2, preset.panel]
  return [...new Set([...found, ...flat].filter(Boolean))]
}

// What tone the colours actually suit, independent of what the preset claims.
// Whichever text colour the worst case colour carries better is the answer.
function suggestTone(colours) {
  const onDark = Math.min(...colours.map((c) => contrast(c, TEXT.dark)))
  const onLight = Math.min(...colours.map((c) => contrast(c, TEXT.light)))
  return { tone: onDark >= onLight ? 'dark' : 'light', onDark, onLight }
}

let failures = 0

function check(kind, entries) {
  console.log(`\n${kind}`)

  for (const [id, preset] of Object.entries(entries)) {
    const colours = coloursOf(preset)
    const text = TEXT[preset.tone]
    const worst = colours
      .map((c) => ({ c, ratio: contrast(c, text) }))
      .sort((a, b) => a.ratio - b.ratio)[0]

    const suggested = suggestTone(colours)
    const toneWrong = suggested.tone !== preset.tone
    const tooClose = worst.ratio < MIN
    const ok = !toneWrong && !tooClose

    if (!ok) failures += 1

    const line =
      `  ${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(12)} ${preset.tone.padEnd(6)}` +
      ` worst ${worst.ratio.toFixed(2)}:1 on ${worst.c}` +
      ` (${colours.length} colours)`

    console.log(line)
    if (toneWrong) {
      console.log(
        `       tone should be "${suggested.tone}": ` +
          `${suggested.onDark.toFixed(2)}:1 with light text, ` +
          `${suggested.onLight.toFixed(2)}:1 with dark text`,
      )
    }
    if (tooClose) {
      console.log(`       below ${MIN}:1 against ${text}, so body text on it is hard to read`)
    }
  }
}

check(`Gradients (${Object.keys(GRADIENTS).length})`, GRADIENTS)
check(`Solids (${Object.keys(SLATES).length})`, SLATES)

console.log(
  failures
    ? `\n${failures} preset${failures === 1 ? '' : 's'} need fixing`
    : '\nEvery preset is readable in the mode it claims',
)

process.exit(failures ? 1 : 0)
