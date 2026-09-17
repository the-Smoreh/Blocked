import { useCallback, useEffect, useMemo, useState } from 'react'

// Every user adjustable option lives here in one object, persisted whole.
// Adding a key means adding it to DEFAULTS and to the Settings panel, and
// nothing else, because the reducer merges over DEFAULTS on read. That also
// means an old saved blob missing a new key still loads cleanly.

const KEY = 'blocked:settings'

// Every selectable library. `file` is a path under public/. Each community
// source keeps its own name and a link to its repo, shown in the app whenever
// that library is active, so the people who assembled it get the credit and
// the traffic. Nothing is mirrored here, every url points at their host.
//
// Counts are the live-verified totals at the time they were built, see
// scripts/build-libraries.mjs and scripts/checklinks.mjs.
export const LIBRARIES = {
  lumin: {
    label: 'Lumin',
    note: 'Third party catalogue, loaded from a CDN',
    kind: 'embed',
    // Read from its own getGames total rather than advertised: 1169 across
    // 234 pages.
    count: 1169,
  },
  selenite: {
    label: 'Selenite',
    // The label is the library, the author is who serves it, so the footer
    // reads "from Selenite by music.lyrica24.top" rather than repeating the
    // same word twice.
    author: 'music.lyrica24.top',
    note: '914 games with their own cover art',
    credit: 'https://music.lyrica24.top/',
    file: 'libraries/selenite.json',
    count: 914,
  },
  goblin: {
    label: 'Goblin Kingdom',
    author: 'goblinkingdev',
    credit: 'https://github.com/goblinkingdev/unblocked-games',
    file: 'libraries/goblin.json',
    count: 633,
  },
  nova: {
    label: 'Nova Arcade',
    author: 'Beefalo1234',
    credit: 'https://github.com/Beefalo1234/nova-arcade',
    file: 'libraries/nova.json',
    count: 151,
  },
  hell: {
    label: 'Hell',
    author: 'D3ch',
    credit: 'https://github.com/D3ch/hell',
    file: 'libraries/hell.json',
    count: 207,
  },
  amplify: {
    label: 'Amplify',
    author: 'joeyc1pro',
    credit: 'https://github.com/joeyc1pro/amplify-home-xyz',
    file: 'libraries/amplify.json',
    count: 80,
  },
  alexx: {
    label: 'Alexx743',
    author: 'Alexx743',
    credit: 'https://github.com/Alexx743/Alexx743-games',
    file: 'libraries/alexx.json',
    count: 71,
  },
  gams: {
    label: 'Gams Offline',
    author: 'Gams-Offline',
    credit: 'https://github.com/Gams-Offline/Gams',
    file: 'libraries/gams.json',
    count: 59,
  },
  p0xx: {
    label: 'p0xx',
    author: 'p0xx',
    credit: 'https://github.com/p0xx/p0xx.github.io',
    file: 'libraries/p0xx.json',
    count: 51,
  },
  astro: {
    label: 'Astro v2',
    author: 'MNblocker',
    credit: 'https://github.com/MNblocker/Astro-v2',
    file: 'libraries/astro.json',
    count: 24,
  },
}

export function libraryFile(id) {
  return LIBRARIES[id]?.file || null
}

