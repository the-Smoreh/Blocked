import { useState } from 'react'
import { useAccount } from '../account.js'
import { avatarSrc, markMissing } from '../avatar.js'
import { initialFor } from '../names.js'

// Someone's badge: their initial, with their picture laid over it if they have
// one. The initial is always there underneath, so a missing or slow picture
// shows the same badge the site always had, never a broken image.
//
// The colour comes from `--u` on whatever contains it, as before.
export default function Avatar({ uid, name, mine = false, className = 'msg-badge', style }) {
  const account = useAccount()
  const own = mine || (uid && uid === account?.uid)

  // Your own is only asked for when you have one, and with its version, so a
  // change shows at once. Anyone else's is always asked for.
  const src = own ? (account?.avatar ? avatarSrc(uid, account.avatar) : null) : avatarSrc(uid)

  // The src that failed, rather than a flag, so a new picture gets a fresh try.
  const [failed, setFailed] = useState(null)

  return (
    <span className={className} style={style} aria-hidden="true">
      {initialFor(name)}
      {src && failed !== src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
          onError={() => {
            setFailed(src)
            if (!own) markMissing(uid)
          }}
        />
      )}
    </span>
  )
}
