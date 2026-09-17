import { PATHS } from '../icons.js'

// Solid shapes (the play triangle, the star) read better filled than outlined.
export default function Icon({ name, size = 20, filled = false }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* pathLength normalises every glyph to a total length of 1, so one
          stroke-dasharray rule can draw any of them regardless of how long
          its real path happens to be. Without it each icon would need its own
          measured length. */}
      <path d={PATHS[name] || PATHS.arcade} pathLength="1" />
    </svg>
  )
}
