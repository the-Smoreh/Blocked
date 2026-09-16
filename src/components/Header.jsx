import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'

export default function Header({ query, onQuery, onSettings, onMenu, count, showMenu }) {
  const inputRef = useRef(null)

  // "/" jumps to search, the shortcut every site with a search box has.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onQuery('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onQuery])

  return (
    <header>
      <div className="bar">
        {showMenu && (
          <button className="iconbtn only-narrow" onClick={onMenu} title="Categories">
            <Icon name="menu" />
          </button>
        )}

        <a className="brand" href="#/">
          <span className="brandmark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Blocked
        </a>

        <div className="searchwrap">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            className="search"
            type="search"
            value={query}
            placeholder={`Search ${count} games`}
            onChange={(e) => onQuery(e.target.value)}
          />
          {query ? (
            <button className="clear" onClick={() => onQuery('')} title="Clear">
              &times;
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>

        <button className="iconbtn" onClick={onSettings} title="Settings">
          <Icon name="settings" />
        </button>
      </div>
    </header>
  )
}
