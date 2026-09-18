import { useEffect, useRef, useState } from 'react'
import { MAX_NAME, cleanName } from '../names.js'
import { saveAccount } from '../account.js'
import Icon from './Icon.jsx'

// Pick a name. The only way an account is ever made.
//
// One component shown in three places: the chat room, the settings sheet and
// the account page. Whichever someone reaches first makes the account, and
// the other two never ask, because they all read the same one. It keeps the
// chat's classes so it looks exactly as the chat's prompt always has.
//
// `focus` rather than autoFocus, because the settings sheet is mounted the
// whole time and only slides in. autoFocus would grab the cursor on page load
// for a box that is off screen, so the sheet passes whether it is open.
export default function AccountPrompt({ action = 'Continue', focus = true }) {
  const [name, setName] = useState('')
  const ok = cleanName(name).length > 0
  const input = useRef(null)

  useEffect(() => {
    if (focus) input.current?.focus({ preventScroll: true })
  }, [focus])

  return (
    <form
      className="chat-join"
      onSubmit={(e) => {
        e.preventDefault()
        if (ok) saveAccount(name)
      }}
    >
      <span className="chat-join-glyph" aria-hidden="true">
        <Icon name="user" size={20} />
      </span>
      <h2>Pick a name</h2>
      <input
        ref={input}
        className="chat-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={MAX_NAME}
        autoComplete="off"
      />
      <button className="cta" type="submit" disabled={!ok}>
        {action}
      </button>
    </form>
  )
}
