// Time played, and the leaderboard built from it.
//
// One document per account, keyed by the anonymous uid, holding a running
// total. The player adds to it as someone plays; the leaderboard reads the top
// of it. Lazily loaded along with the Firebase sdk, so it costs nothing until
// a book is opened by someone with an account, or the board is looked at.
//
// The part worth understanding is that the total cannot simply be trusted.
// The Firebase config ships to every browser, so anyone can write to this
// collection from the console. firestore.rules therefore refuses any write
// that adds more time than has actually passed since the previous one. See
// the leaderboard block there; this file is written to stay inside it.

import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { firestore, signIn } from './fbclient.js'
import { cleanName } from './names.js'

const COLLECTION = 'leaderboard'

// How many rows the board shows.
export const TOP = 50

// The most one write may add, matched by the rules. A flush happens every
// minute, so a normal write adds about 60. The cap is what stops someone
// leaving a gap of a day and then claiming the whole day in one write.
export const MAX_PER_WRITE = 90

// Adds seconds to this account's total, and refreshes the name on it.
//
// `increment` rather than read, add, write: two tabs flushing at once cannot
// then overwrite each other's time, and the rules see the resulting total, so
// they can still check how much was added.
export async function addPlaytime(seconds, name) {
  const uid = await signIn()
  if (!uid) return false

  const clean = cleanName(name)
  const whole = Math.max(0, Math.min(MAX_PER_WRITE, Math.floor(seconds)))
  if (!clean) return false

  await setDoc(
    doc(firestore(), COLLECTION, uid),
    { name: clean, seconds: increment(whole), updated: serverTimestamp() },
    { merge: true },
  )
  return true
}

// Rename without adding time. The rules allow a zero increment at any moment.
export function renameEntry(name) {
  return addPlaytime(0, name)
}

// The top of the board, plus where this account stands if it is not on it.
export async function fetchBoard() {
  const db = firestore()
  if (!db) throw new Error('The leaderboard is not set up.')

  // Reading is open to anyone, so this only matters for spotting which row is
  // yours. A failed sign in still shows the board.
  const uid = await signIn()

  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy('seconds', 'desc'), limit(TOP)),
  )
  const rows = snap.docs.map((d, i) => ({
    rank: i + 1,
    uid: d.id,
    name: d.data().name,
    seconds: d.data().seconds || 0,
    mine: d.id === uid,
  }))

  let me = rows.find((r) => r.mine) || null

  // Off the board: count how many are ahead rather than reading them all. A
  // count query is billed as one read per thousand documents it covers.
  if (!me && uid) {
    const own = await getDoc(doc(db, COLLECTION, uid))
    if (own.exists()) {
      const seconds = own.data().seconds || 0
      const ahead = await getCountFromServer(
        query(collection(db, COLLECTION), where('seconds', '>', seconds)),
      )
      me = {
        rank: ahead.data().count + 1,
        uid,
        name: own.data().name,
        seconds,
        mine: true,
      }
    }
  }

  return { rows, me }
}

// Just this account's time and rank. One document read and one count, rather
// than fetching fifty rows to find a single one of them. `null` rank means no
// time has been recorded yet, which is not the same as last place.
export async function fetchMine() {
  const db = firestore()
  if (!db) throw new Error('The leaderboard is not set up.')

  const uid = await signIn()
  if (!uid) throw new Error('Could not sign in.')

  const own = await getDoc(doc(db, COLLECTION, uid))
  if (!own.exists()) return { seconds: 0, rank: null }

  const seconds = own.data().seconds || 0
  const ahead = await getCountFromServer(
    query(collection(db, COLLECTION), where('seconds', '>', seconds)),
  )
  return { seconds, rank: ahead.data().count + 1 }
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