export const DEFAULTS = {
  // Selenite is the default: 914 of 915 urls verified live and frameable, and
  // it is the only library that ships a cover for nearly every game, 804 of
  // them. Goblin Kingdom is bigger on titles alone but has no art of its own.
  //
  // Lumin was the default until its behaviour was pinned down: init resolves
  // but renders nothing, every other method on its Proxy queues forever
  // because its worker reports "domain fetch failed", and getGames() never
  // settles. A default that shows an error to every visitor is a defect, so
  // it is still selectable, just not first.
  library: 'selenite',

  theme: 'dark',
  accent: 'crimson',

  // Gradient by default, and the default gradient is the animated red on
  // black one. The blobs that do the moving live in Gate.jsx, and the
  // gradient here is the still base they drift over.
  bgKind: 'gradient', // slate | gradient | image
  bgSlate: 'ink',
  bgGradient: 'slosh',
  bgAnimated: true,
  bgImage: null, // data url, written by the uploader below
  bgDim: 55, // 0-90, converted to a 0..0.9 scrim alpha over a background image

  // Lets a library fill its missing covers from the others. Selenite is 105
  // short and Goblin Kingdom 591, while Lumin has art for all 1169 of its
  // games, so this is what puts real covers on cards that would otherwise
  // only ever show generated art. See src/borrow.js.
  borrowCovers: true,

  // The frame counter in the player bar. On by default, but it runs a
  // requestAnimationFrame loop for as long as a game is open, so it is worth
  // being able to stop.
  showFps: true,

  showTitles: true,
  cardShape: 'square', // square | portrait | landscape
  colorIcons: true,
  idleShimmer: true,
}

// Accent families. Each is a pair, so anything that wants a gradient can use
// both stops and anything flat uses the first.
// `hue` is the centre of the generated card art family for that accent, so
// picking an accent retints the whole wall. See src/art.js.
export const ACCENTS = {
  crimson: { label: 'Crimson', a: '#e5232b', b: '#ff3b43', deep: '#8f0f15', hue: 358 },
  ember: { label: 'Ember', a: '#f2610c', b: '#ffa02b', deep: '#8a3105', hue: 26 },
  magenta: { label: 'Magenta', a: '#d81b7a', b: '#ff4fa3', deep: '#7d0c45', hue: 330 },
  violet: { label: 'Violet', a: '#7b4dff', b: '#a98cff', deep: '#3d1f99', hue: 254 },
  toxic: { label: 'Toxic', a: '#48c11a', b: '#8ef05a', deep: '#215c0c', hue: 100 },
  ice: { label: 'Ice', a: '#1b9fd8', b: '#5fd0ff', deep: '#0b5378', hue: 197 },
}

// `tone` is which mode the option belongs to, and it is not decoration.
// Picking a light background while in dark mode used to leave near white
// text on a near white page, and a dark one in light mode did the reverse:
// measured at rgb(8,8,10) behind rgb(18,18,22). The sheet reads this and
// switches mode with the pick, so every combination stays readable.
export const SLATES = {
  ink: { label: 'Ink', tone: 'dark', bg: '#08080a', bg2: '#0d0d10', panel: '#131317' },
  graphite: { label: 'Graphite', tone: 'dark', bg: '#121215', bg2: '#17171c', panel: '#1d1d23' },
  navy: { label: 'Navy', tone: 'dark', bg: '#070b14', bg2: '#0b111d', panel: '#101827' },
  plum: { label: 'Plum', tone: 'dark', bg: '#0c0710', bg2: '#120b17', panel: '#1a1020' },
  moss: { label: 'Moss', tone: 'dark', bg: '#070c09', bg2: '#0b120d', panel: '#101a13' },
  bone: { label: 'Bone', tone: 'light', bg: '#fbfbfc', bg2: '#ffffff', panel: '#ffffff' },
}

