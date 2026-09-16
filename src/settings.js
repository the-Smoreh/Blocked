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
  local: {
    label: 'Built in',
    note: 'The old imported link list, mostly dead',
    file: 'games.json',
    count: 451,
  },
}

export function libraryFile(id) {
  return LIBRARIES[id]?.file || null
}

export const DEFAULTS = {
  // Goblin Kingdom is the default because it is the largest fully verified
  // library, 633 of 633 urls live and frameable.
  //
  // Lumin was the default until its behaviour was pinned down: init resolves
  // but renders nothing, every other method on its Proxy queues forever
  // because its worker reports "domain fetch failed", and getGames() never
  // settles. A default that shows an error to every visitor is a defect, so
  // it is still selectable, just not first.
  library: 'goblin',

  theme: 'dark',
  accent: 'crimson',

  bgKind: 'slate', // slate | gradient | image
  bgSlate: 'ink',
  bgGradient: 'emberfade',
  bgImage: null, // data url, written by the uploader below
  bgDim: 55, // 0-90, converted to a 0..0.9 scrim alpha over a background image

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

export const SLATES = {
  ink: { label: 'Ink', bg: '#08080a', bg2: '#0d0d10', panel: '#131317' },
  graphite: { label: 'Graphite', bg: '#121215', bg2: '#17171c', panel: '#1d1d23' },
  navy: { label: 'Navy', bg: '#070b14', bg2: '#0b111d', panel: '#101827' },
  plum: { label: 'Plum', bg: '#0c0710', bg2: '#120b17', panel: '#1a1020' },
  moss: { label: 'Moss', bg: '#070c09', bg2: '#0b120d', panel: '#101a13' },
  bone: { label: 'Bone', bg: '#fbfbfc', bg2: '#ffffff', panel: '#ffffff' },
}

export const GRADIENTS = {
  emberfade: { label: 'Ember fade', css: 'linear-gradient(160deg, #1a0708 0%, #08080a 55%)' },
  duskrise: { label: 'Dusk rise', css: 'linear-gradient(200deg, #1b0d24 0%, #08080a 60%)' },
  deepsea: { label: 'Deep sea', css: 'linear-gradient(180deg, #07141f 0%, #08080a 62%)' },
  nightgrid: {
    label: 'Night grid',
    css: 'radial-gradient(120% 80% at 50% -10%, #1a1020 0%, #08080a 60%)',
  },
  coals: {
    label: 'Coals',
    css: 'radial-gradient(90% 60% at 15% 0%, #2a0b0d 0%, transparent 60%), radial-gradient(80% 60% at 85% 10%, #1a0a1e 0%, transparent 62%), #08080a',
  },
  paper: { label: 'Paper', css: 'linear-gradient(170deg, #ffffff 0%, #f1f1f4 100%)' },
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    if (raw && typeof raw === 'object') return { ...DEFAULTS, ...raw }

    // Theme used to live under its own key, before settings existed. Carry a
    // saved light choice across rather than silently resetting it to dark.
    const legacy = localStorage.getItem('blocked:theme')
    return { ...DEFAULTS, ...(legacy === 'light' ? { theme: 'light' } : null) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(read)

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
    root.dataset.bg = settings.bgKind

    root.style.setProperty('--accent', accent.a)
    root.style.setProperty('--accent-hot', accent.b)
    root.style.setProperty('--accent-deep', accent.deep)
    root.style.setProperty('--accent-soft', hexA(accent.a, 0.14))
    root.style.setProperty('--accent-glow', hexA(accent.a, 0.4))
    root.style.setProperty('--art-base', `${accent.hue ?? 358}deg`)

    // A custom slate only makes sense when the background is a flat colour.
    // Under a gradient or an image the panel tokens still come from it, so
    // cards keep sitting on something solid.
    root.style.setProperty('--slate-bg', slate.bg)
    root.style.setProperty('--slate-bg-2', slate.bg2)
    root.style.setProperty('--slate-panel', slate.panel)
    root.style.setProperty('--bg-gradient', grad.css)
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
