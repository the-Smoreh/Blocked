// Tests firestore.rules against the emulator.
//
//   npm.cmd run rules:test
//
// These rules are the only thing protecting the chat, because the Firebase
// config ships to every browser by design. So they get tested rather than
// eyeballed, and the cases below are written from the point of view of
// someone with the config and the browser console open, not from the point
// of view of our own client.
//
// Needs Java, which the emulator runs on.

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'

const env = await initializeTestEnvironment({
  projectId: 'demo-blocked',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
})

let passed = 0
let failed = 0

async function check(name, run) {
  try {
    await run()
    passed += 1
    console.log('  ok    ' + name)
  } catch (e) {
    failed += 1
    console.log('  FAIL  ' + name)
    console.log('        ' + String(e.message).split('\n')[0].slice(0, 130))
  }
}

const ROOM = 'main'
const msgs = (db) => doc(db, 'rooms', ROOM, 'messages', 'm' + Math.random().toString(36).slice(2))
const rate = (db, uid) => doc(db, 'rooms', ROOM, 'rate', uid)

// What our own client does: the message and the sender's rate marker in one
// commit. The rules require exactly this pairing.
function send(db, uid, fields = {}) {
  const batch = writeBatch(db)
  batch.set(msgs(db), {
    uid,
    user: 'Ada',
    text: 'hello',
    at: serverTimestamp(),
    ...fields,
  })
  batch.set(rate(db, uid), { last: serverTimestamp() })
  return batch.commit()
}

console.log('\n--- a stranger who is not signed in ---')
{
  const db = env.unauthenticatedContext().firestore()
  await check('cannot read the room', () => assertFails(getDoc(msgs(db))))
  await check('cannot post', () => assertFails(send(db, 'anyone')))
}

console.log('\n--- signed in, behaving ---')
{
  const uid = 'user-a'
  const db = env.authenticatedContext(uid).firestore()
  await check('can read the room', () => assertSucceeds(getDoc(msgs(db))))
  await check('can post a first message', () => assertSucceeds(send(db, uid)))
}

console.log('\n--- the rate limit ---')
{
  const uid = 'user-b'
  const db = env.authenticatedContext(uid).firestore()
  await check('first message goes through', () => assertSucceeds(send(db, uid)))
  await check('a second straight after is refused', () => assertFails(send(db, uid)))

  // The rule allows a message once the marker is older than the gap. Rather
  // than sleeping two seconds, put the marker in the past with the rules
  // turned off, which is what withSecurityRulesDisabled is for.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(rate(ctx.firestore(), uid), { last: new Date(Date.now() - 60_000) })
  })
  await check('allowed again once the gap has passed', () => assertSucceeds(send(db, uid)))
}

console.log('\n--- posting without moving your own marker ---')
{
  const uid = 'user-c'
  const db = env.authenticatedContext(uid).firestore()
  // A message on its own, no rate marker. If this were allowed, anyone could
  // post forever while leaving their marker stale, and the limit would be
  // decoration.
  await check('a message with no marker update is refused', () =>
    assertFails(
      setDoc(msgs(db), { uid, user: 'Ada', text: 'flood', at: serverTimestamp() }),
    ),
  )
}

console.log('\n--- lying about who you are ---')
{
  const uid = 'user-d'
  const db = env.authenticatedContext(uid).firestore()
  await check('cannot post under another uid', () => assertFails(send(db, 'someone-else')))
  await check("cannot write another person's marker", () =>
    assertFails(setDoc(rate(db, 'user-a'), { last: serverTimestamp() })),
  )
}

console.log('\n--- malformed messages ---')
{
  const db = env.authenticatedContext('user-e').firestore()
  const uid = 'user-e'
  await check('name over 18 characters refused', () =>
    assertFails(send(db, uid, { user: 'N'.repeat(19) })),
  )
  await check('text over 240 characters refused', () =>
    assertFails(send(db, uid, { text: 'Y'.repeat(241) })),
  )
  await check('empty name refused', () => assertFails(send(db, uid, { user: '' })))
  await check('empty text refused', () => assertFails(send(db, uid, { text: '' })))
  await check('a number as text refused', () => assertFails(send(db, uid, { text: 42 })))
  await check('extra fields refused', () => assertFails(send(db, uid, { admin: true })))
  await check('a made up timestamp refused', () =>
    assertFails(send(db, uid, { at: new Date('2099-01-01') })),
  )
}

