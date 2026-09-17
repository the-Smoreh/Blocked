// Hand written 24x24 paths, drawn for a 1.7 stroke.
//
// A sprite sheet or an icon package would both mean another request or another
// dependency. Every category has its own glyph: there used to be seven shapes
// for fifteen categories, so Clicker, Horror, IO, Platformer, Retro, Sandbox
// and Shooter all fell through to the arcade cabinet and Adventure reused
// Action's bolt, which made the whole rail look duplicated.
export const PATHS = {
  all: 'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z',
  arcade: 'M6 4h12v3H6zM4 9h16v11H4zm4 3v5m-2-2.5h4m6-2.5h2m-1 4h2',
  puzzle:
    'M10 4h4v2a2 2 0 1 0 4 0V4h2v6h-2a2 2 0 1 0 0 4h2v6h-6v-2a2 2 0 1 0-4 0v2H4v-6h2a2 2 0 1 0 0-4H4V4h6z',
  racing: 'M5 17l2-9h10l2 9M7 17v2m10-2v2M4 12h16M9 8V5h6v3',
  action: 'M13 2L5 14h5l-1 8 8-12h-5z',
  sports: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0v18M3 12h18',
  shooter: 'M12 3v4m0 10v4M3 12h4m10 0h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  strategy: 'M6 3v18M6 4.5h11l-2.5 3.5 2.5 3.5H6z',
  // Peak and sun, for Adventure. A compass was the obvious choice but it is a
  // large circle, and so is the Sports ball, which made the two read alike at
  // the 19px the rail renders them at.
  adventure: 'M3 19h18L13.5 7l-3.2 5.4L8.2 10zM17.5 5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z',
  // Pointer with tap marks, for Clicker.
  clicker: 'M9 5l8 6.5-3.6.7 1.8 4-2 .9-1.8-4L9 16zM4 7l1.6 1.4M3.5 13h2.2M6 18.6L7.5 17',
  // Sheet with a wavy hem, for Horror.
  horror: 'M6 20v-8a6 6 0 0 1 12 0v8l-2.4-1.8L13.2 20 12 18.6 10.8 20 8.4 18.2zM10 11v1.4M14 11v1.4',
  // Three linked nodes, for IO.
  io: 'M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.5 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18.5 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10.6 8.7L7 15m6.4-6.3L17 15M7.5 17h9',
  // Descending ledges with a figure on one, for Platformer.
  platformer: 'M3 20h6v-4h6v-4h6M4.6 16v-2.6h2.6V16',
  // Joystick, for Retro.
  retro: 'M12 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 8.5v4.5M6.5 20l1.8-7h7.4l1.8 7z',
  // Isometric block, for Sandbox.
  sandbox: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12v9M4 7.5l8 4.5 8-4.5',
  star: 'M12 3l2.9 6 6.6 1-4.8 4.6 1.2 6.5L12 18l-5.9 3.1L7.3 14.6 2.5 10l6.6-1z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4.5V12l3.5 2',
  play: 'M8 5l11 7-11 7z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12l4.5 4.5',
  sun: 'M12 5V2m0 20v-3m7-7h3M2 12h3m12.5-5.5L19.6 4.4M4.4 19.6l2.1-2.1m11 0l2.1 2.1M4.4 4.4l2.1 2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  chevron: 'M9 6l6 6-6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  expand: 'M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5',
  external: 'M14 4h6v6M20 4l-8 8M18 14v6H4V6h6',
  back: 'M15 6l-6 6 6 6',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-2.9-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 2.6 15H2.5a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.2-2.9l-.06-.06A2 2 0 1 1 6.58 5.2l.06.06a1.7 1.7 0 0 0 1.87.34H8.6A1.7 1.7 0 0 0 9.7 4.1V4a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.6 1.1h.11a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z',
  close: 'M6 6l12 12M18 6L6 18',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6',
  // Speech bubble with a tail, for the chat room.
  chat: 'M4 5h16v11H9l-4 4v-4H4zM8 9h8M8 12h5',
}

// Category names in the data are free text, so map every one that actually
// occurs. Anything unmapped falls back to a stable pick from the pool rather
// than everything landing on the same glyph.
const BY_CATEGORY = {
  All: 'all',
  Action: 'action',
  Adventure: 'adventure',
  Arcade: 'arcade',
  Clicker: 'clicker',
  Horror: 'horror',
  IO: 'io',
  Platformer: 'platformer',
  Puzzle: 'puzzle',
  Racing: 'racing',
  Retro: 'retro',
  Sandbox: 'sandbox',
  Shooter: 'shooter',
  Sports: 'sports',
  Strategy: 'strategy',

  // Names other sources use for the same thing.
  Shooting: 'shooter',
  Fighting: 'action',
  Driving: 'racing',
  Car: 'racing',
  Idle: 'clicker',
  Emulator: 'retro',
  Flash: 'retro',
  Simulation: 'sandbox',
  Survival: 'sandbox',
  RPG: 'adventure',
}

const FALLBACK_ICONS = [
  'arcade',
  'action',
  'adventure',
  'puzzle',
  'platformer',
  'retro',
  'sandbox',
  'strategy',
]

// A stable, hand assigned tone per category. Hashing would give two
// categories the same colour eventually, and these are few enough to just
// pick. The numbers index --tone-N in styles.css.
const CATEGORY_TONE = {
  All: 0,
  Adventure: 1,
  Arcade: 2,
  Clicker: 3,
  Horror: 4,
  IO: 5,
  Platformer: 6,
  Puzzle: 7,
  Racing: 8,
  Retro: 9,
  Sandbox: 10,
  Shooter: 11,
  Sports: 12,
  Strategy: 13,
  Action: 14,
  // Aliases for category names other sources use.
  Driving: 8,
  Car: 8,
  Shooting: 11,
  Fighting: 14,
}

const TONE_COUNT = 15

export function categoryTone(category) {
  if (CATEGORY_TONE[category] !== undefined) return CATEGORY_TONE[category]
  // An unmapped category still gets a stable colour rather than no colour.
  let h = 0
  for (const ch of String(category || '')) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return h % TONE_COUNT
}

export function categoryIcon(category) {
  if (BY_CATEGORY[category]) return BY_CATEGORY[category]
  // Stable per name, so an unmapped category keeps the same glyph every time
  // rather than every one of them showing the arcade cabinet.
  let h = 0
  for (const ch of String(category || '')) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return FALLBACK_ICONS[h % FALLBACK_ICONS.length]
}

