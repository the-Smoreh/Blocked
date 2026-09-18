// Time played, and the leaderboard built from it.
//
// The data lives with the Cloudflare Worker, in D1, and every rule about what
// counts is enforced there. See worker/leaderboard.js. It used to be
// Firestore, which needed security rules published by hand before any of it
// worked, and they never were.
//
// Reading the board is a plain fetch with no Firebase at all, so opening the
// leaderboard no longer downloads the Firebase sdk. Only adding time needs a
// sign in token, and that module is loaded just for that.

import { getAccount } from './account.js'
import { cleanName } from './names.js'

// How many rows the board shows. The Worker decides; this is for reference.
export const TOP = 50

// The most one write may add. The Worker caps it too, and also caps it at the
// time actually passed since the last write, so this is only politeness.
export const MAX_PER_WRITE = 90

const API = `${import.meta.env.BASE_URL}api/`

// This browser's uid, for spotting your own row. Held on the account once it
// has signed in, so usually no Firebase is needed to know it.
async function myUid() {
  const account = getAccount()
  if (!account) return null
  if (account.uid) return account.uid
  const { signIn } = await import('./fbclient.js')
  return signIn()
}

async function getJson(url, init) {
  let res
  try {
    res = await fetch(url, init)
  } catch {
    throw new Error('Could not reach the leaderboard.')
  }
  // A host without the Worker answers with its own page, or an error that is
  // not ours. Either way there is no board to show.
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  if (!res.ok || !isJson) {
    const error = new Error('The leaderboard is not available here.')
    error.status = res.status
    throw error
  }
  return res.json()
}

// Adds seconds to this account's total, and refreshes the name on it. Throws
// on failure; `refused` on the error means the data itself was rejected and
// sending it again would change nothing.
export async function addPlaytime(seconds, name) {
  const clean = cleanName(name)
  const whole = Math.max(0, Math.min(MAX_PER_WRITE, Math.floor(seconds)))
  if (!clean) return false

  const { idToken } = await import('./fbclient.js')
  const token = await idToken()
  if (!token) throw new Error('Could not sign in.')

  try {
    await getJson(`${API}playtime`, {
      method: 'POST',
      // Lets the last write finish when it is sent as the page closes.
      keepalive: true,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ seconds: whole, name: clean }),
    })
  } catch (e) {
    if (e.status === 400) e.refused = true
    throw e
  }
  return true
}

// Rename without adding time. The Worker only renames a row that exists, so
// an account that has not played yet does not appear at zero.
export function renameEntry(name) {
  return addPlaytime(0, name)
}

// The top of the board, plus where this account stands if it is not on it.
export async function fetchBoard() {
  const uid = await myUid().catch(() => null)
  const query = uid ? `?uid=${encodeURIComponent(uid)}` : ''
  const data = await getJson(`${API}leaderboard${query}`)
  return {
    rows: data.rows.map((r) => ({ ...r, mine: r.uid === uid })),
    me: data.me ? { ...data.me, mine: true } : null,
  }
}

// Just this account's time and rank. `null` rank means no time has been
// recorded yet, which is not the same as last place.
export async function fetchMine() {
  const uid = await myUid()
  if (!uid) throw new Error('Could not sign in.')
  const { me } = await getJson(`${API}leaderboard?only=me&uid=${encodeURIComponent(uid)}`)
  return me ? { seconds: me.seconds, rank: me.rank } : { seconds: 0, rank: null }
}

// Plain durations. Hours and minutes once there are any, seconds only when
// there is nothing larger to say.
export function formatPlaytime(total) {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h) return m ? `${h}h ${m}m` : `${h}h`
  if (m) return `${m}m`
  return `${s}s`
}
