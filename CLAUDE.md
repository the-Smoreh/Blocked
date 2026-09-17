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

## The hero

When the spotlight game has a cover, the panel uses it: a scaled up blurred
copy fills the whole thing, and a crisp copy sits on the right at its own
aspect ratio. Two copies rather than one stretched image, because these covers
are small and mostly square, so a single copy across a wide panel is soft and
badly cropped. The blurred fill carries the colour, the poster carries the
detail.

Without a cover it falls back to the generated art and the oversized initials,
which is what every library except Selenite and Alexx743 gets. `data-art` on
the section is `cover` or `generated`, and the scrim and the drifting mesh both
respond to it: the scrim runs harder and further across over a real image,
since a near white cover would otherwise swallow the title, and the mesh drops
to 0.3 so it does not muddy the artwork.

The poster is an `img`, not a second background, specifically so a dead cover
raises `onError` and the panel can fall back. A background-image fails
silently and would leave a blank panel, which is how the hero looked before
any of this.

**Covers under 96px are not upscaled.** They render without smoothing at up to
55% height instead. Selenite has 18 `.ico` covers and some are 16 or 32px;
stretching one to fill 76% of the hero turns it to mush, while pixelated at its
own scale reads as deliberate pixel art. The threshold is checked on `onLoad`,
since CSS cannot see a natural size.

Below 760px the poster is dropped and only the blurred fill carries the image,
because at that width it crowds the title.

## Category colours

One colour per category, in `--tone-0` through `--tone-14`, assigned in
`CATEGORY_TONE` in `src/icons.js`. They are picked to suit the category rather
than spread evenly round the wheel: sand for Sandbox, pitch green for Sports,
neon pink for Retro, purple for Horror so it does not fight the site's own red.
Racing, Action and Shooter all want to be red, so they take red, orange and
rose to stay apart.

**Every category needs its own index.** Action and Shooter shared tone 11 until
Selenite made Action a 130 game category and the collision became obvious.

**Every category has its own glyph.** There were seven shapes for fifteen
categories, so Clicker, Horror, IO, Platformer, Retro, Sandbox and Shooter all
fell through to the arcade cabinet fallback and Adventure reused Action's bolt.
The whole rail looked duplicated. `BY_CATEGORY` in `src/icons.js` now maps
every category that actually occurs, plus aliases for the names other sources
use, and an unmapped one takes a stable pick from `FALLBACK_ICONS` rather than
everything landing on the same glyph.

Two traps when adding a glyph:

- **Check the opening shape, not just the whole path.** Adventure was a
  compass and Sports is a ball, both a 9 radius circle, so they read alike at
  the 19px the rail renders them at even though the paths differed. Adventure
  is a peak and sun now.
- The old Strategy glyph was a cup, which read as a trophy and so as Sports.
  It is a flag now.

**Hovering a rail row redraws its stroke.** Every glyph carries
`pathLength="1"` in `Icon.jsx`, which normalises its total length to 1 however
long the real path is, so one `stroke-dasharray: 1` rule draws all fifteen
without measuring any of them. `draw-on` then animates `stroke-dashoffset`
from 1 to 0. Most of these glyphs are several subpaths, so the sweep runs
through them one after another, which is what makes it read as drawn rather
than faded in.

**The draw lives on the `path`, the pop and idle loops live on the `svg`.**
That separation is deliberate: both would otherwise be fighting over the same
element, and hovering the selected row would cancel its idle loop. Split
across two elements they layer.

Hovering also sweeps a light gradient across the row, grows an edge bar in the
category's own colour, scales the glyph, and nudges the label right while the
count slides left. Measured through one hover: dashoffset 1 to 0.45 to 0, edge
bar 0 to 24px, scale 1 to 1.16, label 0 to 3px, sweep -239 to 239.

The hover scale is on `.rail-item:not(.on) .icon` only, because the selected
row is already running `icon-pop` and an idle loop on that same transform.

**The selected category's icon animates.** Two animations run in sequence on
the same element: `icon-pop` the moment the row becomes active, then an idle
loop chosen to suit that glyph, keyed off the `data-tone` the row already
carries. The car pulls away and back, the joystick rocks, the ghost drifts, the
ball spins, the flag waves, the bolt flickers, the crosshair locks on.

No JS is involved. React swaps the className on the existing node rather than
replacing it, so the pop plays simply because the rule newly matches.

`.rail-item .icon` sets `transform-origin: 50% 60%`, without which the
joystick tilts and the flag waves around the top left corner of the viewBox.
Only the one selected row animates, and only transforms, so it stays a single
compositor animation however long the category list gets. The global reduced
motion block already neutralises all of it.

