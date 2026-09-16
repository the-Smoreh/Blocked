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

## Hosting

Set up for GitHub Pages. `.github/workflows/deploy.yml` builds and publishes on
push to `main`; the repo owner has to set Settings -> Pages -> Source to
"GitHub Actions" once.

`vite.config.js` uses **`base: './'`**, not a hardcoded `/Blocked/`. Relative
asset paths mean one build works at a project site
(`<user>.github.io/<repo>/`), a user site (`<user>.github.io/`) and a custom
domain. Hardcoding the repo name would break the other two and local previews.

This is only safe because of **hash routing**: the document is always served
from the base itself, so relative paths always resolve against it. If a real
router is ever introduced, this breaks, and Pages has no rewrite rules so it
would also need a `404.html` shim.

Data files are fetched as `import.meta.env.BASE_URL + file` rather than a bare
relative path. A bare path happens to work with hash routing but breaks as soon
as anything is served deeper.

`public/.nojekyll` disables Jekyll, which otherwise skips paths starting with
an underscore.

Verified with one `dist` folder on 2026-09-16: served at `/Blocked/` and at
`/`, both rendered 633 cards with no console errors, and the deep link
`/Blocked/#/game/2048-balls` opened the player. Local configs `blocked-pages`
(port 5175, subpath) and `blocked-root` (5176) reproduce both.

No mixed content: every game url and icon url in every library is `https`,
checked. Pages is HTTPS only, so an `http` url would be blocked outright.

## The dead host, now resolved

The old built in library's 439 games all pointed at
`mathematics-lessons.eclipsecastellon.com`, which went NXDOMAIN. That library
has been **replaced by Selenite**, the same site software on `music.lyrica24.top`,
which serves 914 games with their own covers and verified 914 of 915 live. The
old `public/games.json` was deleted; it is in git history if ever needed.

`scripts/rehost.mjs` still exists for the next time a host moves:

```
node scripts/rehost.mjs --probe                       which hosts are alive
node scripts/rehost.mjs --from <dead> --to <new>      dry run
node scripts/rehost.mjs --from <dead> --to <new> --write
```

A host answering 200 does not prove it serves the same game paths, so spot
check in the player afterwards.

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
light text is unreadable. Gradients pair `slosh` with `sloshlight`, and a
deliberate pick of any other gradient is left alone.

## Light mode

**The slate tokens must only be set when the background is a flat colour.**
This was the bug that broke light mode wholesale. The stylesheet reads
`--panel: var(--slate-panel, #ffffff)`, and `useSettings` used to write
`--slate-*` unconditionally. So with the gradient background selected, a dark
slate left over from an earlier choice won the fallback and light mode
rendered dark panels, black card title bars, a dark rail and unreadable intro
text on a white page. `useSettings` now clears those properties unless
`bgKind === 'slate'`, which lets each theme's own defaults win. Dark mode is
unaffected: its fallbacks are identical to the ink slate.

**The moving background is theme aware through tokens**, not duplicated
rules. `--fx-1` through `--fx-5` set each blob's strength and `--fx-blend` and
`--fx-opacity` set how the over-the-wall layer composites. Light mode uses
**multiply at 0.3** with much weaker blobs; dark mode uses soft-light at 0.85.
Soft-light on a near white page hazes everything pink and flattens the
contrast of whatever is underneath, whereas multiply darkens where the blob is
and reads as a tint.

**Light mode separates surfaces with elevation, dark mode with borders.** A
1px border works on black because it is lighter than the ground; on near white
the same border is nearly invisible and the wall reads as flat. So light mode
adds card shadows, and gives the translucent header and rail a stronger
dividing line.

Other light specific corrections, all at the end of the stylesheet: near white
swatches get an edge so the light gradients are visible next to the dark ones,
the preview panel gets its own ground since `--bg` is nearly the panel colour,
and the scroll cue track, segment tracks and switch knobs get more definition.

The generated card art runs lighter in light mode (`--art-l1: 52%`), so the
initials carry a text shadow rather than relying on the art being dark.

Colours that stay hardcoded are the ones painted on saturated art: the hero
scrim and its white text, the card art pattern overlays, the favourite button
scrim. Those are correct in both themes because the surface underneath is
always a strong colour.