// `css` holds gradient layers only, and `base` is the flat colour behind
// them. `tone` is which mode the option belongs to.
//
// They have to be separate. Three of these used to end in a bare colour, as
// in "radial-gradient(...), radial-gradient(...), #08080a", which is valid in
// the `background` shorthand but **not** in `background-image`: one invalid
// layer throws the whole declaration out, so the computed value was `none`.
// Slosh, Coals and Slosh light therefore never drew their gradient at all.
// Slosh is the default, so the site's own base layer had been invisible the
// entire time and only the drifting blobs were showing over a flat body
// colour. Verified in the browser: the same string is rejected with the
// trailing colour and accepted without it.
//
// Every colour here is checked by `node scripts/check-gradients.mjs`, which
// measures each one against the text colour of its own mode. Nothing in a
// dark preset may fall below 4.5:1 against #f5f5f7, and nothing in a light
// preset below 4.5:1 against #121216. That is what stops a preset looking
// good in the picker and unreadable on the page, and it is why the dark ones
// stay deep even when they are strongly coloured.
export const GRADIENTS = {
  // --------------------------------------------------- dark, neutral

  // The default. Deliberately dark, because five moving blobs are drawn on
  // top of it and a bright base would leave nowhere for them to show.
  slosh: {
    tone: 'dark',
    label: 'Slosh',
    // A stop in all four corners. The first version only had top left and
    // bottom right, which put the still base on the same diagonal as the
    // moving blobs and left the other two corners permanently black.
    css:
      'radial-gradient(85% 65% at 12% 0%, #180608 0%, transparent 62%), ' +
      'radial-gradient(80% 60% at 88% 4%, #14060b 0%, transparent 62%), ' +
      'radial-gradient(85% 65% at 90% 100%, #13050a 0%, transparent 62%), ' +
      'radial-gradient(80% 60% at 8% 96%, #160708 0%, transparent 62%)',
    base: '#08080a',
  },
  emberfade: {
    tone: 'dark',
    label: 'Ember fade',
    css: 'linear-gradient(160deg, #1a0708 0%, #08080a 55%)',
    base: '#08080a',
  },
  duskrise: {
    tone: 'dark',
    label: 'Dusk rise',
    css: 'linear-gradient(200deg, #1b0d24 0%, #08080a 60%)',
    base: '#08080a',
  },
  deepsea: {
    tone: 'dark',
    label: 'Deep sea',
    css: 'linear-gradient(180deg, #07141f 0%, #08080a 62%)',
    base: '#08080a',
  },
  nightgrid: {
    tone: 'dark',
    label: 'Night grid',
    css: 'radial-gradient(120% 80% at 50% -10%, #1a1020 0%, #08080a 60%)',
    base: '#08080a',
  },
  coals: {
    tone: 'dark',
    label: 'Coals',
    css:
      'radial-gradient(90% 60% at 15% 0%, #2a0b0d 0%, transparent 60%), ' +
      'radial-gradient(80% 60% at 85% 10%, #1a0a1e 0%, transparent 62%)',
    base: '#08080a',
  },

  // --------------------------------------------------- dark, coloured

  aurora: {
    fx: ['#0f7a6a', '#0a4a55', '#18b39a'],
    tone: 'dark',
    label: 'Aurora',
    css:
      'radial-gradient(85% 65% at 10% 0%, #03302a 0%, transparent 60%), ' +
      'radial-gradient(80% 60% at 92% 8%, #06283b 0%, transparent 62%), ' +
      'radial-gradient(85% 65% at 88% 100%, #0b1c3a 0%, transparent 62%), ' +
      'radial-gradient(80% 60% at 6% 94%, #042b25 0%, transparent 60%)',
    base: '#05100f',
  },
  nebula: {
    fx: ['#7a2ecc', '#4a1080', '#c04ad8'],
    tone: 'dark',
    label: 'Nebula',
    css:
      'radial-gradient(90% 70% at 14% 4%, #24063f 0%, transparent 62%), ' +
      'radial-gradient(85% 65% at 90% 10%, #3a0a44 0%, transparent 60%), ' +
      'radial-gradient(85% 65% at 80% 98%, #120a3c 0%, transparent 62%)',
    base: '#0a0614',
  },
  sunsetcity: {
    fx: ['#c93a55', '#7a2a12', '#e0703a'],
    tone: 'dark',
    label: 'Sunset city',
    css:
      'radial-gradient(90% 60% at 8% 0%, #3b0f1c 0%, transparent 60%), ' +
      'radial-gradient(85% 60% at 96% 6%, #3d1a06 0%, transparent 60%), ' +
      'radial-gradient(90% 70% at 70% 100%, #1e0730 0%, transparent 62%)',
    base: '#0c0609',
  },
  magma: {
    fx: ['#d83a12', '#8a1f06', '#ff7a33'],
    tone: 'dark',
    label: 'Magma',
    css:
      'radial-gradient(95% 65% at 50% 106%, #4a1206 0%, transparent 58%), ' +
      'radial-gradient(80% 60% at 12% 4%, #2c0a04 0%, transparent 60%)',
    base: '#0c0504',
  },
  cyber: {
    fx: ['#12b0c9', '#0a5566', '#d040c0'],
    tone: 'dark',
    label: 'Cyber',
    css:
      'radial-gradient(85% 65% at 6% 4%, #032c3a 0%, transparent 60%), ' +
      'radial-gradient(85% 65% at 96% 96%, #33063a 0%, transparent 60%)',
    base: '#05080f',
  },
  wine: {
    fx: ['#a01048', '#5a0a2a', '#d0407a'],
    tone: 'dark',
    label: 'Wine',
    css:
      'radial-gradient(90% 70% at 20% 0%, #3a0820 0%, transparent 62%), ' +
      'radial-gradient(85% 65% at 86% 92%, #24062a 0%, transparent 62%)',
    base: '#0b040b',
  },
  pine: {
    fx: ['#12805a', '#0a4a30', '#2ab07a'],
    tone: 'dark',
    label: 'Pine',
    css:
      'radial-gradient(90% 70% at 16% 6%, #042b1c 0%, transparent 62%), ' +
      'radial-gradient(85% 60% at 90% 96%, #062218 0%, transparent 60%)',
    base: '#050d09',
  },
  royal: {
    fx: ['#2a44c0', '#141f70', '#5a72e0'],
    tone: 'dark',
    label: 'Royal',
    css:
      'radial-gradient(95% 70% at 50% -8%, #101a52 0%, transparent 60%), ' +
      'radial-gradient(80% 60% at 10% 98%, #1b1046 0%, transparent 62%)',
    base: '#07091c',
  },
  peacock: {
    fx: ['#0d8a9c', '#0a4a70', '#20b0c0'],
    tone: 'dark',
    label: 'Peacock',
    css:
      'radial-gradient(90% 70% at 88% 4%, #033440 0%, transparent 62%), ' +
      'radial-gradient(85% 65% at 8% 92%, #062246 0%, transparent 62%)',
    base: '#041016',
  },
  copper: {
    fx: ['#b06a1a', '#6a3a0a', '#e0962a'],
    tone: 'dark',
    label: 'Copper',
    css:
      'radial-gradient(90% 65% at 14% 0%, #3a1e07 0%, transparent 60%), ' +
      'radial-gradient(85% 60% at 92% 96%, #2a1206 0%, transparent 60%)',
    base: '#0c0805',
  },
  ultraviolet: {
    fx: ['#6a2ae0', '#2a1080', '#9a5aff'],
    tone: 'dark',
    label: 'Ultraviolet',
    css:
      'radial-gradient(100% 75% at 50% 104%, #2a0f66 0%, transparent 58%), ' +
      'radial-gradient(80% 60% at 14% 2%, #18083e 0%, transparent 62%)',
    base: '#08051a',
  },
  fern: {
    fx: ['#6a8a1a', '#3a4a0a', '#9ab02a'],
    tone: 'dark',
    label: 'Fern',
    css:
      'radial-gradient(90% 70% at 50% 0%, #1d2a08 0%, transparent 62%), ' +
      'radial-gradient(85% 60% at 90% 100%, #10200d 0%, transparent 60%)',
    base: '#080c06',
  },

  // --------------------------------------------------- light, neutral

  // The light counterpart to slosh. Near white, with faint warm corners for
  // the blobs to move over. A dark base here would fight light mode's text.
  sloshlight: {
    tone: 'light',
    label: 'Slosh light',
    css:
      'radial-gradient(95% 75% at 12% 0%, #ffeceb 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 88% 4%, #fdebf1 0%, transparent 62%), ' +
      'radial-gradient(95% 75% at 90% 100%, #ffe9e6 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 8% 96%, #fdecea 0%, transparent 62%)',
    base: '#fbfbfc',
  },
  paper: {
    tone: 'light',
    label: 'Paper',
    css: 'linear-gradient(170deg, #ffffff 0%, #f1f1f4 100%)',
    base: '#f1f1f4',
  },

  // --------------------------------------------------- light, coloured

  peach: {
    fx: ['#f08a4a', '#d0603a', '#ffb07a'],
    tone: 'light',
    label: 'Peach',
    css:
      'radial-gradient(95% 75% at 10% 0%, #ffe3cf 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 92% 96%, #ffd8e2 0%, transparent 62%)',
    base: '#fff6f0',
  },
  sorbet: {
    fx: ['#f06aa0', '#e0a03a', '#8a86f0'],
    tone: 'light',
    label: 'Sorbet',
    css:
      'radial-gradient(95% 70% at 6% 4%, #ffdfee 0%, transparent 60%), ' +
      'radial-gradient(90% 70% at 96% 10%, #fff0cf 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 70% 100%, #e6e4ff 0%, transparent 62%)',
    base: '#fff8f4',
  },
  sky: {
    fx: ['#3a8ad0', '#2a6ab0', '#6ab0f0'],
    tone: 'light',
    label: 'Sky',
    css:
      'radial-gradient(100% 75% at 50% -8%, #d6ebff 0%, transparent 60%), ' +
      'radial-gradient(85% 65% at 10% 98%, #e4f2ff 0%, transparent 62%)',
    base: '#f4faff',
  },
  mint: {
    fx: ['#3aa070', '#2a8055', '#6ac090'],
    tone: 'light',
    label: 'Mint',
    css:
      'radial-gradient(95% 75% at 14% 0%, #d4f2e2 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 90% 96%, #e2f7ec 0%, transparent 62%)',
    base: '#f3fbf7',
  },
  lilac: {
    fx: ['#8a6ad0', '#6a4ab0', '#b096f0'],
    tone: 'light',
    label: 'Lilac',
    css:
      'radial-gradient(95% 75% at 12% 2%, #e7dcff 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 92% 98%, #f3e6ff 0%, transparent 62%)',
    base: '#f8f5ff',
  },
  sand: {
    fx: ['#c09a4a', '#a07a3a', '#e0c070'],
    tone: 'light',
    label: 'Sand',
    css:
      'radial-gradient(95% 75% at 50% 0%, #f5e8cf 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 90% 100%, #fbf1dd 0%, transparent 62%)',
    base: '#fbf7ef',
  },
  seafoam: {
    fx: ['#3aa0a0', '#2a8080', '#6ac0c0'],
    tone: 'light',
    label: 'Seafoam',
    css:
      'radial-gradient(95% 75% at 8% 4%, #d3f0ef 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 94% 94%, #dff2ff 0%, transparent 62%)',
    base: '#f2fbfa',
  },
  blossom: {
    fx: ['#f06a90', '#d04a70', '#ffa0b8'],
    tone: 'light',
    label: 'Blossom',
    css:
      'radial-gradient(95% 75% at 16% 0%, #ffdde9 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 88% 96%, #ffe9f1 0%, transparent 62%)',
    base: '#fff7fa',
  },
  butter: {
    fx: ['#d0a83a', '#b0882a', '#f0d06a'],
    tone: 'light',
    label: 'Butter',
    css:
      'radial-gradient(95% 75% at 50% -6%, #fbefc4 0%, transparent 60%), ' +
      'radial-gradient(85% 65% at 12% 98%, #fdf6dd 0%, transparent 62%)',
    base: '#fffcf0',
  },
  dawn: {
    fx: ['#e06a90', '#6a8ad0', '#f0a0c0'],
    tone: 'light',
    label: 'Dawn',
    css:
      'radial-gradient(95% 70% at 6% 0%, #ffdfe8 0%, transparent 60%), ' +
      'radial-gradient(90% 70% at 96% 8%, #e0e8ff 0%, transparent 62%), ' +
      'radial-gradient(90% 70% at 60% 100%, #e6f4ff 0%, transparent 62%)',
    base: '#f8f6fb',
  },
}

