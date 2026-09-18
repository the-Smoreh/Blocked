import { useEffect, useState } from 'react'
import { fetchBoard, formatPlaytime } from '../playtime.js'
import { hueFor } from '../names.js'
import Avatar from './Avatar.jsx'
import Icon from './Icon.jsx'

// Time played, most first.
//
// Read once when opened rather than listened to. Every account playing a book
// writes about once a minute, so a live listener would re-read the board for
// every open window on every one of those writes, which is a lot of the free
// read allowance spent on a list that does not need to be live.

function Row({ row }) {
  return (
    <li className={row.mine ? 'board-row mine' : 'board-row'} style={{ '--u': hueFor(row.name) }}>
      <span className="board-rank">{row.rank}</span>
      <Avatar uid={row.uid} name={row.name} mine={row.mine} />
      <span className="board-name">{row.name}</span>
      <span className="board-time">{formatPlaytime(row.seconds)}</span>
    </li>
  )
}

export default function Leaderboard({ onClose }) {
  const [state, setState] = useState({ loading: true, rows: [], me: null, failed: false })

  useEffect(() => {
    let cancelled = false
    fetchBoard()
      .then(({ rows, me }) => !cancelled && setState({ loading: false, rows, me, failed: false }))
      .catch(() => !cancelled && setState({ loading: false, rows: [], me: null, failed: true }))
    return () => {
      cancelled = true
    }
  }, [])

  // Your own row is repeated at the bottom when it is not on the board, so you
  // can always see where you stand without scrolling for it.
  const offBoard = state.me && !state.rows.some((r) => r.mine)

  return (
    <section className="chat board">
      <header className="chat-head">
        <span className="chat-title">
          <h2>Leaderboard</h2>
        </span>
        <button className="iconbtn" onClick={onClose} title="Close">
          <Icon name="close" />
        </button>
      </header>

      {state.loading && (
        <div className="chat-state">
          <span className="spinner" />
        </div>
      )}

      {state.failed && (
        <div className="chat-state chat-off">
          <span className="chat-join-glyph" aria-hidden="true">
            <Icon name="trophy" size={20} />
          </span>
          <h3>Leaderboard is down</h3>
        </div>
      )}

      {!state.loading && !state.failed && (
        <ol className="board-list">
          {state.rows.length === 0 && <li className="chat-empty">Nobody yet.</li>}
          {state.rows.map((row) => (
            <Row key={row.uid} row={row} />
          ))}
          {offBoard && (
            <>
              <li className="board-gap" aria-hidden="true" />
              <Row row={state.me} />
            </>
          )}
        </ol>
      )}
    </section>
  )
}
