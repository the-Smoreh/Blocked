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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

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
  {
    id: 'selenite',
    name: 'Selenite',
    credit: 'https://music.lyrica24.top/',
    author: 'Selenite',
    licence: 'none stated',
    host: 'https://music.lyrica24.top/resources/semag/',
    // Not a GitHub repo. This site publishes its own catalogue, so the whole
    // library comes from one request instead of a directory listing, and it
    // brings real titles, real per game covers and real tags with it.
    catalogue: 'https://music.lyrica24.top/resources/games.json',
  },
  {
    id: 'nova',
    name: 'Nova Arcade',
    credit: 'https://github.com/Beefalo1234/nova-arcade',
    author: 'Beefalo1234',
    licence: 'WTFPL',
    host: 'https://beefalo1234.github.io/nova-arcade/games/',
    repo: ['Beefalo1234', 'nova-arcade'],
    path: 'games',
    mode: 'dirs',
  },
  {
    id: 'p0xx',
    name: 'p0xx',
    credit: 'https://github.com/p0xx/p0xx.github.io',
    author: 'p0xx',
    licence: 'none stated',
    host: 'https://p0xx.github.io/g/games/',
    repo: ['p0xx', 'p0xx.github.io'],
    path: 'g/games',
    mode: 'files',
    // A second folder of emulator titles sits under the first.
    extraPaths: [{ path: 'g/games/retro', prefix: 'retro/' }],
  },
  {
    id: 'astro',
    name: 'Astro v2',
    credit: 'https://github.com/MNblocker/Astro-v2',
    author: 'MNblocker',
    licence: 'NOASSERTION',
    host: 'https://mnblocker.github.io/Astro-v2/Games/',
    repo: ['MNblocker', 'Astro-v2'],
    path: 'Games',
    mode: 'dirs',
    // Folders are named after the import that produced them, so
    // "MNblocker 3kh0-Assets main DogeMiner" has to become "DogeMiner".
    stripPrefix: /^MNblocker\s+3kh0-Assets\s+main\s+/i,
  },
  {
    id: 'amplify',
    name: 'Amplify',
    credit: 'https://github.com/joeyc1pro/amplify-home-xyz',
    author: 'joeyc1pro',
    licence: 'none stated',
    host: 'https://joeyc1pro.github.io/amplify-home-xyz/lessons/',
    repo: ['joeyc1pro', 'amplify-home-xyz'],
    path: 'lessons',
    mode: 'dirs',
    // Folders are deliberately disguised as g1..g81, so the only real name
    // is inside each page. Fetch it.
    resolveTitles: true,
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
  {
    name: 'PeteZah',
    credit: 'https://github.com/PeteZah-Games/PeteZahStatic',
    games: 156,
    reason:
      'Every path on petezahgames.com redirects to /verify?reason=activity, a bot check, and their Pages domain redirects there too. A framed game would show the check, not the game. Working around it is not on the table.',
  },
  {
    name: 'PLEXILEARCADE',
    credit: 'https://github.com/knwzero/PLEXILEARCADE',
    games: 248,
    reason:
      'No GitHub Pages (404) and plexilearcade.net no longer resolves, so its 248 games have nowhere to be served from.',
  },
  {
    name: 'julianlockibarra-cat/games',
    credit: 'https://github.com/julianlockibarra-cat/games',
    games: null,
    reason:
      'GitHub Pages is not enabled and there is no other host, so UNITY GAMES, FLASH GAMES and the third folder cannot be served.',
  },
  {
    name: 'schplay',
    credit: 'https://github.com/paralzyed/schplay.github.io',
    games: 0,
    reason:
      'The repo is empty apart from site pages (allgames, blog, flash, fps). It holds no game files, so there is nothing to index.',
  },
]