The **icons themselves** are what gets coloured, gated on `data-tint="on"`:
`.rail-item .icon`, `.secicon`, and `.tag .icon`. An earlier version put a
coloured dot at the end of each rail row and left the icon grey, which was not
what was asked for. The active rail row keeps the accent for its label and bar
but its icon stays on its category colour, so the coding is never interrupted.

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

### Deriving categories

`src/categorize.js` holds the rules and `categoryFor`, shared by
`scripts/categorize.mjs` at build time and `src/lumin.js` at runtime. It used
to be a copy in each place, which drifted.

Matching is **substring by default**. That looks sloppy and it is deliberate:
several of these libraries use titles that are really folder names with the
spaces removed, like `1on1soccer`, `bloonstowerdefense2`, `awesometanks2`,
`learntoflyidle` and `agariolite`. A word boundary rule cannot see the keyword
in any of those.

**Do not make boundary matching global.** That was tried. It reads as the
careful fix and it was much worse: gams fell from ten categories to two with
nearly everything landing on Arcade, and across all nine libraries it threw
away 95 correct matches. It also broke ordinary spaced titles, because a
boundary rejects a plural and a sequel number: "Awesome Tanks" stopped matching
`tank`, and "Vex3", "Run3" and "Fnaf3" stopped matching anything.

Instead a keyword can opt in with a `*` prefix, and only fourteen do. Each is
listed in `STRICT` with the word that made it necessary: `car` in Icarus and
Ocarina, `line` in online, `word` in sword, `run` in Sprunki, `evil` in devil,
`action` in reaction, `nes` in bones, `dunk` in drunk, `venge` in revenge,
`story` in history, `risk` in Frisk, `pool` in Liverpool, `sort` in resort,
`64` in any longer number. A strict keyword still allows a plural and a
trailing sequel number, including the `3d` form, so `run` matches "Run3d" while
`car` still refuses "card".

Measured on all 2190 games: 64% land off the Arcade fallback across 14
categories, up from 61%, and every single library improved or held. The 36
games the strict keywords changed were checked one by one rather than sampled;
they are corrections like "Ocarina of Time" leaving Racing and "Swords And
Sandals" leaving Puzzle.

**Selenite is excluded.** Its categories come from its own 42 real tags, so
running the script over it would overwrite facts with guesses.

Adding a keyword is the normal way to fix a game. Reach for `STRICT` only when
a real word contains the keyword, and write down which word.

### Borrowing covers at runtime

`share-icons.mjs` runs at build time and cannot touch Lumin: Lumin has no
data file, its catalogue only exists once its SDK answers, and its covers are
tokens rather than urls. So `src/borrow.js` does the same job in the browser
and Lumin can both lend and borrow.

Every catalogue loaded in a session registers its covers as donors, so
whichever library is on screen fills its gaps from the others.
`src/cover.js` is the one hook both the grid and the hero use, and it tries
four sources in order: the library's own url, a resolved Lumin token, a
borrowed cover, then the generated art. `''` means tried and failed and
`null` means not tried yet, which is what stops a card borrowing before its
own cover has had a chance.

Same matching rules as the build script, minus the fuzzy pass. Edit distance
is fine at build time because a person reads the printed list afterwards;
doing it in the browser would be guessing at a game's identity with nobody
checking.

**Lumin is only pulled in as a donor pool for Selenite.** Fetching it means
loading a third party's obfuscated script on a page that was not otherwise
going to, so it has to earn that, and measured against every library it only
does for Selenite: **79 of its 105 missing covers, 75%, all exact matches.**
Everywhere else it is 3 to 10 per cent, because `share-icons.mjs` has already
lent them what Selenite has and Lumin's catalogue is largely Selenite again,
its ids are namespaced `selenite/`. `LUMIN_WORTH_IT` in `App.jsx` holds that
list. The other libraries borrow from our own static files only.

The 26 Selenite blanks that stay blank are genuinely not in Lumin: Contra,
Chrono Trigger, Comix Zone, the Donkey Kong Country games. Emulator titles.

Turned off with "Borrow missing covers" in the Library tab.

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

`src/lumin.js` drives it in **headless mode**, so the SDK renders nothing and
only supplies data plus the game player. Its catalogue then goes through our
own cards, hero, rows, search, categories, favourites and settings exactly like
a json library. There is no embed component any more.

`LIBRARIES.lumin` has no `file`; `App` swaps in `useLuminCatalogue` instead of
`useGames` and everything downstream is identical.

