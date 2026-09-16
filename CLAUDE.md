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
src/lib.js               routing, data loading, favorites, recent, theme, badges
src/art.js               generated cover art, hash to hue/pattern/initials
src/icons.js             svg path data and the category to icon map
src/App.jsx              state, filtering, route switch, layout
src/components/          Header Sidebar Hero Row GameGrid GameCard
                         GamePlayer Skeleton Icon
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

## Theme

Red accent on a near black ground, with a white light mode. Both palettes are
CSS variable blocks at the top of `src/styles.css`, `:root` for dark and
`:root[data-theme='light']` for light. **Add colours as variables in both
blocks**, never as literals in a rule, or light mode ends up half dark.

`useTheme` in `src/lib.js` stamps `data-theme` on the root element and persists
the choice to localStorage. Dark is the default. The toggle lives in the header,
so it is not on screen while a game is open, but the theme still applies there.

## Writing style

User-facing text on this site must not read as AI-written. No em dashes, no en
dashes, no flowery product-copy descriptions. Short and plain. This is a
standing rule across all of this user's projects.

## About the user

Newer to web development. Explain the why, not just the command, and give one
command at a time rather than a chain. They are experienced with Minecraft
modding, so programming concepts land fine, the unfamiliar part is the web
toolchain and Windows shell friction.