**The player sits at `z-index: 20`.** The moving overlay is at 12, and without
this it composited drifting red over the game itself, tinting whatever was
being played. Still below the settings sheet at 41.

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
| `selenite` | Selenite | 914 | music.lyrica24.top |
| `goblin` | Goblin Kingdom | 633 | github.com/goblinkingdev/unblocked-games |
| `hell` | Hell | 207 | github.com/D3ch/hell |
| `nova` | Nova Arcade | 151 | github.com/Beefalo1234/nova-arcade |
| `amplify` | Amplify | 80 | github.com/joeyc1pro/amplify-home-xyz |
| `alexx` | Alexx743 | 71 | github.com/Alexx743/Alexx743-games |
| `gams` | Gams Offline | 59 | github.com/Gams-Offline/Gams |
| `p0xx` | p0xx | 51 | github.com/p0xx/p0xx.github.io |
| `astro` | Astro v2 | 24 | github.com/MNblocker/Astro-v2 |
| `lumin` | Lumin | embed | third party CDN, returns no games, see below |

**2190 games.** `selenite` is the default: 914 of 915 urls verified live and
frameable, and it is the only library that ships its own cover for nearly
every game.

### Selenite

The replacement for the old built in list, which pointed at
`mathematics-lessons.eclipsecastellon.com` and went NXDOMAIN. Same site
software on a live domain, with twice the games, so the old library was deleted
rather than rehosted.

It is the only **catalogue** source: it publishes
`/resources/games.json`, so the whole library comes from one request instead of
a directory listing. `fromCatalogue` in `build-libraries.mjs` handles it, and
adding another site like this needs a `catalogue` url rather than a `repo`.

Its rows give `name`, `directory`, `image` and `tags`:

- url is `<host>/resources/semag/<directory>/index.html`
- cover is `<host>/resources/semag/<directory>/<image>`

**The cover filename has to come from the data.** It is `cover.png` for some
games but `icon.png`, `logo.jpg`, `splash.png`, `gd.webp` and
`buckshot-roulette.apple-touch-icon.png` for others: png, jpg, jpeg, webp,
avif, ico, svg and gif all appear. Assuming `cover.png` would miss most of
them.

**Its categories come from its tags, not from `categorize.mjs`.** Every game is
tagged, across 42 tags, so `TAG_CATEGORY` in the builder maps them in priority
order: a game tagged both `horror` and `platformer` is horror first. Do not run
`categorize.mjs` on this library, it would overwrite real tags with keyword
guesses. The site's own `top` tag becomes `featured`.

Those tags also include content markers, `13+` on 20 games, `gore` on 15 and
`18+` on 5. They are preserved in each entry's `tags`, so filtering on them
later is a data question rather than a re-extraction.

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

### Rebuild order

`build-libraries.mjs` regenerates entries from scratch, so it wipes borrowed
icons and derived categories. Run the steps in this order:

```
node scripts/build-libraries.mjs --write                       1. fetch listings
node scripts/checklinks.mjs --file libraries/<id>.json --all --prune   2. verify
node scripts/share-icons.mjs --write                           3. lend icons
node scripts/categorize.mjs --file libraries/<id>.json --write 4. categories
```

Only step 2 is slow and only step 2 needs the network hammered, so in practice
step 1 is rare. `checklinks.mjs` and `categorize.mjs` both take
`--file <path under public/>`.

### Shared cover art

Only Alexx743 ships thumbnails, 58 of them. Every other repo was checked for an
image folder and has none: nova's `imgs` holds three site icons, goblin's
`cache/upload/thumb` holds one placeholder, hell has no images directory.

`share-icons.mjs` closes part of that gap. The same games recur across
collections, so a game with no icon borrows from a same-named game that has
one. 89 games picked up real art this way. Two rules keep it honest:

- **A donor must be an original icon, never a borrowed one.** Borrowed entries
  are stamped `icon_from`, and those are excluded as donors. Without that, a
  second run would chain one image across the wall.