console.log('\n--- rewriting history ---')
{
  let id
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = doc(ctx.firestore(), 'rooms', ROOM, 'messages', 'fixed')
    await setDoc(d, { uid: 'user-a', user: 'Ada', text: 'said once', at: new Date() })
    id = d.id
  })
  const db = env.authenticatedContext('user-f').firestore()
  const target = doc(db, 'rooms', ROOM, 'messages', id)
  await check("cannot edit someone else's message", () =>
    assertFails(setDoc(target, { uid: 'user-f', user: 'X', text: 'nope', at: serverTimestamp() })),
  )
  await check('cannot delete a message', () => assertFails(deleteDoc(target)))
}

console.log('\n--- anywhere else in the project ---')
{
  const db = env.authenticatedContext('user-g').firestore()
  await check('another collection is closed', () =>
    assertFails(setDoc(doc(db, 'secrets', 'x'), { a: 1 })),
  )
  await check('reading another collection is closed', () =>
    assertFails(getDoc(doc(db, 'secrets', 'x'))),
  )
}

console.log('\n--- leaderboard: reading ---')
{
  const db = env.unauthenticatedContext().firestore()
  await check('a stranger can read the board', () =>
    assertSucceeds(getDocs(collection(db, 'leaderboard'))),
  )
}

// What the site itself sends: an increment and a server stamp, merged.
const play = (db, uid, seconds, extra = {}) =>
  setDoc(
    doc(db, 'leaderboard', uid),
    { name: 'Ada', seconds: increment(seconds), updated: serverTimestamp(), ...extra },
    { merge: true },
  )

// Puts a row in place with the rules off, so a test can start from "last
// written N seconds ago" without sleeping for N seconds.
async function seed(uid, seconds, agoSeconds) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'leaderboard', uid), {
      name: 'Ada',
      seconds,
      updated: new Date(Date.now() - agoSeconds * 1000),
    })
  })
}

console.log('\n--- leaderboard: the first write ---')
{
  const db = env.authenticatedContext('lb-a').firestore()
  await check('a first write of one minute is allowed', () => assertSucceeds(play(db, 'lb-a', 60)))

  const db2 = env.authenticatedContext('lb-b').firestore()
  await check('a first write of an hour is refused', () => assertFails(play(db2, 'lb-b', 3600)))

  const db3 = env.authenticatedContext('lb-c').firestore()
  await check("writing someone else's row is refused", () => assertFails(play(db3, 'lb-a', 10)))

  const anon = env.unauthenticatedContext().firestore()
  await check('writing while not signed in is refused', () => assertFails(play(anon, 'lb-z', 10)))
}

console.log('\n--- leaderboard: faster than the clock ---')
{
  const uid = 'lb-d'
  const db = env.authenticatedContext(uid).firestore()
  await seed(uid, 600, 2)
  await check('adding a minute two seconds after the last write is refused', () =>
    assertFails(play(db, uid, 60)),
  )

  await seed(uid, 600, 70)
  await check('adding a minute seventy seconds after the last write is allowed', () =>
    assertSucceeds(play(db, uid, 60)),
  )
}

console.log('\n--- leaderboard: the one write cap ---')
{
  const uid = 'lb-e'
  const db = env.authenticatedContext(uid).firestore()
  // A whole day really has passed, so without the cap this would be allowed.
  await seed(uid, 600, 86400)
  await check('claiming a day in one write after a day away is refused', () =>
    assertFails(play(db, uid, 86400)),
  )
  await check('but a normal minute after a day away is fine', () =>
    assertSucceeds(play(db, uid, 60)),
  )
}

console.log('\n--- leaderboard: shape ---')
{
  const uid = 'lb-f'
  const db = env.authenticatedContext(uid).firestore()
  await seed(uid, 600, 120)
  await check('going backwards is refused', () => assertFails(play(db, uid, -30)))
  await check('an extra field is refused', () => assertFails(play(db, uid, 10, { admin: true })))
  await check('a name over 18 is refused', () =>
    assertFails(play(db, uid, 10, { name: 'N'.repeat(19) })),
  )
  await check('a made up timestamp is refused', () =>
    assertFails(
      setDoc(
        doc(db, 'leaderboard', uid),
        { name: 'Ada', seconds: increment(10), updated: new Date('2099-01-01') },
        { merge: true },
      ),
    ),
  )
  await check('renaming with no time added is allowed at any moment', () =>
    assertSucceeds(play(db, uid, 0, { name: 'Grace' })),
  )
  await check('a row cannot be deleted, even by its owner', () =>
    assertFails(deleteDoc(doc(db, 'leaderboard', uid))),
  )
}

await env.cleanup()

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
