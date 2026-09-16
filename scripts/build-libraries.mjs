// Builds one library file per upstream source from its public file listing.
//
//   node scripts/build-libraries.mjs             report only
//   node scripts/build-libraries.mjs --write     write public/libraries/*
//   node scripts/build-libraries.mjs --write --only goblin
//
// Design rule: we LINK, we do not copy. Every entry points at the source's own
// hosting, so they serve the game and get the traffic. Nothing is mirrored
// here, which is also why a 14GB asset repo is not a problem.
//
// Each source keeps its own name and its repo URL as credit, written into
// public/libraries/index.json and shown in the app when that library is
// selected.
//
// Note on licences, recorded because it is a real constraint rather than a
// formality: naming a library after its author is attribution, not a licence.
// Several of these repos carry no licence at all, which under default
// copyright means no permission is granted to redistribute. Linking to the
// author's own host is the narrow path that avoids redistributing anything.
// Anyone who asks to be delisted should be delisted.

import { mkdirSync, writeFileSync } from 'node:fs'

const OUT_DIR = new URL('../public/libraries/', import.meta.url)
const write = process.argv.includes('--write')
const onlyAt = process.argv.indexOf('--only')
const only = onlyAt === -1 ? null : process.argv[onlyAt + 1]

// Pages that live alongside the games but are not games.
const NOT_GAMES =
  /^(index|about|about-us|contact|privacy|privacy-policy|terms|dmca|sitemap|404|home|search|games?|apps?|credits|donate|discord|settings|login|signup)$/i

const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)$/i

const SOURCES = [
  {
    id: 'goblin',
    name: 'Goblin Kingdom',
    credit: 'https://github.com/goblinkingdev/unblocked-games',
    author: 'goblinkingdev',
    licence: 'none stated',
    host: 'https://goblinkingdev.github.io/unblocked-games/game/',
    repo: ['goblinkingdev', 'unblocked-games'],
    path: 'game',
    mode: 'files',
  },
  {
    id: 'hell',
    name: 'Hell',
    credit: 'https://github.com/D3ch/hell',
    author: 'D3ch',
    licence: 'none stated',
    host: 'https://d3ch.github.io/hell/Games/',
    repo: ['D3ch', 'hell'],
    path: 'Games',
    // Most entries are folders holding a whole game, a few are loose pages.
    mode: 'dirs+files',
    dirEntry: '',
  },
  {
    id: 'alexx',
    name: 'Alexx743',
    credit: 'https://github.com/Alexx743/Alexx743-games',
    author: 'Alexx743',
    licence: 'none stated',
    // Not GitHub Pages. This repo is deployed to Vercel, which is what serves
    // the games and the thumbnails sitting next to them.
    host: 'https://alexx743-games-unblocked.vercel.app/',
    repo: ['Alexx743', 'Alexx743-games'],
    path: '',
    mode: 'files',
    // Thumbnails ship in the repo as a sibling image per html file.
    siblingThumbs: true,
  },
  {
    id: 'gams',
    name: 'Gams Offline',
    credit: 'https://github.com/Gams-Offline/Gams',
    author: 'Gams-Offline',
    licence: 'none stated',
    host: 'https://gams-offline.github.io/Gams/g/',
    repo: ['Gams-Offline', 'Gams'],
    path: 'g',
    mode: 'files',
  },
]

// Sources checked and deliberately left out, with the reason, so nobody has to
// re-derive this. See CLAUDE.md.
export const REJECTED = [
  {
    name: 'Seraph',
    credit: 'https://github.com/a456pur/seraph',
    games: 494,
    reason:
      'No working public host. a456pur.github.io/seraph/ fails DNS repeatedly and the custom domain seraph.reveriestudios.online has no DNS record.',
  },
  {
    name: 'UGS-Assets',
    credit: 'https://github.com/bubbls/UGS-Assets',
    games: 384,
    reason:
      'No GitHub Pages (404) and its intended delivery is jsDelivr, which serves HTML as text/plain so a browser will not render it in a frame.',
  },
  {
    name: 'Ruby',
    credit: 'https://github.com/ruby-network/ruby',
    games: 68,
    reason:
      'Site returns HTTP 523 and sends X-Frame-Options SAMEORIGIN, so it refuses framing even when up. Its asset repo ruby-network/ruby-assets is 404.',
  },
  {
    name: 'Dropbox folder',
    credit: 'dropbox.com shared folder',
    games: null,
    reason:
      'Dropbox does not serve shared HTML as a rendered page, so a game cannot run in a frame from it. Re-host the contents to use them.',
  },
]

