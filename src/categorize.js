// Derives a category from a game's title.
//
// Shared by scripts/categorize.mjs, which runs over the json libraries at
// build time, and src/lumin.js, which needs it at runtime: the Lumin API
// returns only id, name and image_token per game, with no category at all,
// and its getCategories() comes back empty. So a title is the only signal
// there is.
//
// These rules are a heuristic, not truth. Order matters, most specific first:
// a game matching both "horror" and "platformer" is a horror game.
//
// A keyword starting with "*" has to land on a word boundary. See STRICT at
// the bottom for why only those few do.

export const RULES = [
  [
    'Horror',
    [
      'fnaf', 'five nights', 'slender', 'granny', 'backrooms', 'baldi', 'bendy',
      'amanda the', 'tattle', 'buckshot', 'horror', 'gloom', 'frights', 'poppy',
      'garten', 'banban', 'scary', 'dark room', 'nightmare', '*evil',
      'resident evil', 'zombie', 'zombotron', 'dead', 'murder', 'creepy',
      'doors', 'silent hill', 'outlast', 'amnesia', 'slenderman',
    ],
  ],
  [
    'IO',
    ['.io', 'agar', 'slither', 'diep', 'shell shock', 'krunker'],
  ],
  [
    'Shooter',
    [
      'gun', 'shoot', 'mayhem', 'doom', 'goldeneye', 'sniper', 'tank', 'war of',
      'counter', 'csgo', 'strike', 'combat', 'soldier', 'bullet', '1v1',
      '*venge', 'rifle', 'pixel warfare', 'time shooter', 'call of duty',
    ],
  ],
  [
    'Racing',
    [
      'drift', 'racing', 'race', 'taxi', 'kart', 'bike', 'truck', 'drive',
      'driving', 'gta', 'moto', '*car', 'traffic', 'speed', 'rally', 'formula',
      'wheels', 'grand truckismo', 'earn to die', 'cluster rush', 'madalin',
      'need for speed', 'burnout', 'hill climb', 'stunt car', 'stuntcar',
    ],
  ],
  [
    'Sports',
    [
      'soccer', 'basketball', 'basket', 'football', 'boxing', '*pool', 'golf',
      'tennis', 'baseball', 'hockey', 'bowling', 'rocket league', 'sports',
      'volleyball', '*dunk', 'penalty', 'retro bowl', 'wrestl', 'skate',
      'fifa', 'nba', 'nfl',
    ],
  ],
  [
    'Clicker',
    [
      'clicker', 'idle', 'miner', 'cookie', 'dogeminer', 'capitalist',
      'anti matter', 'incremental', 'tycoon', 'gold digger', 'breakout',
    ],
  ],
  [
    'Strategy',
    [
      'tower defense', 'bloons', 'advance wars', 'age of war', 'chess',
      'checkers', 'defense', 'corporation', 'evil corp', 'civilization',
      '*risk', 'bitlife', 'tactics', 'plants vs', 'command', 'tower of',
    ],
  ],
  [
    'Puzzle',
    [
      '2048', 'puzzle', 'sudoku', 'tetris', 'factory balls', 'fireboy',
      'cut the rope', 'color switch', 'minesweeper', 'mahjong', 'connect 4',
      '*line', '3 line', 'circloo', 'cell machine', 'bloxorz', 'sokoban',
      'block zapper', 'crossword', '*word', 'wordle', 'rubik', 'deepest sword',
      'achievement unlocked', 'b-cubed', 'move the', '*sort', 'match 3',
      'solitaire',
    ],
  ],
  [
    'Sandbox',
    [
      'minecraft', 'people playground', 'universe sandbox', 'roblox', 'sandbox',
      'creeper craft', 'garry', 'melon', 'crafting', 'terraria', 'craft',
      'simulator', 'tom cat', 'talking tom',
    ],
  ],
  [
    'Adventure',
    [
      'undertale', 'deltarune', 'zelda', 'pokemon', 'baldur', 'rpg',
      'adventure', 'animal crossing', 'hollow knight', 'quest', 'fantasia',
      'chibi knight', 'dungeon', '*story', 'legend', 'final fantasy', 'chrono',
      'kingdom hearts', 'earthbound', 'golden sun', 'fire emblem',
    ],
  ],
  [
    'Platformer',
    [
      'mario', 'celeste', 'cuphead', 'geometry dash', 'geo dash', 'geo jump',
      'geometry rash', 'geometry jump', 'fancy pants', 'dadish', 'doodle jump',
      'getting over it', 'jump', '*run', 'runner', 'running', 'parkour',
      'platform', 'sonic', 'kirby', 'megaman', 'mega man', 'slope', 'vex',
      'stickman', 'super meat', 'fleeing the', 'escaping the', 'happy wheels',
      'draw climber', 'helix', 'tower of hell', 'metroid', 'castlevania',
    ],
  ],
  [
    'Action',
    [
      'fight', 'fighter', 'brawl', 'smash', 'samurai', 'ninja', 'assassin',
      'hobo', 'beat em up', 'tekken', 'mortal', 'street fighter', 'kombat',
      '*action', 'warrior', 'blade', 'katana',
    ],
  ],
  [
    'Retro',
    [
      'sega', 'donkey kong', 'banjo', 'frogger', 'altered beast', 'pinball',
      'gameboy', 'nintendo', 'n64', 'snes', 'gba', 'emulator', 'atari',
      'pac-man', 'pacman', 'arcade classic', 'commodore', 'flash', 'classic',
      'guilty gear', 'advance', '*64', 'playstation', 'ps1', 'gamecube',
      '*nes', 'genesis',
    ],
  ],
]