// Selenite tags every game, so its categories come from those rather than
// from keyword matching on the title. Order matters: a game tagged both
// "horror" and "platformer" is a horror game first.
const TAG_CATEGORY = [
  ['Horror', ['horror', 'gore']],
  ['IO', ['io']],
  ['Strategy', ['tower-defense', 'strategy', 'tycoon']],
  ['Racing', ['racing']],
  ['Sports', ['sports']],
  ['Shooter', ['fps', 'shooter']],
  ['Platformer', ['metroidvania', 'platformer']],
  ['Puzzle', ['puzzle', 'point-and-click', 'word', 'card']],
  ['Clicker', ['idle']],
  ['Sandbox', ['sandbox', 'farming', 'survival']],
  ['Adventure', ['rpg', 'visual novel', 'adventure']],
  ['Retro', ['emulator', 'flash', 'pinball']],
  ['Action', ['fighting', 'beat-em-up', 'stealth', 'roguelike', 'action']],
]

function categoryFromTags(tags = []) {
  const set = new Set(tags.map((t) => String(t).toLowerCase()))
  for (const [name, keys] of TAG_CATEGORY) {
    if (keys.some((k) => set.has(k))) return name
  }
  return 'Arcade'
}

async function fromCatalogue(src) {
  const res = await fetch(src.catalogue, { headers: { 'user-agent': 'blocked-library-builder' } })
  if (!res.ok) throw new Error(`${src.catalogue} returned ${res.status}`)
  const rows = await res.json()

  return rows
    .filter((r) => r && r.name && r.directory)
    .map((r) => ({
      title: String(r.name).trim(),
      description: '',
      // The cover filename differs per game, webp, png, jpg, ico, avif and
      // svg all appear, so it has to come from the data. Assuming cover.png
      // would miss most of them.
      game_image_icon: r.image
        ? src.host + encodeURIComponent(r.directory) + '/' + encodeURIComponent(r.image)
        : '',
      category: categoryFromTags(r.tags),
      tags: Array.isArray(r.tags) ? r.tags : [],
      // "top" is the site's own featured marker.
      featured: Array.isArray(r.tags) && r.tags.includes('top'),
      url: src.host + encodeURIComponent(r.directory) + '/index.html',
      source: src.id,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

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

// Some sources name folders after the import that produced them. The URL
// still needs the real folder name, only the title is cleaned.
function stripped(src, name) {
  return src.stripPrefix ? name.replace(src.stripPrefix, '') : name
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

function cleanPageTitle(raw) {
  let t = raw.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
  t = t.replace(/\s+/g, ' ').trim()
  if (t.length > 52) {
    // Cut at a separator rather than mid word.
    const cut = t.slice(0, 52)
    const at = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('|'), cut.lastIndexOf('-'))
    t = (at > 20 ? cut.slice(0, at) : cut).trim()
  }
  return t
}

// Folders named g1..g81 carry no information, so the only real name is the
// page's own <title>. Fetch them with a small pool.
async function resolveTitles(entries) {
  const POOL = 8
  let cursor = 0
  let found = 0

  await Promise.all(
    Array.from({ length: POOL }, async () => {
      while (cursor < entries.length) {
        const e = entries[cursor++]
        try {
          const ctl = new AbortController()
          const timer = setTimeout(() => ctl.abort(), 15000)
          const res = await fetch(e.url, { signal: ctl.signal }).finally(() => clearTimeout(timer))
          if (!res.ok) continue
          const html = await res.text()
          const m = html.match(/<title[^>]*>([^<]{1,200})</i)
          if (!m) continue
          const t = cleanPageTitle(m[1])
          // Reject placeholders that tell the reader nothing.
          if (t.length < 2 || /^(document|index|untitled|home|page)$/i.test(t)) continue
          e.title = t
          found++
        } catch {
          // Leave the folder name in place.
        }
      }
    }),
  )

  return found
}

async function listing(repo, path) {
  const url = `https://api.github.com/repos/${repo[0]}/${repo[1]}/contents/${path}?per_page=1000`
  const res = await fetch(url, { headers: { 'user-agent': 'blocked-library-builder' } })
  if (!res.ok) throw new Error(`${repo.join('/')}/${path} returned ${res.status}`)
  return res.json()
}

function buildEntries(src, items, urlPrefix = '') {
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
        title: titleFor(stripped(src, f.name)),
        description: '',
        game_image_icon: thumb ? src.host + encodeURIComponent(thumb) : '',
        category: 'Arcade',
        tags: [],
        featured: false,
        url: src.host + urlPrefix + encodeURIComponent(f.name),
        source: src.id,
      })
    }
  }

  if (src.mode === 'dirs' || src.mode === 'dirs+files') {
    for (const d of dirs) {
      if (NOT_GAMES.test(d.name) || d.name.startsWith('.')) continue
      out.push({
        title: titleFor(stripped(src, d.name)),
        description: '',
        game_image_icon: '',
        category: 'Arcade',
        tags: [],
        featured: false,
        // A trailing slash lets the host resolve its own index file, rather
        // than us guessing index.html for 221 folders.
        url:
          src.host + urlPrefix + encodeURIComponent(d.name) + '/' + (src.dirEntry || ''),
        source: src.id,
      })
    }
  }

  out.sort((a, b) => a.title.localeCompare(b.title))
  return out
}