const SMALL = new Set(['a', 'an', 'and', 'の', 'of', 'the', 'to', 'vs', 'v', 'in', 'on', 'for'])

function titleFor(raw) {
  const base = raw.replace(/\.[a-z0-9]+$/i, '')
  const parts = base.split(/[-_\s]+/).filter(Boolean)

  // A single run-together token cannot be split reliably, so leave it alone
  // apart from its first letter. "1v1lol" must not become "1V1Lol".
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)

  return parts
    .map((w, i) => {
      if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase()
      if (/^[A-Z0-9]{2,}$/.test(w)) return w // keep GTA, DOOM, 3D
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

async function listing(repo, path) {
  const url = `https://api.github.com/repos/${repo[0]}/${repo[1]}/contents/${path}?per_page=1000`
  const res = await fetch(url, { headers: { 'user-agent': 'blocked-library-builder' } })
  if (!res.ok) throw new Error(`${repo.join('/')}/${path} returned ${res.status}`)
  return res.json()
}

function buildEntries(src, items) {
  const files = items.filter((x) => x.type === 'file')
  const dirs = items.filter((x) => x.type === 'dir')

  // basename -> image filename, for sources that ship art beside each page.
  const thumbs = new Map()
  if (src.siblingThumbs) {
    for (const f of files) {
      if (!IMAGE.test(f.name)) continue
      thumbs.set(f.name.replace(/\.[a-z0-9]+$/i, '').toLowerCase(), f.name)
    }
  }

  const out = []

  if (src.mode === 'files' || src.mode === 'dirs+files') {
    for (const f of files) {
      if (!/\.html?$/i.test(f.name)) continue
      const base = f.name.replace(/\.[a-z0-9]+$/i, '')
      if (NOT_GAMES.test(base)) continue
      const thumb = thumbs.get(base.toLowerCase())
      out.push({
        title: titleFor(f.name),
        description: '',
        game_image_icon: thumb ? src.host + encodeURIComponent(thumb) : '',
        category: 'Arcade',
        tags: [],
        featured: false,
        url: src.host + encodeURIComponent(f.name),
        source: src.id,
      })
    }
  }

  if (src.mode === 'dirs' || src.mode === 'dirs+files') {
    for (const d of dirs) {
      if (NOT_GAMES.test(d.name) || d.name.startsWith('.')) continue
      out.push({
        title: titleFor(d.name),
        description: '',
        game_image_icon: '',
        category: 'Arcade',
        tags: [],
        featured: false,
        // A trailing slash lets the host resolve its own index file, rather
        // than us guessing index.html for 221 folders.
        url: src.host + encodeURIComponent(d.name) + '/' + (src.dirEntry || ''),
        source: src.id,
      })
    }
  }

  out.sort((a, b) => a.title.localeCompare(b.title))
  return out
}

const index = []
let total = 0

for (const src of SOURCES) {
  if (only && src.id !== only) continue
  try {
    const items = await listing(src.repo, src.path)
    const entries = buildEntries(src, items)
    total += entries.length

    console.log(`${String(entries.length).padStart(4)}  ${src.name.padEnd(16)} ${src.credit}`)
    console.log(`      thumbs: ${entries.filter((e) => e.game_image_icon).length}, host ${src.host}`)

    index.push({
      id: src.id,
      name: src.name,
      author: src.author,
      credit: src.credit,
      licence: src.licence,
      host: src.host,
      count: entries.length,
      file: `libraries/${src.id}.json`,
    })

    if (write) {
      mkdirSync(OUT_DIR, { recursive: true })
      writeFileSync(new URL(`${src.id}.json`, OUT_DIR), JSON.stringify(entries, null, 2) + '\n')
    }
  } catch (e) {
    console.log(`  !!  ${src.name}: ${e.message}`)
  }
}

console.log(`\n${total} games across ${index.length} libraries`)
console.log('\nleft out:')
for (const r of REJECTED) console.log(`  ${r.name}: ${r.reason}`)

if (write) {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(
    new URL('index.json', OUT_DIR),
    JSON.stringify({ libraries: index, rejected: REJECTED }, null, 2) + '\n',
  )
  console.log('\nwrote public/libraries/')
} else {
  console.log('\ndry run, pass --write to save')
}
