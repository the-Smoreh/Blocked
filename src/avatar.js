// Where a profile picture lives, for anyone's uid.
//
// Deliberately free of Firebase, like account.js, because the rail shows your
// own picture on every page. Uploading is in avatar-upload.js, which is only
// loaded when someone actually picks a file.
//
// Nobody's picture is known in advance. A chat or leaderboard row just asks
// for /avatars/<uid>, and most answer 404, which the Worker and the browser
// both cache. See worker/index.js.

const BASE = import.meta.env.BASE_URL

const UID = /^[A-Za-z0-9]{1,128}$/

// Uids that answered 404 this visit, so a chat re-render does not ask again.
const missing = new Set()

// `version` is only passed for your own picture, straight after changing it,
// so you see the new one at once instead of a copy cached before the change.
export function avatarSrc(uid, version) {
  if (!uid || !UID.test(uid)) return null
  if (!version && missing.has(uid)) return null
  return `${BASE}avatars/${uid}${version ? `?v=${version}` : ''}`
}

export function markMissing(uid) {
  missing.add(uid)
}
