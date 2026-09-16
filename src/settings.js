import { useCallback, useEffect, useMemo, useState } from 'react'

// Every user adjustable option lives here in one object, persisted whole.
// Adding a key means adding it to DEFAULTS and to the Settings panel, and
// nothing else, because the reducer merges over DEFAULTS on read. That also
// means an old saved blob missing a new key still loads cleanly.

const KEY = 'blocked:settings'

export const DEFAULTS = {
  // The imported link library is off by default. It is kept, not deleted,
  // because 439 of its 451 urls point at a host that no longer resolves.
  library: 'lumin',

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
