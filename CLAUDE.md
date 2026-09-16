# Blocked

A game site. Vite + React 19, no backend, no router library. The whole thing
builds to static files.

Scaffolded 2026-09-10. Local git repo, no remote yet.

## Running it

The user is on Windows in PowerShell. **Use `npm.cmd`, not `npm`.** PowerShell's
execution policy blocks `npm.ps1` with an UnauthorizedAccess error. Do not tell
the user to change the execution policy, `npm.cmd` sidesteps it with no risk.

PowerShell 5.1 also has no `&&` operator. Chain with `;` or use separate
commands.

```
npm.cmd run dev      # port 5174
npm.cmd run build    # outputs to dist/
npm.cmd run lint     # oxlint
```

Port 5174 is deliberate. The user's other site, DeblockedX, uses 5173 and they
sometimes run both.

Node is a **portable** install at `C:\Users\cciec\nodejs`, not an MSI. If `node`
is missing from a shell, that shell started before the PATH change.

## How it is put together

```
public/games.json        all game data, the only file you edit to add games
src/lib.js               routing, data loading, favorites, recent, badges,
                         idle shimmer
src/settings.js          every user option, its presets, and the uploader
src/art.js               generated cover art, hash to hue/pattern/initials
src/icons.js             svg path data, category icon and tone maps
src/App.jsx              state, filtering, route switch, layout
src/components/          Header Sidebar Hero Row GameGrid GameCard
                         GamePlayer Skeleton Icon Settings LuminLibrary
src/styles.css           one stylesheet, CSS variables at the top
scripts/categorize.mjs   derive categories from titles
scripts/checklinks.mjs   check which game urls are alive and embeddable
scripts/rehost.mjs       bulk repoint game urls from one host to another
```

`icons.js` holds the path data rather than `Icon.jsx` because a file that
exports both a component and a constant breaks Vite fast refresh.

**Hash routing** (`#/game/<slug>`), hand-rolled in `src/lib.js`, no
react-router. This keeps every URL a single static file request so the site
deploys to any host with no rewrite rules. Do not swap in a real router without
a reason, it would add a hosting requirement.

**Slugs** come from the title, so a game keeps its URL if the list is reordered.

**Categories** in the filter bar are derived from whatever `category` values
exist in the data. Adding a category needs no code change.

**Favorites** are localStorage, wrapped in try/catch because private windows and
blocked site data throw on access.

## Adding games

One object per game in `public/games.json`:

```json
{
  "title": "2048",
  "description": "Slide the tiles, match them.",
  "game_image_icon": "https://example.com/thumb.png",
  "category": "Puzzle",
  "tags": ["numbers"],
  "featured": false,
  "url": "https://example.com/game/"
}
```

This schema matches the user's DeblockedX library exactly, on purpose. That
library has about 450 curated entries at
`C:\Users\cciec\DeblockedX\games.json` and can be dropped in unchanged.

`game_image_icon` may be empty. The card falls back to the first letter of the
title.

## The real problem: link rot

Games load in an iframe, and hotlinked third-party games break constantly. Two
distinct failure modes, both seen already:

1. **Dead host.** `jakesgordon.github.io/javascript-racer` was a GitHub Pages
   site that no longer exists. Removed from the seed list.
2. **Refuses to be framed.** `gabrielecirulli.github.io/2048` redirects to
   `play2048.co`, which sets a `frame-ancestors` CSP. The iframe gives **no
   error event** when this happens, which is why `GamePlayer` shows a "New tab"
   hint after five seconds rather than trying to detect it.

The durable fix is **self-hosting** game files under `public/games/`. DeblockedX
already does this in its own `games/` folder. Prefer that over adding more
hotlinks.

### Verifying a game URL

The preview browser pane **does** render cross-origin iframes, so loading a game
in the player and screenshotting it is a valid check. Give it 4 to 6 seconds
first, since a blank frame early on often just means still loading.