- **A donor url must actually load**, checked with a request that also
  requires an `image/*` content type. 392 of the built in list's icons sit on
  the dead host, and lending those would replace working generated art with a
  broken image.

Matching runs in four passes, loosest last, on the title reduced to
`[a-z0-9]`:

1. **exact.** "1v1 Lol" lends to "1v1lol", "Paper Io" to "Paperio".
2. **loose.** Filler words are dropped first (`game`, `unblocked`, `online`,
   `play`, `free`, `io`, `version`), so "Slope Game" can match "Slope".
3. **prefix.** A donor whose whole title is a prefix of this one, minimum
   seven characters, longest donor winning. This is the pass that actually
   pays: "Geometry Dash Unblocked", "Retro Bowl Old",
   "Snow Rider 3D Unblocked - Play Online" and "Basket Random Unblocked" are
   all many edits from their donor but obviously the same game. Seven
   characters is the floor because "drift" would otherwise lend to every
   drift game.
4. **fuzzy.** Levenshtein, with the allowance scaled to length,
   `floor(longest / 5)` capped at `--max-distance` (3 by default) and
   nothing under `--min-length` (8). Three characters out of nine is a
   different game, three out of twenty is a spelling variant. This is what
   catches "Volley Random" borrowing from "Volly Random".

**Sequel numbers must agree exactly.** The digits in both titles are compared
rather than digits being banned outright, so "cookieclicker2" can still match
a longer variant while "geometrydash2" is refused against "geometrydash3" and
"ducklife2" against "ducklife3".

Tuning flags: `--max-distance`, `--min-length`, `--prefix-min`, and
`--reset` to clear previous borrows so changed rules re-lend from scratch.
Every inexact match is printed in full rather than sampled, because those are
the ones worth eyeballing.

**310 games borrow art** with these rules, up from 108 before Selenite
arrived. Selenite is the donor pool that made the difference: it ships 804
working covers against Alexx743's 58, so hell went from 32 borrowed to 106,
gams from 6 to 33, and goblin from 20 to 42.

**`--verify-own` blanks dead covers.** Selenite lists a cover filename per game
and roughly one in seven is stale, so 110 were cleared. Without that those
cards fire a request that 404s before falling back to the generated art, and a
dead url could be lent onward as a donor. The donor index is deliberately
built after this pass.

Verified with a full check, not a sample. goblin 633/633, alexx 71/71,
gams 59/59 at 100%. hell 207 after 21 folders with no index file were pruned,
nova 151 after 2, astro 24 after 5, amplify 80 after 1. p0xx keeps all 51, of
which 20 verified and 31 returned connect timeouts that are not proof of
anything: a single request to those same urls returns 200.

**Pruning is durable.** `checklinks.mjs --all --prune` records every removed
url in `public/libraries/pruned.json`, and `build-libraries.mjs` skips those
on both its rebuild path and its keep-from-disk path. Before that, every
rebuild reinstated games already proved dead and the verification had to be
redone from scratch.

**The checker only prunes on 404 and 410.** A 429, a 5xx or a timeout is
recorded as `unknown` and kept. This matters: an early version treated any
non-ok response as dead and deleted 31 working p0xx games after GitHub Pages
rate limited a burst of concurrent requests. Concurrency is 4 with 3 retries
for that reason.

**Amplify's titles come from each page's `<title>`.** Its folders are named
g1..g81 on purpose, so the folder name carries nothing. 66 of 81 resolved.

**Astro's folder names** are the import that produced them, so
`stripPrefix` turns "MNblocker 3kh0-Assets main DogeMiner" into "DogeMiner".
The url still uses the real folder name.

**The GitHub API allows 60 unauthenticated calls an hour.** Running out mid
build once dropped Amplify out of index.json while its data file sat there
intact, which is why a failed listing now keeps what is already on disk.

### Sources that were checked and left out

Recorded in `REJECTED` in `build-libraries.mjs` so nobody re-derives it:

- **Seraph** (494) `a456pur/seraph`. No working public host.
  `a456pur.github.io/seraph/` fails DNS repeatedly even though the user's
  github.io root answers, and the custom domain has no DNS record.
