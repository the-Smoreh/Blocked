import { useEffect, useRef, useState } from 'react'
import {
  MAX_LENGTH,
  SEND_INTERVAL_MS,
  connect,
  hueFor,
  initialFor,
  sendMessage,
  watchMessages,
} from '../chat.js'
import { useAccount } from '../account.js'
import AccountPrompt from './AccountPrompt.jsx'
import Icon from './Icon.jsx'

// The chat room, shown in place of the wall.
//
// It is deliberately not a route. Picking a category, searching, or reloading
// all leave it, which is what was asked for and falls out of holding the open
// state in App rather than in the url.
//
// Three states: connecting, not connected, and the room itself.
//
// Messages arrive through a Firestore listener rather than being polled, so
// there is no interval in here and nothing to tune. A message appears the
// moment it is written.

function Stamp({ at }) {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return null
  return (
    <time dateTime={at}>
      {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </time>
  )
}

function Message({ message, mine }) {
  return (
    <li className={mine ? 'msg mine' : 'msg'} style={{ '--u': hueFor(message.user) }}>
      <span className="msg-badge" aria-hidden="true">
        {initialFor(message.user)}
      </span>
      <span className="msg-body">
        <span className="msg-head">
          <b>{message.user}</b>
          <Stamp at={message.at} />
        </span>
        {/* Rendered as text, never as markup. Everything in here was typed by
            someone else. */}
        <span className="msg-text">{message.text}</span>
      </span>
    </li>
  )
}

function Composer({ onSend, sending }) {
  const [text, setText] = useState('')
  const [wait, setWait] = useState(0)
  const lastRef = useRef(0)

  // Counts down to when the next message is allowed, so the limit is visible
  // rather than the button just refusing.
  useEffect(() => {
    if (!wait) return
    const id = setInterval(() => {
      const left = Math.max(0, SEND_INTERVAL_MS - (Date.now() - lastRef.current))
      setWait(left)
    }, 100)
    return () => clearInterval(id)
  }, [wait])

  const submit = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return

    const since = Date.now() - lastRef.current
    if (since < SEND_INTERVAL_MS) {
      setWait(SEND_INTERVAL_MS - since)
      return
    }

    const ok = await onSend(body)
    if (ok) {
      setText('')
      lastRef.current = Date.now()
      setWait(SEND_INTERVAL_MS)
    }
  }

  const left = MAX_LENGTH - text.length

  return (
    <form className="chat-compose" onSubmit={submit}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
        placeholder={wait ? 'Just a second' : 'Say something'}
        maxLength={MAX_LENGTH}
        autoComplete="off"
      />
      {left < 60 && <span className="chat-left">{left}</span>}
      <button className="cta" type="submit" disabled={!text.trim() || sending || wait > 0}>
        {wait > 0 ? `${(wait / 1000).toFixed(1)}s` : 'Send'}
      </button>
    </form>
  )
}

export default function ChatRoom({ onClose }) {
  // null while the probe is still running, then true or false.
  const [live, setLive] = useState(null)
  // The account's name. If there is one the room opens straight away, with no
  // prompt, because the name was already given somewhere else on the site.
  const user = useAccount()?.name ?? null
  const [messages, setMessages] = useState([])
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)
  const pinnedRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    connect().then((ok) => !cancelled && setLive(ok))
    return () => {
      cancelled = true
    }
  }, [])

  // One listener for as long as the room is open. Firestore hands over every
  // change as it happens, so this replaces what used to be a three second
  // poll.
  useEffect(() => {
    if (!live || !user) return

    const stop = watchMessages(
      (rows) => {
        setMessages(rows)
        setError(null)
      },
      (message) => setError(message),
    )

    return stop
  }, [live, user])

  // Follow new messages, but only while already at the bottom, so arrivals do
  // not yank the view away from someone reading back.
  useEffect(() => {
    const el = listRef.current
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // No refetch after sending: the listener delivers our own message along
  // with everyone else's, so asking for the list again would only duplicate
  // work the snapshot has already done.
  const onSend = async (text) => {
    setSending(true)
    try {
      await sendMessage(user, text)
      setError(null)
      pinnedRef.current = true
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="chat">
      <header className="chat-head">
        <span className="chat-title">
          <h2>Chat room</h2>
        </span>
        {live && user && (
          <span className="chat-me" style={{ '--u': hueFor(user) }}>
            <span className="msg-badge" aria-hidden="true">
              {initialFor(user)}
            </span>
            {user}
          </span>
        )}
        <button className="iconbtn" onClick={onClose} title="Close the room">
          <Icon name="close" />
        </button>
      </header>

      {live === null && (
        <div className="chat-state">
          <span className="spinner" />
        </div>
      )}

      {/* No explanation. Why it is down is our problem, not the reader's. */}
      {live === false && (
        <div className="chat-state chat-off">
          <span className="chat-join-glyph" aria-hidden="true">
            <Icon name="chat" size={20} />
          </span>
          <h3>Chat room is down</h3>
        </div>
      )}

      {/* Making the account here makes it for the whole site. */}
      {live === true && !user && <AccountPrompt action="Enter the room" />}

      {live === true && user && (
        <>
          <ul
            className="chat-list"
            ref={listRef}
            onScroll={(e) => {
              const el = e.currentTarget
              pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
            }}
          >
            {/* Only when the room is genuinely empty. Showing "nothing yet"
                next to a read error said two contradictory things at once:
                the list is not empty, it could not be read. */}
            {messages.length === 0 && !error && (
              <li className="chat-empty">Nothing yet. Say the first thing.</li>
            )}
            {/* `mine` comes off the message's own uid rather than from
                comparing names, so two people picking the same name are no
                longer mistaken for each other. */}
            {messages.map((m) => (
              <Message key={m.id} message={m} mine={m.mine} />
            ))}
          </ul>

          {error && <p className="chat-error">{error}</p>}
          <Composer onSend={onSend} sending={sending} />
        </>
      )}
    </section>
  )
}