A screenshot may time out with "page did not finish rendering" on a game that
animates constantly. That is not a failure, it usually means the game is
running. Retry the screenshot on its own.

Do **not** rely on `fetch()` from the app origin. "Failed to fetch" there
usually means CORS, not a 404, so it proves nothing either way. If a frame stays
blank, navigate a tab directly to the game URL and read the page text to see
whether the host is actually dead.

## Current state

451 games. **439 of them do not work**, see the section below. Four are
confirmed playable and carry `"verified": true` in games.json: Clumsy Bird,
Astray, Untrusted and 2048.

Hosting is undecided. Nothing in the code assumes a host, but if it ends up on
GitHub Pages under a subpath, `base` needs setting in `vite.config.js`.

## The dead host, the biggest open problem

439 of the 451 games point at one hostname,
`mathematics-lessons.eclipsecastellon.com`. That subdomain was **NXDOMAIN** on
2026-09-15. The parent `eclipsecastellon.com` still resolves to 79.112.1.140,
only the subdomain is gone. This is why almost every game opens as a blank
frame: nothing is wrong with the player.

The whole library is therefore **one hostname away from working**, and the
titles, thumbnails, categories and descriptions are all still good. Find a host
that serves the same paths, then:

```
node scripts/rehost.mjs --probe                       which hosts are alive
node scripts/rehost.mjs --from <dead> --to <new>      dry run
node scripts/rehost.mjs --from <dead> --to <new> --write
```

Then spot check in the player. A host answering 200 does not prove it serves
the same game paths.

`scripts/checklinks.mjs` separates the two distinct failure modes, a dead host
versus one that loads but refuses to be framed. Run it from Node, never from
the browser: a `fetch` from the page origin returns "Failed to fetch" for CORS
and looks identical to a real outage.

## Settings

Everything adjustable lives in one object in `src/settings.js`, persisted whole
to `blocked:settings`. `read()` merges the saved blob over `DEFAULTS`, so an old
save missing a new key still loads. **To add an option: add it to `DEFAULTS`,
add a row to `Settings.jsx`, and nothing else.**

`useSettings` writes the whole state onto `<html>` on every change. Attributes
drive layout (`data-theme`, `data-shape`, `data-titles`, `data-tint`,
`data-bg`), custom properties drive colour. That keeps the stylesheet in charge
of how each option looks, so most new options are CSS only.

The gear in the header opens the sheet. There is no standalone light/dark
toggle any more, mode lives inside settings.

Options: library source, mode, accent, background (solid / gradient / uploaded
image with a dim slider), card shape, titles on/off, idle shimmer, coloured
section icons.

**Accent drives the card art.** `src/art.js` returns hue *offsets*, not
absolute hues, and the stylesheet adds `--art-base` which settings sets from
the accent's `hue`. So picking an accent retints all 450 cards. If you add an
accent, give it a `hue`.

**Mode and background are paired.** `setTheme` in `Settings.jsx` moves a
mismatched solid or gradient to its counterpart, because a dark slate under
light text is unreadable.

**Uploaded backgrounds are resized first.** `prepareBackgroundImage` downscales
to 1920px and re-encodes as JPEG 0.82. A 5.4MB 3000x2000 PNG came out at 39KB.
Without that step localStorage, which holds about 5MB and inflates by a third
for base64, blows its quota on the first phone photo.

## Libraries

Every selectable library is registered in `LIBRARIES` in `src/settings.js`.
`useGames({ file })` loads whichever one is selected, so adding a library is a
data file plus one entry there.

| id | name | games | source |
|----|------|-------|--------|
| `lumin` | Lumin | embed | third party CDN, see below |
| `goblin` | Goblin Kingdom | 633 | github.com/goblinkingdev/unblocked-games |
| `hell` | Hell | 207 | github.com/D3ch/hell |
| `alexx` | Alexx743 | 71 | github.com/Alexx743/Alexx743-games |
| `gams` | Gams Offline | 59 | github.com/Gams-Offline/Gams |
| `local` | Built in | 451 | the old import, mostly dead, kept for reference |

