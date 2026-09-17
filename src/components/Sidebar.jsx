import Icon from './Icon.jsx'
import { categoryIcon, categoryTone } from '../icons.js'

export default function Sidebar({
  categories,
  category,
  onCategory,
  open,
  onClose,
  counts,
  chatOpen,
  onChat,
}) {
  return (
    <>
      <div className={open ? 'rail-scrim on' : 'rail-scrim'} onClick={onClose} />
      <aside className={open ? 'rail open' : 'rail'}>
        <nav>
          {categories.map((c) => (
            <button
              key={c}
              className={c === category && !chatOpen ? 'rail-item on' : 'rail-item'}
              data-tone={categoryTone(c)}
              onClick={() => {
                onCategory(c)
                onClose()
              }}
            >
              <Icon name={c === 'All' ? 'all' : categoryIcon(c)} size={19} />
              <span className="rail-label">{c}</span>
              <span className="rail-count">{counts[c]}</span>
            </button>
          ))}
        </nav>

        {/* Pinned to the bottom of the rail, below the categories, because it
            is not one of them: it does not filter the wall, it replaces it. */}
        <div className="rail-foot">
          <button
            className={chatOpen ? 'rail-item chat-open on' : 'rail-item chat-open'}
            onClick={() => {
              onChat()
              onClose()
            }}
          >
            <Icon name="chat" size={19} />
            <span className="rail-label">Chat room</span>
          </button>
        </div>
      </aside>
    </>
  )
}