// Mode and background have to agree or the site is unreadable, so switching
// mode moves a mismatched background to its counterpart.
//
// One copy of that rule, used by the settings sheet and by the header
// toggle. It lived in the sheet, which meant the only way to change mode was
// to open the sheet and find the Look tab, and a second copy would have
// drifted from this one the way the categorizer's did.
export function pairTheme(settings, theme) {
  const patch = { theme }

  if (settings.bgKind === 'slate' && SLATES[settings.bgSlate]?.tone !== theme) {
    patch.bgSlate = theme === 'light' ? 'bone' : 'ink'
  }
  if (settings.bgKind === 'gradient' && GRADIENTS[settings.bgGradient]?.tone !== theme) {
    patch.bgGradient = theme === 'light' ? 'sloshlight' : 'slosh'
  }

  return patch
}

// An escape hatch that does not depend on the interface working.
//
// `?theme=dark` or `?theme=light` in the address bar wins over whatever is
// saved, and is then saved itself. A query string rather than a hash param,
// because the hash is the router. Every option is stored, so a saved state
// that somehow leaves the site unusable would otherwise only be reachable
// through the very panel that is hard to read.
function forcedTheme() {
  try {
    const t = new URLSearchParams(location.search).get('theme')
    return t === 'dark' || t === 'light' ? t : null
  } catch {
    return null
  }
}

