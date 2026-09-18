// The server code on Cloudflare: profile pictures and the leaderboard.
//
// Everything else on the site is static files, which Cloudflare serves without
// running this at all. `run_worker_first` in wrangler.jsonc sends only /api/*
// and /avatars/* here, so a page load never costs a Worker request.
//
//   PUT    /api/avatar         upload yours, body is the image
//   DELETE /api/avatar         remove yours
//   GET    /avatars/<uid>      anyone's, 404 if they have none
//   POST   /api/playtime       add time played, see leaderboard.js
//   GET    /api/leaderboard    the top 50
//
// Pictures live in Workers KV under `avatar:<uid>`. KV rather than R2 because
// R2 has to be switched on with a card on file, KV does not, and a picture
// here is about 10KB, far inside what KV is good at.

import { UID, verifyIdToken } from './firebase-token.js'
import { addPlaytime, readBoard } from './leaderboard.js'

// The browser shrinks a picture to 160px square before sending it, which
// lands around 5 to 15KB. This is the ceiling for anything sent by hand.
const MAX_BYTES = 64 * 1024

// One change per account per this long. The free KV plan allows 1,000 writes a
// day across the whole site, so an upload button someone holds down must not
// be able to spend them.
const CHANGE_GAP_MS = 20_000

// How long a browser and Cloudflare's edge keep a picture, or the fact that
// someone has none. A changed picture reaches other people within this.
const CACHE_SECONDS = 600

const key = (uid) => `avatar:${uid}`

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

// What the bytes actually are, whatever the request claimed. Only WebP and
// JPEG, the two formats the browser side ever sends. Nothing that can carry
// script, so no SVG.
function sniff(b) {
  const webp =
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  if (webp) return 'image/webp'
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  return null
}

// Served with a fixed image type, no sniffing and a sandbox, so even a file
// crafted to look like a page cannot run as one on our origin.
function imageResponse(body, type) {
  return new Response(body, {
    headers: {
      'Content-Type': type === 'image/jpeg' ? 'image/jpeg' : 'image/webp',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}

// Most people have no picture, and every chat and leaderboard row asks. The
// answer is cached like a picture is, so asking again is free.
function none() {
  return new Response('No picture', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function serveAvatar(request, env, ctx, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  const uid = url.pathname.slice('/avatars/'.length)
  if (!UID.test(uid)) return none()

  // The edge cache, keyed on the full url. `?v=` is only ever added by the
  // owner's own browser after an upload, to skip a stale copy of their own.
  const cache = caches.default
  const cacheKey = new Request(url.toString(), { method: 'GET' })
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  const { value, metadata } = await env.AVATARS.getWithMetadata(key(uid), {
    type: 'arrayBuffer',
  })
  const res = value ? imageResponse(value, metadata?.type) : none()
  ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}))
  return res
}

// Drops this location's cached copy after a change. Other locations keep
// theirs until it expires, which is what CACHE_SECONDS is short for.
function forget(url, uid) {
  return caches.default
    .delete(new Request(`${url.origin}/avatars/${uid}`, { method: 'GET' }))
    .catch(() => {})
}

// The uid of whoever sent this, from their Firebase sign in token, or a
// Response saying why not.
async function signedIn(request, env) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '')
  let uid
  try {
    uid = await verifyIdToken(token, env.FIREBASE_PROJECT)
  } catch {
    return json({ error: 'Could not check the sign in' }, 503)
  }
  return uid || json({ error: 'Not signed in' }, 401)
}

async function avatarApi(request, env, ctx, url) {
  if (request.method !== 'PUT' && request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const uid = await signedIn(request, env)
  if (uid instanceof Response) return uid

  // The time of the last change rides along as KV metadata. A streamed read
  // fetches only that, not the picture.
  const previous = await env.AVATARS.getWithMetadata(key(uid), { type: 'stream' })
  previous.value?.cancel()
  const last = previous.metadata?.at || 0
  if (Date.now() - last < CHANGE_GAP_MS) return json({ error: 'Too soon' }, 429)

  if (request.method === 'DELETE') {
    await env.AVATARS.delete(key(uid))
    ctx.waitUntil(forget(url, uid))
    return json({ ok: true, uid })
  }

  const claimed = Number(request.headers.get('Content-Length') || 0)
  if (claimed > MAX_BYTES) return json({ error: 'Too big' }, 413)

  // Checked again after reading, since a chunked body has no length up front.
  const body = await request.arrayBuffer()
  if (body.byteLength > MAX_BYTES) return json({ error: 'Too big' }, 413)

  const type = sniff(new Uint8Array(body))
  if (!type) return json({ error: 'Not a picture' }, 415)

  const at = Date.now()
  await env.AVATARS.put(key(uid), body, { metadata: { type, at } })
  ctx.waitUntil(forget(url, uid))

  // `v` is what the owner's browser adds to its own picture's url.
  return json({ ok: true, uid, v: at })
}

async function playtimeApi(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const uid = await signedIn(request, env)
  if (uid instanceof Response) return uid

  const body = await request.json().catch(() => null)
  const { status } = await addPlaytime(env.DB, uid, body)
  return status === 200 ? json({ ok: true }) : json({ error: 'Bad request' }, status)
}

// Public, like the board has always been. `uid` only says which row to find,
// it proves nothing and needs nothing, since everyone's rank is on show.
async function leaderboardApi(request, env, url) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const board = await readBoard(
    env.DB,
    url.searchParams.get('uid'),
    url.searchParams.get('only') === 'me',
  )
  return json(board)
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/api/avatar') return avatarApi(request, env, ctx, url)
    if (url.pathname === '/api/playtime') return playtimeApi(request, env)
    if (url.pathname === '/api/leaderboard') return leaderboardApi(request, env, url)
    if (url.pathname.startsWith('/avatars/')) return serveAvatar(request, env, ctx, url)
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404)

    // Not reached in practice, since only the two prefixes above run this
    // Worker, but a stray request still gets the site rather than an error.
    return env.ASSETS.fetch(request)
  },
}
