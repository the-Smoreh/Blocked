// A Blocked account.
//
// There is no password and no sign in screen, on purpose: an account is a
// name you pick once, tied to this browser. The chat room, the settings and
// the leaderboard all read it from here, so it is asked for exactly once, by
// whichever of them you reach first, and never again.
//
// What pairs it with you across all three is the anonymous Firebase identity
// in fbclient.js, which the browser keeps between visits. The honest limit of
// that: clearing site data, a private window, or another device is a new
// account, because there is nothing to log back in with. A real sign in would
// fix that and would also be an extra step every time, which is the thing
// this was asked not to have.
//
// Deliberately free of Firebase. This module is on every page, and the sdk is
// only fetched when something actually needs the network.

import { useSyncExternalStore } from 'react'
import { cleanName } from './names.js'

const KEY = 'blocked:account'

// The name the chat room kept before accounts existed. Anyone who already
// joined the chat has an account the moment this loads, under that name, and
// is not asked again.
const LEGACY_CHAT_NAME = 'blocked:chatname'

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    const name = cleanName(saved?.name)
    if (name) {
      return {
        name,
        since: saved.since || Date.now(),
        // Learned the first time the account signs in. See linkUid.
        uid: typeof saved.uid === 'string' ? saved.uid : undefined,
        // When the profile picture last changed, or nothing if there is none.
        avatar: typeof saved.avatar === 'number' ? saved.avatar : undefined,
      }
    }

    const legacy = cleanName(localStorage.getItem(LEGACY_CHAT_NAME))
    if (legacy) {
      const account = { name: legacy, since: Date.now() }
      localStorage.setItem(KEY, JSON.stringify(account))
      return account
    }
  } catch {
    // Private windows and blocked site data throw on access. No account, then,
    // which just means being asked for a name.
  }
  return null
}

// The store. `current` is only replaced when something actually changes, so
// useSyncExternalStore sees a stable value between renders.
let current = load()
const listeners = new Set()

function emit() {
  for (const fn of listeners) fn()
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Kept for this visit even if it cannot be remembered.
  }
}

// The uid from the last sign in, held even before there is an account, so an
// account made after the chat already signed in still gets it.
let lastUid

// Another tab making or renaming the account updates this one as well.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return
    current = load()
    emit()
  })
}

export function getAccount() {
  return current
}

export function saveAccount(name) {
  const clean = cleanName(name)
  if (!clean) return null

  // Spread first, so a rename keeps the uid and the picture.
  current = { ...current, name: clean, since: current?.since || Date.now() }
  if (!current.uid && lastUid) current.uid = lastUid
  persist()
  emit()
  return current
}

// Merges into the account and saves it. For the things learned after it is
// made: its uid, and when its picture changed.
export function updateAccount(patch) {
  if (!current) return null
  current = { ...current, ...patch }
  persist()
  emit()
  return current
}

// Called by fbclient.js on every sign in. The uid is what pictures are stored
// under, so the account needs it without loading Firebase to ask.
//
// A different uid than before means this browser's sign in was reset, and a
// picture saved under the old one is not this account's any more.
export function linkUid(uid) {
  lastUid = uid
  if (!current || current.uid === uid) return
  updateAccount({ uid, avatar: current.uid ? undefined : current.avatar })
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useAccount() {
  return useSyncExternalStore(subscribe, getAccount, () => null)
}
