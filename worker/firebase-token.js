// Checks a Firebase ID token, which is how the Worker knows who is uploading.
//
// The browser signs in anonymously with Firebase and sends the token it gets
// back. The token is a JWT signed by Google, so checking the signature against
// Google's published keys proves the uid inside it was issued to whoever holds
// it. Without this anyone could overwrite anyone's picture by naming their uid.
//
// Done by hand with WebCrypto because the Firebase admin sdk does not run on
// Workers. The checks are the ones Firebase documents for verifying a token
// with a third party library: the algorithm, the key id, the signature, the
// audience and issuer against our project, and the expiry and issue times.

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

// Anonymous uids are 28 letters and digits. Firebase allows up to 128.
export const UID = /^[A-Za-z0-9]{1,128}$/

// Tolerance for a clock that is a little off, on either side.
const SKEW_SECONDS = 60

// Google rotates these keys every few hours and says how long each set is
// good for in its Cache-Control header. Kept per Worker instance.
let cached = null

async function signingKeys(fresh) {
  if (!fresh && cached && cached.expires > Date.now()) return cached.byKid

  const res = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } })
  if (!res.ok) throw new Error('Could not fetch the signing keys.')

  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1]) || 3600
  const { keys } = await res.json()

  const byKid = new Map()
  for (const jwk of keys) {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    byKid.set(jwk.kid, key)
  }

  cached = { byKid, expires: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 }
  return byKid
}

function bytes(base64url) {
  const padded =
    base64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64url.length + 3) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function json(base64url) {
  return JSON.parse(new TextDecoder().decode(bytes(base64url)))
}

// The uid the token was issued to, or null for anything that does not check
// out. Never throws for a bad token, only for Google's keys being unreachable.
export async function verifyIdToken(token, projectId) {
  if (!projectId || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  let header
  let payload
  try {
    header = json(parts[0])
    payload = json(parts[1])
  } catch {
    return null
  }

  // RS256 only. Accepting whatever the header asks for is the classic way to
  // let an unsigned token through.
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null

  let key = (await signingKeys(false)).get(header.kid)
  // A key id we have not seen may be a rotation since the last fetch.
  if (!key) key = (await signingKeys(true)).get(header.kid)
  if (!key) return null

  let signature
  try {
    signature = bytes(parts[2])
  } catch {
    return null
  }
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed)
  if (!valid) return null

  const now = Math.floor(Date.now() / 1000)
  if (payload.aud !== projectId) return null
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null
  if (typeof payload.exp !== 'number' || payload.exp + SKEW_SECONDS < now) return null
  if (typeof payload.iat !== 'number' || payload.iat - SKEW_SECONDS > now) return null
  if (typeof payload.sub !== 'string' || !UID.test(payload.sub)) return null

  return payload.sub
}
