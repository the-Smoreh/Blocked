-- Tables for the chat room on Cloudflare D1. See DEPLOY.md.
--
-- The columns are `name` and `body` rather than `user` and `text` because
-- both of those are reserved words in enough SQL dialects to be worth
-- avoiding. functions/api/chat/messages.js maps them back on the way out, so
-- the json the client sees is still { user, text }.

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  at TEXT NOT NULL
);

-- One row per address, holding when it last posted. This is what makes the
-- rate limit real: the countdown in the composer is a courtesy, but anyone
-- can post straight at the endpoint, so the interval has to be enforced
-- server side.
CREATE TABLE IF NOT EXISTS limits (
  ip TEXT PRIMARY KEY,
  last_at INTEGER NOT NULL
);