**Their games have no category, so ours is derived.** `getCategories()` comes
back empty and each game object carries only `id`, `name` and `image_token`,
so `toEntry` runs the title through `categoryFor` from `src/categorize.js`,
the same rules the json libraries are built with. A `game.category` is used if
one ever appears.

With no description and no tags to match against, a title alone classifies
about 43% of games across all 14 categories, measured on 1547 titles from the
libraries Lumin namespaces its ids after. So expect a real spread in the rail
rather than one Arcade row, and expect Arcade to be the largest by a distance.

Three things about their data shape drive the design:

- **Covers are tokens, not urls.** `getImageUrl(token)` returns a blob url, so
  a cover has to be resolved per game. `GameCard` does that behind an
  `IntersectionObserver` with a 400px margin, because resolving a thousand
  covers for cards nobody has scrolled to would mint a thousand blob urls. The
  hero resolves immediately instead, since it is one card and always on
  screen. Resolutions are cached per token.
- **Game urls carry a single use token.** `getGameUrl(id)` has to be called
  fresh on every launch, so `GamePlayer` resolves on mount rather than storing
  a url on the entry. A cached one plays once and then fails silently.
- **Nothing settles when the service refuses you.** `init` rejects with
  "domain fetch failed", but `getGames` and `getCategories` never settle at
  all. Every call is wrapped in a 20s timeout for that reason, and without it
  the UI hangs forever with no error.

**It works from localhost, and it is verified live.** An earlier note here
said the opposite, that the service checks the domain it runs on and always
failed from localhost. That was wrong, or has stopped being true. Measured on
`localhost:5174` from a clean load: 1169 games, 1172 cards, all 14 categories
in the rail, every visible cover resolving to its own image, and a game
launching into an iframe on a fresh single use url, with no console errors.

What actually kept it broken was ours, not theirs. `useLuminCatalogue` owned
the request and guarded a second start with a ref, so under StrictMode the
first run started the fetch, the cleanup flipped that run's `cancelled` flag,
and the second run returned early without starting anything. The only request
in flight was one whose result was already being discarded, so neither the
games nor the error ever reached state and the grid sat on its skeletons
forever, looking exactly like a dead service.

**So the catalogue promise lives at module scope**, in `getCatalogue()`,
alongside `loader`. The effect only attaches handlers to it. A second effect
run then attaches fresh handlers to the same request instead of being
orphaned, and switching library away and back reuses it rather than
refetching. A rejection clears it so a later attempt retries.

The lesson generalises past this file: an effect that both starts a request
and guards itself with a ref cannot survive StrictMode. Either let it restart,
or move the request out of the effect.

`[Lumin] Worker connection failed: domain fetch failed` in the console is
**their** logging and is not fatal on its own. Do not read it as proof the
library is refusing you. Check whether games arrive before concluding
anything.

The picker no longer warns about localhost and `isLocalSite()` is gone, since
the claim behind both was false.

**If you stub the SDK to test this, clear up after yourself.** A stubbed
`window.Lumin` plus a persisted `library: 'lumin'` looks exactly like a working
Lumin that returns nonsense games and flat colour covers, which is confusing
for anyone who opens the tab afterwards. Reset the stored library and drop the
global when done.

Note that `getGameUrl` fires twice per launch in development. That is
StrictMode double invoking the effect, not a bug in the resolution; production
calls it once, and since the tokens are single use the extra one is simply
discarded.

Other facts worth keeping: the repo `luminsdk/script` has no tags, so `@latest`
is branch HEAD and changes on every push. Its two files `lumin.min.js` and
`fonts.min.js` are byte identical, same sha256, so "fonts" is a decoy name for
network filters and the loader tries both.

## When the whole site shows nothing but skeletons

Two separate causes, both seen, and they look identical on screen.

1. **The dev server is wedged on a stale transform.** A syntax error that was
   on disk for even a minute can leave the running Vite process serving a 500
   for that module and every module importing it, and it does not always
   recover once the file is fixed. The page then renders the skeletons and
   nothing else. `preview_logs` at error level shows the real parse error with
   a line number, and that line number may no longer match the file, which is
   the tell. **Restart the dev server**, do not go hunting in a file that
   already parses. Confirm it parses with `node --check <file>` first.
2. **The selected library never settles.** See the StrictMode note under the
   Lumin section. `error` and `games` both staying null renders `<Skeleton/>`
   forever, because `App` only leaves that branch when one of them is set.

Check which it is before editing anything: a 500 or a failed module reload in
the browser console points at the first, silence points at the second.

