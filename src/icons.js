// Hand written 24x24 paths. A sprite sheet or an icon package would both mean
// another request or another dependency for nine glyphs.
export const PATHS = {
  all: 'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z',
  arcade: 'M6 4h12v3H6zM4 9h16v11H4zm4 3v5m-2-2.5h4m6-2.5h2m-1 4h2',
  puzzle:
    'M10 4h4v2a2 2 0 1 0 4 0V4h2v6h-2a2 2 0 1 0 0 4h2v6h-6v-2a2 2 0 1 0-4 0v2H4v-6h2a2 2 0 1 0 0-4H4V4h6z',
  racing: 'M5 17l2-9h10l2 9M7 17v2m10-2v2M4 12h16M9 8V5h6v3',
  action: 'M13 2L5 14h5l-1 8 8-12h-5z',
  sports: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0v18M3 12h18',
  shooting: 'M12 3v4m0 10v4M3 12h4m10 0h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  strategy: 'M12 3l3 5h-6zM5 11h14l-2 9H7zM9 15h6',
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
}

// Category names in games.json are free text, so map the ones that exist and
// fall back rather than showing a gap.
const BY_CATEGORY = {
  All: 'all',
  Arcade: 'arcade',
  Puzzle: 'puzzle',
  Racing: 'racing',
  Action: 'action',
  Sports: 'sports',
  Shooting: 'shooting',
  Strategy: 'strategy',
  Driving: 'racing',
  Car: 'racing',
  Adventure: 'action',
}

export function categoryIcon(category) {
  return BY_CATEGORY[category] || 'arcade'
}