function read() {
  const forced = forcedTheme()

  const saved = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY))
      if (raw && typeof raw === 'object') return { ...DEFAULTS, ...raw }

      // Theme used to live under its own key, before settings existed. Carry
      // a saved light choice across rather than resetting it to dark.
      const legacy = localStorage.getItem('blocked:theme')
      return { ...DEFAULTS, ...(legacy === 'light' ? { theme: 'light' } : null) }
    } catch {
      return { ...DEFAULTS }
    }
  })()

  // Pair the background too, or forcing dark mode onto a saved light
  // gradient would swap one unreadable combination for another.
  return forced ? { ...saved, ...pairTheme(saved, forced) } : saved
}

export function useSettings() {
  const [settings, setSettings] = useState(read)

  // A forced theme has to be written down. `read()` only seeds the state, so
  // without this the override lasted until the next navigation and rescued
  // nobody. The parameter is then dropped from the address bar, both so a
  // copied link does not pin whoever opens it to that mode, and so this
  // effect stops matching once it has done its work.
  useEffect(() => {
    if (!forcedTheme()) return

    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // Same as everywhere else: the change still applies for this visit.
    }

    try {
      const url = new URL(location.href)
      url.searchParams.delete('theme')
      history.replaceState(null, '', url)
    } catch {
      // A browser blocking history rewriting is not worth failing over.
    }
  }, [settings])

  const set = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Quota, or a browser blocking site data. The change still applies
        // for this visit, it just will not be remembered.
      }
      return next
    })
  }, [])

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* nothing to do */
    }
    setSettings({ ...DEFAULTS })
  }, [])

  // Push everything onto the root element. Attributes drive the layout and
  // shape rules, custom properties drive colour, which keeps the stylesheet
  // in charge of how each option actually looks.
  useEffect(() => {
    const root = document.documentElement
    const accent = ACCENTS[settings.accent] || ACCENTS.crimson
    const slate = SLATES[settings.bgSlate] || SLATES.ink
    const grad = GRADIENTS[settings.bgGradient] || GRADIENTS.emberfade

    root.dataset.theme = settings.theme
    root.dataset.shape = settings.cardShape
    root.dataset.titles = settings.showTitles ? 'on' : 'off'
    root.dataset.tint = settings.colorIcons ? 'on' : 'off'
    // "Image" with nothing uploaded painted a flat 55% scrim over `none`,
    // so the whole site went dim and showed no picture. That state is
    // reachable from a persisted setting as well as from the picker, so it
    // is corrected here rather than only in the UI.
    const bgKind =
      settings.bgKind === 'image' && !settings.bgImage ? 'gradient' : settings.bgKind

    root.dataset.bg = bgKind
    root.dataset.bganim = settings.bgAnimated ? 'on' : 'off'

    root.style.setProperty('--accent', accent.a)
    root.style.setProperty('--accent-hot', accent.b)
    root.style.setProperty('--accent-deep', accent.deep)
    root.style.setProperty('--accent-soft', hexA(accent.a, 0.14))
    root.style.setProperty('--accent-glow', hexA(accent.a, 0.4))
    root.style.setProperty('--art-base', `${accent.hue ?? 358}deg`)

    // The slate only applies when the background actually is a flat colour.
    //
    // These used to be set unconditionally, which quietly broke light mode:
    // the stylesheet reads `--panel: var(--slate-panel, #ffffff)`, so a dark
    // slate left over from a previous choice won the fallback and light mode
    // rendered dark panels, dark card title bars and unreadable intro text on
    // a white page. Clearing them lets each theme's own default win.
    if (bgKind === 'slate') {
      root.style.setProperty('--slate-bg', slate.bg)
      root.style.setProperty('--slate-bg-2', slate.bg2)
      root.style.setProperty('--slate-panel', slate.panel)
    } else {
      root.style.removeProperty('--slate-bg')
      root.style.removeProperty('--slate-bg-2')
      root.style.removeProperty('--slate-panel')
    }
    root.style.setProperty('--bg-gradient', grad.css)
    root.style.setProperty('--bg-gradient-base', grad.base || 'transparent')

    // A coloured preset tints the drifting blobs too. Without this the blobs
    // stay on the accent and swamp the base, so every preset looked crimson
    // whatever it was called. The neutral presets carry no `fx`, and clearing
    // the properties puts them back on the accent, which is what makes
    // picking an accent still retint the default background.
    const fx = bgKind === 'gradient' ? grad.fx : null
    for (const [i, name] of ['--fx-a', '--fx-b', '--fx-c'].entries()) {
      if (fx) root.style.setProperty(name, fx[i])
      else root.style.removeProperty(name)
    }
    root.style.setProperty('--bg-dim', String(settings.bgDim / 100))
    root.style.setProperty('--bg-image', settings.bgImage ? `url("${settings.bgImage}")` : 'none')
  }, [settings])

  return useMemo(() => ({ settings, set, reset }), [settings, set, reset])
}

function hexA(hex, alpha) {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// Downscales and re-encodes an uploaded image before it is stored.
// localStorage holds roughly 5MB of UTF-16, and base64 inflates by about a
// third, so a straight phone photo would blow the quota instantly.
export const MAX_BG_EDGE = 1920

export function prepareBackgroundImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That file is not an image.'))
      return
    }

    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_BG_EDGE / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)

      // PNG would keep a photo lossless and enormous. JPEG at 0.82 lands a
      // 1920px image around 300KB, which survives the quota.
      const out = canvas.toDataURL('image/jpeg', 0.82)
      if (out.length > 3_500_000) {
        reject(new Error('That image is too large even after resizing. Try a smaller one.'))
        return
      }
      resolve({ dataUrl: out, width: w, height: h, bytes: out.length })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }

    img.src = url
  })
}
