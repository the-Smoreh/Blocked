import { useEffect, useRef, useState } from 'react'
import { saveAccount, useAccount } from '../account.js'
import { MAX_NAME, cleanName, hueFor } from '../names.js'
import AccountPrompt from './AccountPrompt.jsx'
import Avatar from './Avatar.jsx'
import Icon from './Icon.jsx'

// Your account: the name, how long you have played, and where that puts you.
//
// Without an account this is the same name prompt the chat and the settings
// show, so it is one more way in rather than a separate sign up.
export default function AccountView({ onClose }) {
  const account = useAccount()
  const name = account?.name

  // `undefined` while loading, `null` when the stats could not be fetched.
  const [stats, setStats] = useState(undefined)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // Picture changes. `busy` covers the upload and the removal both.
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [pictureError, setPictureError] = useState(null)

  const changePicture = async (task) => {
    setBusy(true)
    setPictureError(null)
    try {
      const m = await import('../avatar-upload.js')
      await task(m)
    } catch (e) {
      setPictureError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    // Cleared so picking the same file again still fires a change.
    e.target.value = ''
    if (file) changePicture((m) => m.uploadAvatar(file))
  }

  useEffect(() => {
    if (!name) return
    let cancelled = false
    import('../playtime.js')
      .then((m) => Promise.all([m.fetchMine(), m]))
      .then(([mine, m]) => !cancelled && setStats({ ...mine, format: m.formatPlaytime }))
      .catch(() => !cancelled && setStats(null))
    return () => {
      cancelled = true
    }
  }, [name])

  const rename = async (e) => {
    e.preventDefault()
    const next = cleanName(draft)
    if (!next || next === name) {
      setEditing(false)
      return
    }
    saveAccount(next)
    setEditing(false)
    // Only touch the leaderboard if there is a row there to rename. An account
    // that has not played yet should not appear on the board at zero.
    if (stats?.rank != null) {
      import('../playtime.js').then((m) => m.renameEntry(next)).catch(() => {})
    }
  }

  return (
    <section className="chat account">
      <header className="chat-head">
        <span className="chat-title">
          <h2>Account</h2>
        </span>
        <button className="iconbtn" onClick={onClose} title="Close">
          <Icon name="close" />
        </button>
      </header>

      {!account && <AccountPrompt action="Create account" />}

      {account && (
        <div className="account-card" style={{ '--u': hueFor(name) }}>
          <Avatar className="account-avatar" uid={account.uid} name={name} mine />

          {editing ? (
            <form className="account-rename" onSubmit={rename}>
              <input
                className="chat-name"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_NAME}
                autoComplete="off"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <div className="stack">
                <button className="btn" type="button" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button className="cta" type="submit" disabled={!cleanName(draft)}>
                  Save
                </button>
              </div>
            </form>
          ) : (
            <>
              <strong className="account-name">{name}</strong>
              <div className="account-actions">
                <button
                  className="btn"
                  onClick={() => {
                    setDraft(name)
                    setEditing(true)
                  }}
                >
                  Change name
                </button>
                <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? 'Saving...' : account.avatar ? 'Change picture' : 'Add picture'}
                </button>
                {account.avatar && (
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => changePicture((m) => m.removeAvatar())}
                  >
                    Remove picture
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onFile}
              />
              {pictureError && <p className="account-error">{pictureError}</p>}
            </>
          )}

          <div className="account-stats">
            <div className="account-stat">
              <b>{stats === undefined ? '...' : stats ? stats.format(stats.seconds) : 'n/a'}</b>
              <span>Time played</span>
            </div>
            <div className="account-stat">
              <b>
                {stats === undefined
                  ? '...'
                  : !stats
                    ? 'n/a'
                    : stats.rank != null
                      ? `#${stats.rank}`
                      : 'Unranked'}
              </b>
              <span>Rank</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
