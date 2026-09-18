// Client for the chat room, on Firestore.
//
// Firestore pushes changes to the browser, so there is no polling here at
// all. A snapshot listener means a message appears the instant it is sent.
//
// It needs no backend of ours. The browser talks to Firestore directly, so
// the room works on any static host.
//
// The connection and the anonymous identity come from fbclient.js, shared
// with the leaderboard and the play time tracker, so a chat message and a
// leaderboard row are signed by the same uid. That shared identity is what an
// account is here.

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { ROOM } from './firebase.js'
import { firestore, signIn } from './fbclient.js'
import { cleanName, cleanText } from './names.js'

// Re-exported so the chat room keeps importing everything from one place.
export { MAX_NAME, cleanName, hueFor, initialFor, HUES, COLOUR_COUNT } from './names.js'

// Only the newest 200 are shown, oldest first on screen.
//
// 200 is a read limit, not a delete. Old messages stay in Firestore, because
// pruning them needs either a scheduled function, which is not on the free
// plan, or letting clients delete each other's messages, which is worse.
export const MAX_MESSAGES = 200
export const MAX_LENGTH = 240
// Kept in step with firestore.rules, which enforces it. The countdown in the
// composer is a courtesy; the rule is the control.
export const SEND_INTERVAL_MS = 2000

let uid = null

// Signs in and returns whether the room is usable.
export async function connect() {
  uid = await signIn()
  return Boolean(uid)
}

const messagesRef = () => collection(firestore(), 'rooms', ROOM, 'messages')
const rateRef = () => doc(firestore(), 'rooms', ROOM, 'rate', uid)

// Subscribes to the room. Returns the unsubscribe function.
export function watchMessages(onMessages, onError) {
  const q = query(messagesRef(), orderBy('at', 'desc'), limit(MAX_MESSAGES))

  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs
        .map((d) => {
          const data = d.data()
          return {
            id: d.id,
            // Whose picture to show. Also what `mine` is decided by.
            uid: data.uid,
            user: data.user,
            text: data.text,
            // A message written on this device shows up once immediately with
            // `at` still null, before the server timestamp comes back.
            at: data.at?.toDate?.().toISOString() ?? new Date().toISOString(),
            mine: data.uid === uid,
          }
        })
        .reverse()

      onMessages(rows)
    },
    (err) =>
      onError?.(err.code === 'permission-denied' ? 'Not allowed to read the room.' : err.message),
  )
}

export async function sendMessage(user, text) {
  const name = cleanName(user)
  const body = cleanText(text, MAX_LENGTH)
  if (!name || !body) throw new Error('Nothing to send.')

  // Both writes in one batch, because the rules require it: a message is only
  // allowed if the same commit also moves this sender's rate marker forward.
  const batch = writeBatch(firestore())
  batch.set(doc(messagesRef()), {
    uid,
    user: name,
    text: body,
    at: serverTimestamp(),
  })
  batch.set(rateRef(), { last: serverTimestamp() })

  try {
    await batch.commit()
  } catch (e) {
    if (e.code === 'permission-denied') throw new Error('Slow down a moment.')
    throw new Error(e.message)
  }
}