- **PLEXILEARCADE** (248) `knwzero/PLEXILEARCADE`. 248 games in
  `assets/games`, Apache-2.0, but Pages is off and plexilearcade.net no
  longer resolves.
- **UGS-Assets** (384) `bubbls/UGS-Assets`. No Pages, and its intended
  delivery is jsDelivr, which serves HTML as `text/plain` so a browser will
  not render it in a frame. That rules out jsDelivr as a game host generally.
- **PeteZah** (156) `PeteZah-Games/PeteZahStatic`. Every path on
  petezahgames.com redirects to `/verify?reason=activity`, a bot check, and
  their Pages domain redirects there too. A framed game would show the check.
  Working around a bot check is not on the table.
- **Ruby** (68) `ruby-network/ruby`. Has a genuinely good catalogue at
  `src/public/games.json` with tags and thumbnails, and its url pattern is
  `gms/ruby-network/ruby-assets/main/<name-lowercased-hyphenated>/<baseFile>`.
  But the site returns 523, sends `X-Frame-Options: SAMEORIGIN`, and the
  asset repo is 404.
- **julianlockibarra-cat/games**. Pages is off and there is no other host, so
  UNITY GAMES, FLASH GAMES and the third folder cannot be served.
- **schplay** `paralzyed/schplay.github.io`. Empty apart from site pages, no
  game files to index.
- **The Dropbox folder.** Dropbox does not serve shared HTML as a rendered
  page, so a game cannot run in a frame from it. Its listing is JS rendered,
  so a plain fetch cannot enumerate it either.

Any of these become usable the moment their files sit on a host that serves
`text/html` and does not refuse framing.

## The Lumin library

`src/components/LuminLibrary.jsx` mounts a third party catalogue. It is still
selectable but **no longer the default**, because it does not work.

What it actually does, verified 2026-09-16:

- The script loads and installs a global `Lumin` whose methods are a Proxy
  that queues every call until its worker boots.
- Its worker reports `[Lumin] Worker connection failed: domain fetch failed`
  on localhost, which reads like a domain check.
- `init()` **resolves** but renders nothing into the container.
- Every other method **never settles**. `Lumin.getGames()` was left running
  for 45 seconds and did not return. So the richer API it advertises, and it
  does advertise `getGames getCategories getGameUrl getImageUrl loadGame
  search destroy on off`, is unreachable until the worker boots.

Three failure modes are guarded. `init` races a 20 second timeout. A container
that never receives content is treated as a failure, so the page cannot sit on
a spinner forever. And crucially the content check **waits** via a
MutationObserver rather than reading the container the instant init resolves:
the first version of that check reported "returned no games" on a library that
was about to paint fine, which showed the error panel over a working embed.
The error panel offers a one click switch.

If the worker ever does boot on a real domain, the better integration is to
call `getGames()` and render the results in our own card UI rather than
letting it draw its own, so its games get the site's art and settings.

Other facts worth keeping: the repo `luminsdk/script` has no tags, so
`@latest` is branch HEAD and changes on every push. Its two files
`lumin.min.js` and `fonts.min.js` are byte identical, same sha256, so "fonts"
is a decoy name for network filters and the loader tries both.

Because embed mode has no game list, a `#/game/` route cannot resolve there.
App redirects such a route home; without that it sat on the loading skeleton
forever, since `games` stays null in embed mode and the player branch runs
before the embed branch.

## Settings sheet

Three tabs, Library / Look / Cards, so no tab is long enough to scroll hunt.
Controls sit in `.sgroup` panels rather than a flat stack of hairline rows,
which is most of what stops it reading as a raw form. The Cards and Look tabs
carry a live `Preview` of three miniature cards built with the real `.card`
markup and `artFor`, so shape, titles, accent and art update as you change
them.

The picker deliberately has **no per row link to each source**. Those were
removed; a dedicated links page is planned instead. Attribution still shows in
the sheet footer and the site footer.

Watch for duplicate CSS when reworking it. The second pass was appended while
the first pass was still in the file, and the leftover `.lib { flex-direction:
column }` made every library row wrap its credit link onto a second line. The
superseded block was removed, not overridden.

## Moving background

