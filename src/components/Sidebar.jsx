import Icon from './Icon.jsx'
import { categoryIcon, categoryTone } from '../icons.js'

export default function Sidebar({ categories, category, onCategory, open, onClose, counts }) {
  return (
    <>
      <div className={open ? 'rail-scrim on' : 'rail-scrim'} onClick={onClose} />
      <aside className={open ? 'rail open' : 'rail'}>
        <nav>
          {categories.map((c) => (
            <button
              key={c}
              className={c === category ? 'rail-item on' : 'rail-item'}
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
      </aside>
    </>
  )
}
