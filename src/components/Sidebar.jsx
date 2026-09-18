import Icon from './Icon.jsx'
import { categoryIcon, categoryTone } from '../icons.js'
import { useAccount } from '../account.js'

// The places that replace the wall rather than filter it, pinned under the
// categories because they are not categories.
const VIEWS = [
  { id: 'account', icon: 'user', label: 'Account' },
  { id: 'chat', icon: 'chat', label: 'Chat room' },
  { id: 'leaderboard', icon: 'trophy', label: 'Leaderboard' },
]

export default function Sidebar({
  categories,
  category,
  onCategory,
  open,
  onClose,
  counts,
  view,
  onView,
}) {
  // Once there is an account its row shows the name, which doubles as the
  // quickest way to see that you are signed in.
  const account = useAccount()

  return (
    <>
      <div className={open ? 'rail-scrim on' : 'rail-scrim'} onClick={onClose} />
      <aside className={open ? 'rail open' : 'rail'}>
        <nav>
          {categories.map((c) => (
            <button
              key={c}
              className={c === category && !view ? 'rail-item on' : 'rail-item'}
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

        <div className="rail-foot">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={view === v.id ? 'rail-item rail-view on' : 'rail-item rail-view'}
              onClick={() => {
                onView(v.id)
                onClose()
              }}
            >
              <Icon name={v.icon} size={19} />
              <span className="rail-label">
                {v.id === 'account' && account ? account.name : v.label}
              </span>
            </button>
          ))}
        </div>
      </aside>
    </>
  )
}