Red on black, animated, and the default (`bgKind: 'gradient'`,
`bgGradient: 'slosh'`). Switchable off with the "Moving background" toggle in
settings, and it holds still under OS reduced motion.

It is **five blobs on separate timings** (8s, 11s, 6.5s, 9.5s, 7.5s), not one
animated gradient. A single gradient can only slide; separate blobs drift past
each other, which is what makes it slosh. They are tinted with `color-mix`
from `--accent`, so the background follows whatever accent is chosen.

**One blob per corner, plus one in the middle.** The first version had three,
and all three sat on the top left to bottom right diagonal, which left the top
right and bottom left corners permanently black. The base gradient had the same
bias, two stops on the same diagonal, so it now has a stop in all four corners
too. If a corner ever looks dead again, check both layers, not just the blobs.

Measured displacement is 7 to 71 px per second depending on where each blob is
in its eased curve. The durations were 23s, 31s and 19s before, which read as
static.

The blobs are rendered **twice**, in `Gate.jsx` so they exist on every route:

- `.bgfx`, `z-index: -1`, behind everything.
- `.bgfx-over`, `z-index: 12`, above the cards (which sit at 3) and below the
  header (30), on `mix-blend-mode: soft-light`.

The second layer is the point. On a 633 card wall the layer behind is almost
entirely covered, so the movement was invisible exactly where the user looks.
Soft-light over the grid tints it without washing out the game art, and the
chrome stays crisp because the header and rail are above it. It is disabled
when the background is an uploaded image, where it would fight the photo.

The rail is translucent with a backdrop blur for the same reason: it is a tall
opaque column sitting where the first blob drifts. It goes solid over an
uploaded image so it stays readable.

## The intro gate

`src/components/Gate.jsx` wraps the app in `main.jsx`, so it covers every route
including the player without being threaded through App's several early
returns. It shows on **every load** and is never remembered.

**The handoff is not a fade.** Scrolling drives `--p`, which pushes the intro
away from the viewer (`scale` to 1.16) while it blurs out (to 13px), and pulls
the site up from behind it (`scale` 0.94 to 1) behind a scrim that lifts. The
wordmark clears first, so the sequence has an order instead of everything
leaving at once. The intro carries the same drifting blobs as the site, which
is what makes the two read as one surface rather than two screens.

**It commits at 42%.** Past that the rest plays out on its own over 760ms,
because requiring someone to scroll exactly to the end felt like work. Only the
committed run is animated; up to that point it tracks the wheel one to one and
reverses if you scroll back up. A click, Enter, Space, Escape or an arrow runs
the same commit, so those play the transition rather than snapping, and they
are the way through for anyone who cannot scroll.

`COMMIT_MS` has to match the transition in `.gate.committing` or the layer is
torn out mid animation.

Two traps that were hit building this, both worth not repeating:

- **`transform-origin` on `.under` must be in viewport units.** That element is
  as tall as the whole document, so a percentage origin sits thousands of
  pixels down the page and the scale drags the visible part right off centre.
  Scroll is locked at the top while the gate is up, so `46vh` is the viewport
  centre.
- **The scrim is a sibling of `.under`, not a child.** A fixed child of a
  transformed ancestor is positioned against that ancestor rather than the
  viewport, so inside `.under` it was being scaled and offset along with the
  site.

The transform and the class are both dropped on entry, because a transform or
a filter on `.under` would otherwise become the containing block for the
sticky header and the fixed settings sheet. Verified after entry: `.under` has
`transform: none` and `header` is back to `position: sticky`.

Testing note: the preview pane emits its own wheel events, five at -100 then
two at +100 in one sample, which sometimes dismisses the gate between tool
calls. That is the harness scrolling, not a bug. Drive `--p` directly rather
than relying on the gate surviving between calls.

## Writing style

User-facing text on this site must not read as AI-written. No em dashes, no en
dashes, no flowery product-copy descriptions. Short and plain. This is a
standing rule across all of this user's projects.

## About the user

Newer to web development. Explain the why, not just the command, and give one
command at a time rather than a chain. They are experienced with Minecraft
modding, so programming concepts land fine, the unfamiliar part is the web
toolchain and Windows shell friction.