// URLs proved dead by checklinks.mjs --prune. Without honouring this, every
// rebuild reinstates games already shown to be 404 and the verification has
// to be repeated from scratch.
let PRUNED = {}
try {
  PRUNED = JSON.parse(readFileSync(new URL('pruned.json', OUT_DIR), 'utf8'))
} catch {
  // No prune list yet.
}

const index = []
let total = 0
let skipped = 0

for (const src of SOURCES) {
  if (only && src.id !== only) continue
  try {
    let entries
    if (src.catalogue) {
      entries = await fromCatalogue(src)
    } else {
      const items = await listing(src.repo, src.path)
      entries = buildEntries(src, items)

      // A source can spread its games over more than one folder.
      for (const extra of src.extraPaths || []) {
        const more = await listing(src.repo, extra.path)
        entries.push(...buildEntries(src, more, extra.prefix || ''))
      }
    }

    // Drop anything already proved dead before spending fetches on titles.
    const beforePrune = entries.length
    for (let i = entries.length - 1; i >= 0; i--) {
      if (PRUNED[entries[i].url]) entries.splice(i, 1)
    }
    skipped += beforePrune - entries.length

    if (src.resolveTitles) {
      const n = await resolveTitles(entries)
      console.log(`      resolved ${n} of ${entries.length} titles from page <title>`)
    }

    entries.sort((a, b) => a.title.localeCompare(b.title))
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

    // A failed listing must not delete a library that was already built and
    // verified. The GitHub API allows 60 unauthenticated calls an hour, and
    // running out once silently dropped Amplify out of index.json while its
    // data file sat there intact. Keep the existing file and its entry.
    const existing = new URL(`${src.id}.json`, OUT_DIR)
    if (existsSync(existing)) {
      const onDisk = JSON.parse(readFileSync(existing, 'utf8'))
      // The prune list still applies on this path. A file written by an
      // earlier rebuild can contain urls since proved dead.
      const kept = onDisk.filter((g) => !PRUNED[g.url])
      if (kept.length !== onDisk.length) {
        skipped += onDisk.length - kept.length
        if (write) writeFileSync(existing, JSON.stringify(kept, null, 2) + '\n')
      }
      console.log(`      keeping the ${kept.length} already on disk`)
      total += kept.length
      index.push({
        id: src.id,
        name: src.name,
        author: src.author,
        credit: src.credit,
        licence: src.licence,
        host: src.host,
        count: kept.length,
        file: `libraries/${src.id}.json`,
        stale: true,
      })
    }
  }
}

console.log(`\n${total} games across ${index.length} libraries`)
if (skipped) console.log(`${skipped} skipped from public/libraries/pruned.json`)
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
