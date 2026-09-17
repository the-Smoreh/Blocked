import { useEffect, useRef, useState } from 'react'
import {
  MAX_LENGTH,
  MAX_NAME,
  POLL_MS,
  SEND_INTERVAL_MS,
  cleanName,
  fetchMessages,
  hueFor,
  initialFor,
  probeBackend,
  sendMessage,
  trim,
} from '../chat.js'
import Icon from './Icon.jsx'

// The chat room, shown in place of the wall.
//
// It is deliberately not a route. Picking a category, searching, or reloading
// all leave it, which is what was asked for and falls out of holding the open
// state in App rather than in the url.
//
// Three states: checking for a backend, no backend, and the room itself.

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

function Join({ onJoin }) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('blocked:chatname') || ''
    } catch {
      return ''
    }
  })
  const ok = cleanName(name).length > 0

  return (
    <form
      className="chat-join"
      onSubmit={(e) => {
        e.preventDefault()
        if (ok) onJoin(cleanName(name))
      }}
    >
      <span className="chat-join-glyph" aria-hidden="true">
        <Icon name="chat" size={20} />
      </span>
      <h2>Pick a name</h2>
      <input
        className="chat-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={MAX_NAME}
        autoComplete="off"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <button className="cta" type="submit" disabled={!ok}>
        Enter the room
      </button>
    </form>
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
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)
  const pinnedRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    probeBackend().then((ok) => !cancelled && setLive(ok))
    return () => {
      cancelled = true
    }
  }, [])

  // Poll while the room is open and joined. Long polling or a socket would be
  // better, but this has to work against the smallest possible backend.
  useEffect(() => {
    if (!live || !user) return

    let cancelled = false
    const tick = async () => {
      try {
        const next = await fetchMessages()
        if (!cancelled) {
          setMessages(trim(next))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }

    tick()
    const id = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [live, user])

  // Follow new messages, but only while already at the bottom, so arrivals do
  // not yank the view away from someone reading back.
  useEffect(() => {
    const el = listRef.current
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const onSend = async (text) => {
    setSending(true)
    try {
      await sendMessage(user, text)
      const next = await fetchMessages()
      setMessages(trim(next))
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

  const join = (name) => {
    try {
      localStorage.setItem('blocked:chatname', name)
    } catch {
      // Not being able to remember the name is not worth surfacing.
    }
    setUser(name)
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

      {live === true && !user && <Join onJoin={join} />}

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
            {messages.length === 0 && (
              <li className="chat-empty">Nothing yet. Say the first thing.</li>
            )}
            {messages.map((m) => (
              <Message key={m.id} message={m} mine={m.user === user} />
            ))}
          </ul>

          {error && <p className="chat-error">{error}</p>}
          <Composer onSend={onSend} sending={sending} />
        </>
      )}
    </section>
  )
}
