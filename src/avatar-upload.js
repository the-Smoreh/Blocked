// Changing your profile picture. Loaded only when someone picks a file, since
// it pulls in Firebase for the sign in token.
//
// The picture is cropped to a square and shrunk to 160px here, in the browser,
// before it is sent. A phone photo is several megabytes and the Worker takes
// 64KB, and nobody's badge is ever shown bigger than 76px anyway.

import { idToken } from './fbclient.js'
import { updateAccount } from './account.js'

const SIZE = 160

const API = `${import.meta.env.BASE_URL}api/avatar`

const MESSAGES = {
  401: 'Could not sign in. Try again.',
  413: 'That picture is too big.',
  415: 'That file is not a picture.',
  429: 'Wait a few seconds and try again.',
}

async function square(file) {
  if (!file.type.startsWith('image/')) throw new Error('That file is not a picture.')

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That file is not a picture.')
  }

  // The middle square, so a tall or wide photo is cropped rather than squashed.
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  )
  bitmap.close?.()

  const encode = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.86))

  // WebP keeps transparency and is smaller. A browser that cannot write it
  // quietly hands back a PNG instead, which is why the type is checked.
  const webp = await encode('image/webp')
  if (webp?.type === 'image/webp') return webp

  // JPEG has no transparency, so a see-through picture would come out black.
  // Paint a dark ground under it first.
  const flat = document.createElement('canvas')
  flat.width = SIZE
  flat.height = SIZE
  const fctx = flat.getContext('2d')
  fctx.fillStyle = '#16161b'
  fctx.fillRect(0, 0, SIZE, SIZE)
  fctx.drawImage(canvas, 0, 0)
  const jpeg = await new Promise((resolve) => flat.toBlob(resolve, 'image/jpeg', 0.86))
  if (!jpeg) throw new Error('Could not read that picture.')
  return jpeg
}

async function send(method, body) {
  const token = await idToken()
  if (!token) throw new Error(MESSAGES[401])

  let res
  try {
    res = await fetch(API, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': body.type } : {}),
      },
      body,
    })
  } catch {
    throw new Error('Could not reach the server. Try again.')
  }

  // A host without the Worker, like the plain dev server or a static mirror,
  // answers with its own page or an error that is not ours.
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  if (!isJson) throw new Error('Pictures do not work on this link.')
  if (!res.ok) throw new Error(MESSAGES[res.status] || 'That did not work. Try again.')
  return res.json()
}

export async function uploadAvatar(file) {
  const picture = await square(file)
  const { uid, v } = await send('PUT', picture)
  updateAccount({ uid, avatar: v })
}

export async function removeAvatar() {
  const { uid } = await send('DELETE')
  updateAccount({ uid, avatar: undefined })
}