export const FALLBACK = 'Arcade'

// Matching is substring by default, because several libraries use titles that
// are really folder names with the spaces taken out: "1on1soccer",
// "bloonstowerdefense2", "awesometanks2", "learntoflyidle", "agariolite". A
// word boundary rule cannot see the keyword in any of those.
//
// An earlier version required a boundary on every keyword. It read as the
// careful choice and it was much worse: one library dropped from ten
// categories to two, and across all nine it lost 95 correct matches. It also
// broke ordinary titles, because a boundary rule rejects both plurals and
// sequel numbers: "Awesome Tanks" stopped matching "tank" and "Vex3", "Run3"
// and "Fnaf3" stopped matching at all.
//
// So the boundary is per keyword, not global, and only these fourteen need it.
// Each one is here because of a word that contains it and means something
// else. The alternative of a stemmer or a real classifier is far more than a
// keyword list has to be.
const STRICT = {
  car: 'Icarus, cards, carnival',
  run: 'Sprunki, Sprunked, grunt',
  nes: 'bones, zones, Jones',
  64: 'any longer number',
  line: 'online',
  word: 'sword',
  pool: 'Liverpool',
  story: 'history',
  sort: 'resort, assorted',
  dunk: 'drunk',
  risk: 'Frisk, brisk',
  evil: 'devil',
  action: 'reaction',
  venge: 'revenge',
}

const cache = new Map()

function matcher(keyword) {
  if (cache.has(keyword)) return cache.get(keyword)

  let test
  if (keyword.startsWith('*')) {
    const word = keyword.slice(1)
    // Every strict keyword is plain letters and digits, so nothing here needs
    // escaping. Keep it that way if you add one.
    //
    // A plural s or es and a trailing sequel number still count as the same
    // word, so "car" matches "Cars" and "run" matches "Run3" and
    // "Run3d". Without that the boundary throws away most of what it is
    // meant to keep. The d only counts after a number, because otherwise
    // "car" would match "card".
    const re = new RegExp(`(^|[^a-z0-9])${word}(s|es)?([0-9]+d?)?([^a-z0-9]|$)`)
    test = (hay) => re.test(hay)
  } else {
    test = (hay) => hay.includes(keyword)
  }

  cache.set(keyword, test)
  return test
}

export function categoryFor({ title, description, tags } = {}) {
  const hay = [title, description, ...(Array.isArray(tags) ? tags : [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!hay) return FALLBACK

  for (const [name, keywords] of RULES) {
    if (keywords.some((k) => matcher(k)(hay))) return name
  }
  return FALLBACK
}

// Exported so a test or a one off check can see which keywords are strict and
// why, rather than the reasons living only in a comment.
export { STRICT }
