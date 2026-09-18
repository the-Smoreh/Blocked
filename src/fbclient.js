// The one Firebase connection the whole site shares.
//
// The chat, the leaderboard and the play time tracker all used to be able to
// start their own. One app and one anonymous sign in means one identity, and
// that identity is what makes an account an account: the uid a chat message is
// signed with is the same uid the leaderboard row is keyed on.
//
// It is still only imported by lazily loaded code. Nothing on the wall pulls
// this in, so a visitor who never opens the chat, the leaderboard or a book
// never downloads the Firebase sdk.

import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { CONFIG, configured } from './firebase.js'

let app = null
let db = null
let auth = null
let pending = null

// Set VITE_EMULATOR=1 when starting the dev server to run the whole site
// against the local emulators instead of the real project, so the chat, the
// leaderboard and play time can be tested end to end without touching real
// data or needing the real rules published. `npm.cmd run dev:emulated` does
// both halves. Never set in a real build, so it cannot ship switched on.
const EMULATED = import.meta.env.VITE_EMULATOR === '1'

export function firestore() {
  if (!configured) return null
  if (!app) {
    app = initializeApp(EMULATED ? { ...CONFIG, projectId: 'demo-blocked' } : CONFIG)
    db = getFirestore(app)
    auth = getAuth(app)
    if (EMULATED) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080)
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    }
  }
  return db
}

// The uid for this browser, the same one on every visit.
//
// Firebase keeps the anonymous session in the browser's own storage and
// restores it on load, and `signInAnonymously` hands back the existing user
// when there is one rather than minting another. So this is not a new account
// per page load: it is the same one until site data is cleared. That is what
// lets the site never ask twice.
//
// One shared promise, so the chat and a book opening at the same moment do
// not race two sign ins. A failure clears it so the next caller can retry.
export function signIn() {
  if (pending) return pending
  if (!firestore()) return Promise.resolve(null)

  pending = signInAnonymously(auth)
    .then((credential) => credential.user.uid)
    .catch(() => {
      pending = null
      return null
    })

  return pending
}
