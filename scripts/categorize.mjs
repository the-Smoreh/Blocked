// Assigns a category to every game in public/games.json by matching keywords
// against the title, description and tags.
//
// Why this exists: the imported library has all 450 games labelled "Arcade",
// so the category rail had exactly one entry and was dead weight. These rules
// are a heuristic, not truth. The original label is kept as `category_raw` so
// nothing is lost, and re-running is safe because the raw value is what gets
// matched against, never the derived one.
//
//   node scripts/categorize.mjs            report only, writes nothing
//   node scripts/categorize.mjs --write     writes public/games.json
//   node scripts/categorize.mjs --file libraries/goblin.json --write
//       --file takes a path under public/, so the per source libraries can be
//       categorized the same way as the built in list
//
// To correct a game, add a word from its title to the right rule below, or set
// its category by hand in games.json and add the title to KEEP.

import { readFileSync, writeFileSync } from 'node:fs'

const fileAt = process.argv.indexOf('--file')
const REL = fileAt === -1 ? 'games.json' : process.argv[fileAt + 1]
const FILE = new URL(`../public/${REL}`, import.meta.url)

// Titles whose hand set category must never be overwritten.
const KEEP = new Set([])

// Order matters. The first rule that matches wins, so narrow themes come
// before broad ones: Horror before Platformer, Retro before Arcade.
const RULES = [
  [
    'Horror',
    [
      'fnaf', 'five nights', 'slender', 'granny', 'backrooms', 'baldi', 'bendy',
      'amanda the', 'tattle', 'buckshot', 'horror', 'gloom', 'frights', 'poppy',
      'garten', 'banban', 'scary', 'dark room', 'nightmare', 'evil', 'zombie',
      'dead', 'murder', 'creepy', 'doors',
    ],
  ],
  [
    'Shooter',
    [
      'gun', 'shoot', 'mayhem', 'doom', 'goldeneye', 'sniper', 'tank', 'war of',
      'krunker', 'counter', 'csgo', 'strike', 'combat', 'soldier', 'bullet',
      '1v1', 'venge', 'rifle', 'pixel warfare', 'time shooter',
    ],
  ],
  [
    'Racing',
    [
      'drift', 'racing', 'race', 'taxi', 'kart', 'bike', 'truck', 'drive',
      'driving', 'gta', 'moto', 'car', 'traffic', 'speed', 'rally', 'formula',
      'wheels', 'grand truckismo', 'earn to die', 'cluster rush', 'madalin',
    ],
  ],
  [
    'Sports',
    [
      'soccer', 'basketball', 'basket', 'football', 'boxing', 'pool', 'golf',
      'tennis', 'baseball', 'hockey', 'bowling', 'rocket league', 'sports',
      'volleyball', 'dunk', 'penalty', 'retro bowl', 'wrestl',
    ],
  ],
  [
    'Clicker',
    [
      'clicker', 'idle', 'miner', 'cookie', 'dogeminer', 'capitalist',
      'anti matter', 'incremental', 'tycoon', 'simulator clicker', 'gold digger',
    ],
  ],
  [
    'Strategy',
    [
      'tower defense', 'bloons', 'advance wars', 'age of war', 'chess',
      'checkers', 'defense', 'corp', 'civilization', 'risk', 'bitlife',
      'tactics', 'plants vs',
    ],
  ],
  [
    'Puzzle',
    [
      '2048', 'puzzle', 'sudoku', 'tetris', 'factory balls', 'fireboy',
      'cut the rope', 'color switch', 'minesweeper', 'mahjong', 'connect 4',
      'line', 'circloo', 'cell machine', 'bloxorz', 'sokoban', 'block zapper',
      'crossword', 'word', 'rubik', '9007199254740992', 'deepest sword',
      'achievement unlocked', 'b-cubed', 'move the',
    ],
  ],
  [
    'Sandbox',
    [
      'minecraft', 'people playground', 'universe sandbox', 'roblox', 'sandbox',
      'creeper craft', 'garry', 'melon', 'crafting', 'terraria', 'craft',
    ],
  ],
  [
    'Adventure',
    [
      'undertale', 'deltarune', 'zelda', 'pokemon', 'baldur', 'rpg',
      'adventure', 'animal crossing', 'hollow knight', 'quest', 'fantasia',
      'chibi knight', 'dungeon', 'story', 'legend',
    ],
  ],
  [
    'Platformer',
    [
      'mario', 'celeste', 'cuphead', 'geometry dash', 'geo dash', 'geo jump',
      'geometry rash', 'fancy pants', 'dadish', 'doodle jump', 'getting over it',
      'jump', 'run', 'platform', 'sonic', 'kirby', 'megaman', 'mega man',
      'slope', 'vex', 'stickman', 'super meat', 'fleeing the', 'escaping the',
      'happy wheels', 'draw climber', 'helix', 'tower of hell',
    ],
  ],
  [
    'Retro',
    [
      'sega', 'donkey kong', 'banjo', 'frogger', 'altered beast', 'pinball',
      'gameboy', 'nintendo', 'n64', 'snes', 'gba', 'emulator', 'atari',
      'pac-man', 'pacman', 'arcade classic', 'commodore', 'flash', 'classic',
      'guilty gear', 'advance', '64',
    ],
  ],
  [
    'IO',
    ['.io', 'agar', 'slither', 'diep', 'paper.io', 'shell shock'],
  ],
]

function haystack(game) {
  return [game.title, game.description, ...(game.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function categorize(game) {
  const hay = haystack(game)
  for (const [name, words] of RULES) {
    if (words.some((w) => hay.includes(w))) return name
  }
  return 'Arcade'
}

const write = process.argv.includes('--write')
const games = JSON.parse(readFileSync(FILE, 'utf8'))
const counts = {}
let changed = 0

for (const game of games) {
  // Preserve the imported label once, and always match against it so the
  // script is idempotent.
  if (game.category_raw === undefined) game.category_raw = game.category ?? null

  const next = KEEP.has(game.title) ? game.category : categorize(game)
  if (next !== game.category) changed++
  game.category = next
  counts[next] = (counts[next] || 0) + 1
}

const report = Object.entries(counts).sort((a, b) => b[1] - a[1])
console.log(`${REL}: ${games.length} games, ${changed} recategorized\n`)
for (const [name, n] of report) {
  console.log(`  ${String(n).padStart(4)}  ${name}`)
}

if (write) {
  writeFileSync(FILE, JSON.stringify(games, null, 2) + '\n')
  console.log(`\nwrote public/${REL}`)
} else {
  console.log('\ndry run, pass --write to save')
}