**Backslashes in a heredoc are the usual source of the first one.** This shell
collapses a doubled backslash to a single one, so a python or sed patch that
writes a character class like [.*+?^${}()|[\]\] into a js file lands as an
unterminated regex. Lint and build pass only after the fix, so a green build
from before the patch proves nothing. Prefer the Edit tool for any line
containing a backslash.

## The Look tab, and three bugs that were in it

All three made the site actively worse to use, and all three were reachable
by clicking one control.

**Gradients must not end in a bare colour.** Three of them did, as in
`radial-gradient(...), radial-gradient(...), #08080a`. That is valid in the
`background` shorthand but **not** in `background-image`, where one invalid
layer throws out the whole declaration, so the computed value was `none`.
Slosh, Coals and Slosh light therefore never drew their gradient at all, and
Slosh is the default, so the site's own base layer had been invisible the
whole time with only the drifting blobs showing over a flat body colour. Each
gradient now carries `css` for the layers and `base` for the flat colour
behind them, and the rule sets `background-color` separately. Verified in the
browser: the same string is rejected with the trailing colour and accepted
without it.

**Mode and background have to agree.** Picking a light background while in
dark mode left near white text on a near white page, measured at
rgb(245,245,247) on rgb(255,255,255), and a dark one in light mode did the
reverse at rgb(18,18,22) on rgb(8,8,10). Every slate and gradient now carries
a `tone`, the sheet switches mode along with the pick, and an option
belonging to the other mode is labelled DARK or LIGHT on its tile so the
switch is not a surprise. `setTheme` uses the same `tone` for the reverse
direction instead of its own hardcoded list.

**"Image" with no image painted a flat 55% scrim over nothing**, so the whole
site went dim and showed no picture. Selecting Image now opens the file
picker and only commits once an image exists, and `useSettings` also
downgrades that state to `gradient` in case it is reached from a saved
setting.

Backgrounds are picked from **tiles, not swatches**. Eight gradients in 28px
squares all looked like the same dark square.

## Settings sheet

Three tabs, Library / Look / Interface, so no panel is long enough to scroll
hunt. Controls sit in `.sgroup` panels, each showing its current value in its
own header, so glancing down the sheet says what is set without reading every
control. Look and Interface carry a live `Preview` of three miniature cards
built from the real `.card` markup and `artFor`, so shape, titles, accent and
art update as they change.

**The stylesheet is one block, not two.** There used to be an original pass
and a second pass appended on top that overrode most of it, which is how a
stray `.lib { flex-direction: column }` survived long enough to wrap every
library row onto two lines. 825 lines of superseded rules were deleted rather
than layered over, and every sheet selector is now defined exactly once.
Check that before adding more.

The picker deliberately has **no per row link to each source**. A dedicated
links page is planned instead. Attribution still shows in the sheet footer
and the site footer.

Breakpoints are measured, not guessed. At 375px each of the three tabs gets
107px and the labels fit with room to spare, so the icons-only rule sits at
330px; an earlier 380px guess hid them on an ordinary phone for no reason.

## The player bar

Back, the game's own cover, title and category, then the frame counter,
favourite and fullscreen.

**The badge shows the real cover**, through the same `useCover` hook as the
cards, falling back to the generated initials. It used to always be initials,
so the bar said "FC" next to a game whose artwork was sitting in the library.

**There is no new tab button.** It was removed on request, since a links page
will cover the same ground.

**The frame counter is our frame rate, not the game's.** A cross origin
iframe cannot be measured from outside and nothing exposes another
document's rate. The two usually track each other because the tab shares a
compositor, but a game the browser has put in its own process can stutter
while this still reads 60. The counter says so in settings rather than
pretending to be a benchmark. It is sampled twice a second, not per frame,
and "Frame counter" in the Interface tab turns it off along with its
`requestAnimationFrame` loop.



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

The blobs render once, in `Gate.jsx` so they exist on every route, as
`.bgfx` at `z-index: -1` behind everything.

**There used to be a second copy over the wall** at `z-index: 12` on
soft-light, added because a dense grid covers the layer behind. It was removed:
it tinted the real cover art, and because the header sits at 30 and the
settings sheet at 41, those two stayed neutral while the rail, cards, card
title bars and hero were all red washed. The page visibly split into tinted and
untinted zones. Selenite arriving with a cover for nearly every game settled
it, since recolouring real artwork to show off a background is the wrong trade.
Do not reintroduce it.

With that layer gone the blobs no longer have to fight a wall of cards to be
seen, so their strengths went back down to ambience.

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
