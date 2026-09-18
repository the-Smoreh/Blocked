// Time played, and the leaderboard built from it, in Cloudflare D1.
//
// This used to be Firestore, guarded by security rules. It never worked live,
// because the rules have to be published by hand from the Firebase console and
// that step kept not happening. Here the checks are ordinary code that ships
// with every push, so there is nothing to publish.
//
//   POST /api/playtime       add time, or rename, for the signed in account
//   GET  /api/leaderboard    the top 50, plus `?uid=` for where one account is
//
// D1 is SQLite. The free plan allows 5 million rows read and 100,000 written a
// day, against Firestore's 50,000 reads, and a player writes once a minute.

import { cleanName } from '../src/names.js'

export const TOP = 50

// The most one write may add. The player writes every minute, so a normal
// write is about 60. This is what stops a gap of a day being claimed at once.
const MAX_PER_WRITE = 90

// Allowance for a timer and a clock that do not quite agree.
const SLACK_SECONDS = 5

const UID = /^[A-Za-z0-9]{1,128}$/

// Created on first use rather than by a migration, because `wrangler deploy`
// does not run migrations and nothing else would. Once per Worker instance.
let ready = null

function ensureTable(db) {
  ready ??= db
    .batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS players (
          uid TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          seconds INTEGER NOT NULL DEFAULT 0,
          updated INTEGER NOT NULL
        )`,
      ),
      db.prepare('CREATE INDEX IF NOT EXISTS players_by_seconds ON players (seconds DESC)'),
    ])
    .catch((e) => {
      // Try again on the next request rather than failing every one after.
      ready = null
      throw e
    })
  return ready
}

// Adds time to the account and refreshes its name.
//
// Whatever the browser asks for, what is added is capped twice: at 90 a
// write, and at the time that has actually passed since this account's last
// write. So leaving a book open in two tabs, or posting to this by hand, counts
// no faster than the clock. Both caps are inside the one SQL statement, which
// D1 runs on its own, so two writes arriving together cannot both claim the
// same stretch of time.
export async function addPlaytime(db, uid, body) {
  const name = cleanName(body?.name)
  const asked = Math.floor(Number(body?.seconds))
  if (!name || !Number.isFinite(asked) || asked < 0) return { status: 400 }

  await ensureTable(db)
  const now = Date.now()

  // A rename. Only touches a row that exists, so an account that has not
  // played yet does not appear on the board at zero. `updated` is left alone,
  // or a rename would eat into the next write's allowance.
  if (asked === 0) {
    await db.prepare('UPDATE players SET name = ?1 WHERE uid = ?2').bind(name, uid).run()
    return { status: 200 }
  }

  // The CASTs keep the total whole seconds. A JavaScript number can reach
  // SQLite as a REAL, and then the elapsed time would divide into a fraction.
  await db
    .prepare(
      `INSERT INTO players (uid, name, seconds, updated)
       VALUES (?1, ?2, MIN(CAST(?3 AS INTEGER), ?5), CAST(?4 AS INTEGER))
       ON CONFLICT (uid) DO UPDATE SET
         name = excluded.name,
         seconds = seconds + MAX(0, MIN(
           CAST(?3 AS INTEGER),
           ?5,
           CAST((CAST(?4 AS INTEGER) - updated) / 1000 AS INTEGER) + ?6
         )),
         updated = CAST(?4 AS INTEGER)`,
    )
    .bind(uid, name, asked, now, MAX_PER_WRITE, SLACK_SECONDS)
    .run()

  return { status: 200 }
}

// The top of the board, and where `uid` stands if one is given. `onlyMine`
// skips the top 50 for the account page, which only shows its own line.
export async function readBoard(db, uid, onlyMine) {
  await ensureTable(db)
  const who = uid && UID.test(uid) ? uid : null

  let rows = []
  if (!onlyMine) {
    const { results } = await db
      .prepare('SELECT uid, name, seconds FROM players ORDER BY seconds DESC, updated ASC LIMIT ?1')
      .bind(TOP)
      .all()
    rows = results.map((r, i) => ({ rank: i + 1, ...r }))
  }

  let me = rows.find((r) => r.uid === who) || null
  if (!me && who) {
    const own = await db
      .prepare('SELECT name, seconds FROM players WHERE uid = ?1')
      .bind(who)
      .first()
    if (own) {
      // Counting who is ahead rather than reading them all. With the index on
      // seconds this reads only those rows.
      const ahead = await db
        .prepare('SELECT COUNT(*) AS n FROM players WHERE seconds > ?1')
        .bind(own.seconds)
        .first('n')
      me = { rank: ahead + 1, uid: who, ...own }
    }
  }

  return { rows, me }
}