**We link, we never copy.** Every url points at the source's own host, so they
serve the game and get the traffic, and nothing is mirrored here. That is also
why a 14GB asset repo was never a problem, and it is the narrow path that
avoids redistributing anything.

**Attribution is wired into the UI**, not just the docs. The library picker
names the author and links the repo, and the footer credits whichever library
is on screen. This was the point of splitting by source rather than merging
everything into one pile. Note for the record: naming a source is attribution,
not a licence. Four of these repos state no licence, which under default
copyright means no permission is granted to redistribute, so linking matters.
Delist anyone who asks.

Rebuild with `node scripts/build-libraries.mjs --write`, then
`node scripts/categorize.mjs --file libraries/<id>.json --write`. Both
`checklinks.mjs` and `categorize.mjs` take `--file <path under public/>`.

Verified live on 2026-09-16 with a full check, not a sample: goblin 633/633,
alexx 71/71, gams 59/59 all at 100%, hell 207/228 after
`checklinks.mjs --file libraries/hell.json --all --prune` removed 21 folders
with no index file.

### Sources that were checked and left out

Recorded in `REJECTED` in `build-libraries.mjs` so nobody re-derives it:

- **Seraph** (494 games) `a456pur/seraph`. No working public host.
  `a456pur.github.io/seraph/` fails DNS repeatedly even though the user's
  github.io root answers, and the custom domain has no DNS record.
- **UGS-Assets** (384) `bubbls/UGS-Assets`. No GitHub Pages, and its intended
  delivery is jsDelivr, which serves HTML as `text/plain` so a browser will
  not render it in a frame.
- **Ruby** (68) `ruby-network/ruby`. Has a real catalogue at
  `src/public/games.json` with tags and thumbnails, but its site returns HTTP
  523 and sends `X-Frame-Options: SAMEORIGIN`, and its asset repo
  `ruby-network/ruby-assets` is 404.
- **The Dropbox folder.** Dropbox does not serve shared HTML as a rendered
  page, so a game cannot run in a frame from it. Its listing is also JS
  rendered, so it cannot be enumerated with a plain fetch.

Any of these become usable the moment their files sit on a host that serves
`text/html` and does not refuse framing.

## The Lumin library

`src/components/LuminLibrary.jsx` mounts a third party catalogue and is the
**default**.

What is actually known about it, verified 2026-09-16:

- The repo `luminsdk/script` has **no tags and no releases**, so `@latest`
  resolves to the default branch HEAD and changes on every push. Nothing here
  reviews what arrives. Pin a commit hash when convenient.
- It holds two files, `lumin.min.js` and `fonts.min.js`, which are **byte
  identical**, same sha256. The "fonts" name is a decoy for network filters,
  so the loader tries both in order and a filter blocking one by URL usually
  lets the other through.
- The bundle is obfuscated with no readable URLs and builds its request
  targets at runtime, so what it talks to cannot be read off the source.
- It boots a **Worker**. On localhost that worker fails with
  `[Lumin] Worker connection failed: domain fetch failed`, which reads like a
  domain check. **Expect it to only work from a real deployed domain**, so
  testing it means deploying. The error panel says so and offers a one click
  switch to another library.

Because embed mode has no game list, a `#/game/` route cannot resolve there.
App redirects such a route home; without that it sat on the loading skeleton
forever, since `games` stays null in embed mode and the player branch runs
before the embed branch.

## Writing style

User-facing text on this site must not read as AI-written. No em dashes, no en
dashes, no flowery product-copy descriptions. Short and plain. This is a
standing rule across all of this user's projects.

## About the user

Newer to web development. Explain the why, not just the command, and give one
command at a time rather than a chain. They are experienced with Minecraft
modding, so programming concepts land fine, the unfamiliar part is the web
toolchain and Windows shell friction.
