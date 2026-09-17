// Client for the chat room.
//
// The site is static, so there is nothing here that can store a message. A
// chat needs somewhere shared to put them, which means a backend, and whether
// one exists depends entirely on where this build is hosted. So the room
// checks, and says plainly when there is nothing behind it rather than
// pretending: a chat that silently only talks to itself is worse than one
// that admits it is not connected.
//
// The endpoint contract, small on purpose so anything can implement it:
//
//   GET  <base>/messages        -> { messages: [{ id, user, text, at }] }
//   POST <base>/messages  body  <- { user, text }
//                               -> { message } | 429 when rate limited
//
// `server/chat.mjs` is a working implementation of exactly that, for local
// testing and as a starting point for a real one.

// Build time override for a backend hosted somewhere else, otherwise the same
// origin. Same origin is the sane default: it needs no CORS and it is what a
// host with functions gives you.
const CONFIGURED = import.meta.env.VITE_CHAT_API
const BASE = String(CONFIGURED || `${import.meta.env.BASE_URL}api/chat`).replace(/\/+$/, '')

// Only the newest 200 are kept, oldest dropped. A room that never forgets
// would grow without limit in both the page and whatever is storing it.
export const MAX_MESSAGES = 200
export const MAX_LENGTH = 240
export const MAX_NAME = 18
// The gap the composer enforces between two sends from this browser.
export const SEND_INTERVAL_MS = 1500
export const POLL_MS = 3000

const TIMEOUT_MS = 8000

function withTimeout(signalHolder) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  signalHolder.clear = () => clearTimeout(timer)
  return controller.signal
}

// True only if something actually answered with the json this expects.
//
// `res.ok` is not enough. Plenty of static hosts answer an unknown path with
// their own index.html and a 200, so a naive check would decide a backend
// exists, then fail on every read with a parse error. GitHub Pages returns a
// real 404, which is the easy case; the html-with-200 hosts are the reason
// this looks at the content type and the shape of the body.
export async function probeBackend() {
  const holder = {}
  try {
    const res = await fetch(`${BASE}/messages`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: withTimeout(holder),
    })
    if (!res.ok) return false
    if (!(res.headers.get('content-type') || '').includes('application/json')) return false
    const body = await res.json()
    return Array.isArray(body?.messages)
  } catch {
    return false
  } finally {
    holder.clear?.()
  }
}

export async function fetchMessages() {
  const holder = {}
  try {
    const res = await fetch(`${BASE}/messages`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: withTimeout(holder),
    })
    if (!res.ok) throw new Error(`The room returned ${res.status}`)
    const body = await res.json()
    return trim(Array.isArray(body?.messages) ? body.messages : [])
  } finally {
    holder.clear?.()
  }
}

export async function sendMessage(user, text) {
  const holder = {}
  try {
    const res = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ user, text }),
      signal: withTimeout(holder),
    })

    if (res.status === 429) throw new Error('Slow down a moment.')
    if (!res.ok) throw new Error(`Could not send that, the room returned ${res.status}`)
    return true
  } finally {
    holder.clear?.()
  }
}

export function trim(messages) {
  return messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages
}

// ------------------------------------------------------------- names

export function cleanName(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
}

// ------------------------------------------------------------- colours

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

// The hue is all that is stored. Lightness comes from the theme, because a
// colour readable on the dark panel is far too pale on the light one, and
// picking one fixed value would leave half the names hard to read in one mode
// or the other. See `--chat-l` in the stylesheet.
//
// FNV-1a over the name, so the same person is the same colour for everyone in
// the room and across reloads. Assigning colours in join order would give the
// same person a different colour in every other person's window.
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
