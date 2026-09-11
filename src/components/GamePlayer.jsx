import { useEffect, useRef, useState } from 'react'

export default function GamePlayer({ game }) {
  const frameRef = useRef(null)
  const [slow, setSlow] = useState(false)

  // Plenty of hosts refuse to be framed, and the iframe gives no error event
  // when they do. Show the escape hatch after a few seconds either way.
  useEffect(() => {
    if (!game) return
    const t = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(t)
  }, [game])

  if (!game) {
    return (
      <div className="state">
        <h2>Game not found</h2>
        <a className="btn" href="#/">
          Back to all games
        </a>
      </div>
    )
  }

  const fullscreen = () => frameRef.current?.requestFullscreen?.()

  return (
    <div className="player">
      <div className="playerbar">
        <a className="btn" href="#/">
          Back
        </a>
        <h1>{game.title}</h1>
        <div className="spacer" />
        <button className="btn" onClick={fullscreen}>
          Fullscreen
        </button>
        <a className="btn" href={game.url} target="_blank" rel="noreferrer">
          New tab
        </a>
      </div>
      <iframe
        ref={frameRef}
        src={game.url}
        title={game.title}
        allow="fullscreen; gamepad; autoplay"
      />
      {slow && (
        <p className="hint">
          Not loading? Some sites refuse to run inside a frame. Use New tab.
        </p>
      )}
    </div>
  )
}
