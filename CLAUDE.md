# Blocked

A book site.

## The vocabulary is books, the content is games

Read this before any find and replace.

Everything the site calls a book is, underneath, a browser game hosted by
somebody else. The renaming on 2026-09-17 changed **our** words only: our ui
text, our identifiers, our filenames, our route and our one data key. It did
not touch anything belonging to anyone else, and it must not.

So a `book` has a `url` pointing at `worldshardestgame`, the Retro category
matches on the keyword `gameboy`, and `BookPlayer` asks for the `gamepad`
permission. None of that is a leftover. Four categories of "game" are
deliberately still here:

- **Upstream urls, repos and directories.** 1150 urls contain the word, and
  `path: 'Games'` in `build-libraries.mjs` is a folder inside someone else's
  repo. Renaming any of them 404s real content.
- **Third party titles.** 51 of them, including "There Is No Game" and
  "Conway's Game Of Life". They are other people's work and keep their names.
- **External api names and the fields they return.** Lumin's `getGames` and
  `getGameUrl`, the `res.games` array those return, and the browser's
  `gamepad`. This is the one that actually got through: the rename turned
  `res.games` into `res.books`, which is always undefined, so every page of
  the catalogue came back empty and the app reported the library as
  unreachable. It looked exactly like their service being down, and was
  misdiagnosed as that for a while. **A property on someone else's response
  is their name, not ours.**
- **Match keywords.** `FILLER` in `share-icons.mjs` and `src/borrow.js` strips
  `game|games|gaming` out of a **third party** title before comparing it, and
  `categorize.js` matches `'gameboy'` and `'gamecube'` against real titles.
  Rename these and the matching quietly stops finding anything.

A blind replace across this repo breaks 1252 urls, renames 51 works that are
not ours, kills the Lumin integration and silently disables two matching
passes. Four of those were caught only because every url and title was
compared against the previous commit afterwards. If you rename anything else
here, do the same check: `git show HEAD:<file>` and diff the values, not the
file.

**`#/game/<slug>` still resolves.** The route is written as `book/` now, but
a url is a promise to whoever saved it, so `App` reads either prefix. Links
shared before the rename keep working instead of landing on the wall with no
explanation.

Git history before that commit still says games throughout. Vite + React 19, no backend, no router library. The whole thing
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
npm.cmd run worker   # the Cloudflare Worker locally, port 8787
```

`npm.cmd run worker` runs `wrangler dev`, which builds the site and serves it
exactly as Cloudflare does, static files and the Worker together, with its
own local copy of the picture storage in `.wrangler`. Use it on its own at
8787, or next to `dev`, which forwards `/api` and `/avatars` to it.

Port 5174 is deliberate. The user's other site, DeblockedX, uses 5173 and they
sometimes run both.

Node is a **portable** install at `C:\Users\cciec\nodejs`, not an MSI. If `node`
is missing from a shell, that shell started before the PATH change.

## How it is put together

```
public/books.json        all book data, the only file you edit to add books
src/lib.js               routing, data loading, favorites, recent, badges,
                         idle shimmer
src/settings.js          every user option, its presets, and the uploader
src/art.js               generated cover art, hash to hue/pattern/initials
src/icons.js             svg path data, category icon and tone maps
src/App.jsx              state, filtering, route switch, layout
src/components/          Header Sidebar Hero Row BookGrid BookCard
                         BookPlayer Skeleton Icon Settings LuminLibrary
src/styles.css           one stylesheet, CSS variables at the top
scripts/categorize.mjs   derive categories from titles
scripts/checklinks.mjs   check which book urls are alive and embeddable
scripts/rehost.mjs       bulk repoint book urls from one host to another
worker/                  the only server code, profile pictures on Cloudflare
wrangler.jsonc           Cloudflare's config: the Worker, assets, storage
```

`icons.js` holds the path data rather than `Icon.jsx` because a file that
exports both a component and a constant breaks Vite fast refresh.

**Hash routing** (`#/book/<slug>`), hand-rolled in `src/lib.js`, no
react-router. This keeps every URL a single static file request so the site
deploys to any host with no rewrite rules. Do not swap in a real router without
a reason, it would add a hosting requirement.

**Slugs** come from the title, so a book keeps its URL if the list is reordered.

**Categories** in the filter bar are derived from whatever `category` values
exist in the data. Adding a category needs no code change.

**Favorites** are localStorage, wrapped in try/catch because private windows and
blocked site data throw on access.

**One badge, and it reads NEW.** There used to be a second one saying HOT on
featured books. That word is gone at the user's request and is not coming
back. A featured book is not literally new, so the badge is a highlight more
than a date: no library ships an `added` field and Selenite's `featured` comes
from its own `top` tag, so without folding the two together nothing on the
wall would carry a badge at all.

**No outbound links anywhere in the interface.** The footer credit and the
settings sheet credit were both links and are now plain text. A single links
page is planned to collect them instead, and the credit still names the
source, which is the part that matters. Checked: zero `a[href^="http"]` in
the rendered page.

**The player bar shows time on the current book**, next to the frame counter.
Counted from a timestamp rather than by adding a second per tick, because a
backgrounded tab throttles the interval and a counter trusting its own tick
count would drift minutes behind. It resets per book, since `App` keys the
player by slug.

## Adding books

One object per book in `public/books.json`:

```json
{
  "title": "2048",
  "description": "Slide the tiles, match them.",
  "book_image_icon": "https://example.com/thumb.png",
  "category": "Puzzle",
  "tags": ["numbers"],
  "featured": false,
  "url": "https://example.com/book/"
}
```

This schema matches the user's DeblockedX library exactly, on purpose. That
library has about 450 curated entries at
`C:\Users\cciec\DeblockedX\games.json` and can be dropped in unchanged.

`book_image_icon` may be empty. The card falls back to the first letter of the
title.

## The real problem: link rot

Books load in an iframe, and hotlinked third-party books break constantly. Two
distinct failure modes, both seen already:

1. **Dead host.** `jakesgordon.github.io/javascript-racer` was a GitHub Pages
   site that no longer exists. Removed from the seed list.
2. **Refuses to be framed.** `gabrielecirulli.github.io/2048` redirects to
   `play2048.co`, which sets a `frame-ancestors` CSP. The iframe gives **no
   error event** when this happens, which is why `BookPlayer` shows a "New tab"
   hint after five seconds rather than trying to detect it.

The durable fix is **self-hosting** book files under `public/books/`. DeblockedX
already does this in its own `games/` folder. Prefer that over adding more
hotlinks.

### Verifying a book URL

The preview browser pane **does** render cross-origin iframes, so loading a book
in the player and screenshotting it is a valid check. Give it 4 to 6 seconds
first, since a blank frame early on often just means still loading.

A screenshot may time out with "page did not finish rendering" on a book that
animates constantly. That is not a failure, it usually means the book is
running. Retry the screenshot on its own.

Do **not** rely on `fetch()` from the app origin. "Failed to fetch" there
usually means CORS, not a 404, so it proves nothing either way. If a frame stays
blank, navigate a tab directly to the book URL and read the page text to see
whether the host is actually dead.

## Current state

451 books. **439 of them do not work**, see the section below. Four are
confirmed playable and carry `"verified": true` in books.json: Clumsy Bird,
Astray, Untrusted and 2048.

## Hosting

**What is live today:** a Cloudflare Worker named `blocked`, serving `dist`
as static assets, at https://blockede.com and
https://blocked.cciecollabc-b5c.workers.dev. Cloudflare builds and deploys it
on every push to `main` by running `wrangler deploy`, which reads
`wrangler.jsonc`. The chat and leaderboard are Firestore, not Cloudflare. The
only code running on Cloudflare is `worker/index.js`, for profile pictures.

Everything below about Pages, D1 and Render is history from before that, kept
for the reasoning. `server/chat.mjs` and `functions/` are dead code.

**`DEPLOY.md` has the step by step for a person.** This section is the why.

Two hosts are set up, because the chat needs a backend and the two kinds of
backend are genuinely different:

- **Cloudflare Pages.** Static files plus `functions/api/chat/messages.js`, a
  Pages Function on D1. Pages maps the `functions` folder to url paths, and
  that file's path is the one `src/chat.js` already asks for, so there is no
  configuration and no CORS. Needs a D1 binding named `CHAT_DB` and the two
  tables in `schema.sql`. Missing binding answers 503, which the client's
  probe reads as "no backend" and the room says it is down. Correct, not a
  crash.
- **Render.** One Node process from `render.yaml` running `server/chat.mjs`,
  which serves `dist` and the api together. The free plan sleeps after about
  15 minutes idle, and its messages are in memory, so a sleep empties the
  room.

**There are two chat backends on purpose, and they are not copies.**
`server/chat.mjs` keeps messages in an array, which is right for a process
that stays running and useless on serverless, where every request is a fresh
instance and the array would be empty each time. Anyone tempted to delete one
and point both hosts at the other should read that sentence again.

Both were tested rather than assumed. The Render shape was run for real:
`node server/chat.mjs` over a built `dist` served the html, the hashed
bundle, the stylesheet and the data files with correct content types, the api
on the same origin, and `..` and `%2e%2e` both failed to escape `dist`. The
Cloudflare handler was driven through a D1 stand in: 503 with no binding, 429
per address, 400 on bad input, name clamped to 18 and text to 240, control
characters stripped, and 260 messages in leaving 200 rows in oldest first
order. D1 itself is not covered by that, so a real deploy is still the real
test.

**Route 53 is a registrar and DNS, not a host.** A domain there points
wherever you tell it, so it works with either of the above. This came up
because it looked like the domain had been bought for nothing.


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
`/Blocked/#/book/2048-balls` opened the player. Local configs `blocked-pages`
(port 5175, subpath) and `blocked-root` (5176) reproduce both.

No mixed content: every book url and icon url in every library is `https`,
checked. Pages is HTTPS only, so an `http` url would be blocked outright.

## The dead host, now resolved

The old built in library's 439 books all pointed at
`mathematics-lessons.eclipsecastellon.com`, which went NXDOMAIN. That library
has been **replaced by Selenite**, the same site software on `music.lyrica24.top`,
which serves 914 books with their own covers and verified 914 of 915 live. The
old `public/books.json` was deleted; it is in git history if ever needed.

`scripts/rehost.mjs` still exists for the next time a host moves:

```
node scripts/rehost.mjs --probe                       which hosts are alive
node scripts/rehost.mjs --from <dead> --to <new>      dry run
node scripts/rehost.mjs --from <dead> --to <new> --write
```

A host answering 200 does not prove it serves the same book paths, so spot
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

When the spotlight book has a cover, the panel uses it: a scaled up blurred
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

**The shooting category is called FPS**, renamed from Shooter on request as a
safer word. The data files were rewritten, the build scripts now produce FPS,
and `canonicalCategory` in `src/categorize.js` renames any old name as every
library loads, so a source that still says Shooter cannot bring it back. Book
titles were not touched: "Bubble Shooter" is somebody else's title. 113 rows
changed, the 22 titles containing the word are as they were.

One colour per category, in `--tone-0` through `--tone-14`, assigned in
`CATEGORY_TONE` in `src/icons.js`. They are picked to suit the category rather
than spread evenly round the wheel: sand for Sandbox, pitch green for Sports,
neon pink for Retro, purple for Horror so it does not fight the site's own red.
Racing, Action and FPS all want to be red, so they take red, orange and
rose to stay apart.

**Every category needs its own index.** Action and FPS shared tone 11 until
Selenite made Action a 130 book category and the collision became obvious.

**Every category has its own glyph.** There were seven shapes for fifteen
categories, so Clicker, Horror, IO, Platformer, Retro, Sandbox and FPS all
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
this it composited drifting red over the book itself, tinting whatever was
being played. Still below the settings sheet at 41.

**Uploaded backgrounds are resized first.** `prepareBackgroundImage` downscales
to 1920px and re-encodes as JPEG 0.82. A 5.4MB 3000x2000 PNG came out at 39KB.
Without that step localStorage, which holds about 5MB and inflates by a third
for base64, blows its quota on the first phone photo.

## Libraries

Every selectable library is registered in `LIBRARIES` in `src/settings.js`.
`useBooks({ file })` loads whichever one is selected, so adding a library is a
data file plus one entry there.

| id | name | books | source |
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
| `lumin` | Lumin | embed | third party CDN, returns no books, see below |

**2190 books.** `selenite` is the default: 914 of 915 urls verified live and
frameable, and it is the only library that ships its own cover for nearly
every book.

### Selenite

The replacement for the old built in list, which pointed at
`mathematics-lessons.eclipsecastellon.com` and went NXDOMAIN. Same site
software on a live domain, with twice the books, so the old library was deleted
rather than rehosted.

It is the only **catalogue** source: it publishes
`/resources/games.json`, so the whole library comes from one request instead of
a directory listing. `fromCatalogue` in `build-libraries.mjs` handles it, and
adding another site like this needs a `catalogue` url rather than a `repo`.

Its rows give `name`, `directory`, `image` and `tags`:

- url is `<host>/resources/semag/<directory>/index.html`
- cover is `<host>/resources/semag/<directory>/<image>`

**The cover filename has to come from the data.** It is `cover.png` for some
books but `icon.png`, `logo.jpg`, `splash.png`, `gd.webp` and
`buckshot-roulette.apple-touch-icon.png` for others: png, jpg, jpeg, webp,
avif, ico, svg and gif all appear. Assuming `cover.png` would miss most of
them.

**Its categories come from its tags, not from `categorize.mjs`.** Every book is
tagged, across 42 tags, so `TAG_CATEGORY` in the builder maps them in priority
order: a book tagged both `horror` and `platformer` is horror first. Do not run
`categorize.mjs` on this library, it would overwrite real tags with keyword
guesses. The site's own `top` tag becomes `featured`.

Those tags also include content markers, `13+` on 20 books, `gore` on 15 and
`18+` on 5. They are preserved in each entry's `tags`, so filtering on them
later is a data question rather than a re-extraction.

**We link, we never copy.** Every url points at the source's own host, so they
serve the book and get the traffic, and nothing is mirrored here. That is also
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

Measured on all 2190 books: 64% land off the Arcade fallback across 14
categories, up from 61%, and every single library improved or held. The 36
books the strict keywords changed were checked one by one rather than sampled;
they are corrections like "Ocarina of Time" leaving Racing and "Swords And
Sandals" leaving Puzzle.

**Selenite is excluded.** Its categories come from its own 42 real tags, so
running the script over it would overwrite facts with guesses.

Adding a keyword is the normal way to fix a book. Reach for `STRICT` only when
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
doing it in the browser would be guessing at a book's identity with nobody
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
Chrono Trigger, Comix Zone, the Donkey Kong Country books. Emulator titles.

**Always on.** There was a "Borrow missing covers" toggle and it did nothing:
cards never read it, it only decided whether extra donor libraries loaded,
so they kept borrowing from whatever was already registered. Measured at 134
covers with it on and 134 with it off. It was a nerdy switch nobody would
turn off even if it worked, so it was removed rather than fixed.

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

`share-icons.mjs` closes part of that gap. The same books recur across
collections, so a book with no icon borrows from a same-named book that has
one. 89 books picked up real art this way. Two rules keep it honest:

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
2. **loose.** Filler words are dropped first (`book`, `unblocked`, `online`,
   `play`, `free`, `io`, `version`), so "Slope Book" can match "Slope".
3. **prefix.** A donor whose whole title is a prefix of this one, minimum
   seven characters, longest donor winning. This is the pass that actually
   pays: "Geometry Dash Unblocked", "Retro Bowl Old",
   "Snow Rider 3D Unblocked - Play Online" and "Basket Random Unblocked" are
   all many edits from their donor but obviously the same book. Seven
   characters is the floor because "drift" would otherwise lend to every
   drift book.
4. **fuzzy.** Levenshtein, with the allowance scaled to length,
   `floor(longest / 5)` capped at `--max-distance` (3 by default) and
   nothing under `--min-length` (8). Three characters out of nine is a
   different book, three out of twenty is a spelling variant. This is what
   catches "Volley Random" borrowing from "Volly Random".

**Sequel numbers must agree exactly.** The digits in both titles are compared
rather than digits being banned outright, so "cookieclicker2" can still match
a longer variant while "geometrydash2" is refused against "geometrydash3" and
"ducklife2" against "ducklife3".

Tuning flags: `--max-distance`, `--min-length`, `--prefix-min`, and
`--reset` to clear previous borrows so changed rules re-lend from scratch.
Every inexact match is printed in full rather than sampled, because those are
the ones worth eyeballing.

**310 books borrow art** with these rules, up from 108 before Selenite
arrived. Selenite is the donor pool that made the difference: it ships 804
working covers against Alexx743's 58, so hell went from 32 borrowed to 106,
gams from 6 to 33, and goblin from 20 to 42.

**`--verify-own` blanks dead covers.** Selenite lists a cover filename per book
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
rebuild reinstated books already proved dead and the verification had to be
redone from scratch.

**The checker only prunes on 404 and 410.** A 429, a 5xx or a timeout is
recorded as `unknown` and kept. This matters: an early version treated any
non-ok response as dead and deleted 31 working p0xx books after GitHub Pages
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
  not render it in a frame. That rules out jsDelivr as a book host generally.
- **PeteZah** (156) `PeteZah-Games/PeteZahStatic`. Every path on
  petezahgames.com redirects to `/verify?reason=activity`, a bot check, and
  their Pages domain redirects there too. A framed book would show the check.
  Working around a bot check is not on the table.
- **Ruby** (68) `ruby-network/ruby`. Has a genuinely good catalogue at
  `src/public/games.json` with tags and thumbnails, and its url pattern is
  `gms/ruby-network/ruby-assets/main/<name-lowercased-hyphenated>/<baseFile>`.
  But the site returns 523, sends `X-Frame-Options: SAMEORIGIN`, and the
  asset repo is 404.
- **julianlockibarra-cat/games**. Pages is off and there is no other host, so
  UNITY GAMES, FLASH GAMES and the third folder cannot be served.
- **schplay** `paralzyed/schplay.github.io`. Empty apart from site pages, no
  book files to index.
- **The Dropbox folder.** Dropbox does not serve shared HTML as a rendered
  page, so a book cannot run in a frame from it. Its listing is JS rendered,
  so a plain fetch cannot enumerate it either.

Any of these become usable the moment their files sit on a host that serves
`text/html` and does not refuse framing.

## The Lumin library

`src/lumin.js` drives it in **headless mode**, so the SDK renders nothing and
only supplies data plus the book player. Its catalogue then goes through our
own cards, hero, rows, search, categories, favourites and settings exactly like
a json library. There is no embed component any more.

`LIBRARIES.lumin` has no `file`; `App` swaps in `useLuminCatalogue` instead of
`useBooks` and everything downstream is identical.

**Their books have no category, so ours is derived.** `getCategories()` comes
back empty and each book object carries only `id`, `name` and `image_token`,
so `toEntry` runs the title through `categoryFor` from `src/categorize.js`,
the same rules the json libraries are built with. A `book.category` is used if
one ever appears.

With no description and no tags to match against, a title alone classifies
about 43% of books across all 14 categories, measured on 1547 titles from the
libraries Lumin namespaces its ids after. So expect a real spread in the rail
rather than one Arcade row, and expect Arcade to be the largest by a distance.

Three things about their data shape drive the design:

- **Covers are tokens, not urls.** `getImageUrl(token)` returns a blob url, so
  a cover has to be resolved per book. `BookCard` does that behind an
  `IntersectionObserver` with a 400px margin, because resolving a thousand
  covers for cards nobody has scrolled to would mint a thousand blob urls. The
  hero resolves immediately instead, since it is one card and always on
  screen. Resolutions are cached per token.
- **Book urls carry a single use token.** `getGameUrl(id)` has to be called
  fresh on every launch, so `BookPlayer` resolves on mount rather than storing
  a url on the entry. A cached one plays once and then fails silently.
- **Nothing settles when the service refuses you.** `init` rejects with
  "domain fetch failed", but `getGames` and `getCategories` never settle at
  all. Every call is wrapped in a 20s timeout for that reason, and without it
  the UI hangs forever with no error.

**It works from localhost, and it is verified live.** An earlier note here
said the opposite, that the service checks the domain it runs on and always
failed from localhost. That was wrong, or has stopped being true. Measured on
`localhost:5174` from a clean load: 1169 books, 1172 cards, all 14 categories
in the rail, every visible cover resolving to its own image, and a book
launching into an iframe on a fresh single use url, with no console errors.

What actually kept it broken was ours, not theirs. `useLuminCatalogue` owned
the request and guarded a second start with a ref, so under StrictMode the
first run started the fetch, the cleanup flipped that run's `cancelled` flag,
and the second run returned early without starting anything. The only request
in flight was one whose result was already being discarded, so neither the
books nor the error ever reached state and the grid sat on its skeletons
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
library is refusing you. Check whether books arrive before concluding
anything.

The picker no longer warns about localhost and `isLocalSite()` is gone, since
the claim behind both was false.

**If you stub the SDK to test this, clear up after yourself.** A stubbed
`window.Lumin` plus a persisted `library: 'lumin'` looks exactly like a working
Lumin that returns nonsense books and flat colour covers, which is confusing
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
   Lumin section. `error` and `books` both staying null renders `<Skeleton/>`
   forever, because `App` only leaves that branch when one of them is set.

Check which it is before editing anything: a 500 or a failed module reload in
the browser console points at the first, silence points at the second.

**Backslashes in a heredoc are the usual source of the first one.** This shell
collapses a doubled backslash to a single one, so a python or sed patch that
writes a character class like [.*+?^${}()|[\]\] into a js file lands as an
unterminated regex. Lint and build pass only after the fix, so a green build
from before the patch proves nothing. Prefer the Edit tool for any line
containing a backslash.

## The chat room

`src/components/ChatRoom.jsx`, opened from the button at the bottom of the
rail, and it renders where the wall does.

**It is not a route, on purpose.** The open state is a `useState` in `App`, so
picking a category, typing a search or reloading all leave it, which is the
behaviour that was asked for. A route would survive a refresh and drop people
back into a room they did not ask for. All three exits are verified.

**The chat is on Firestore, and needs no backend of ours.** The browser talks
to it directly, so the room works on any static host and locally. `connect()`
in `src/chat.js` signs in anonymously and returns whether the room is usable;
until `src/firebase.js` is filled in it returns false and the room says it is
down, which is true and keeps the repo deployable before anyone touches
Firebase.

**There is no polling.** A snapshot listener delivers every change as it
happens. The previous version asked an http endpoint every three seconds
because it was written against the dumbest possible backend; that client, the
D1 function and the node api are all in git history.

**Everyone is signed in anonymously, and that is not about identity.** It
gives each visitor an id that `firestore.rules` can hang the rate limit off.
Without it there is no way to tell one person flooding the room from a
hundred people talking. Nobody sees a login.

**`firestore.rules` is the only thing protecting the data.** The Firebase
config ships to every browser by design, so "nobody knows the key" is not a
defence. The rules are written for a reader who has the config and a browser
console, and they are tested rather than eyeballed:

```
npm.cmd run rules:test
```

21 cases against the real emulator, all passing. The one that matters most is
"a message with no marker update is refused": the rate limit works by
requiring a message and the sender's rate marker to move in the same commit,
checked with `getAfter`, so nobody can post repeatedly while leaving their
marker stale. Needs Java 21 or newer; this machine has 17 on the PATH and 22
at `C:\Program Files\Java\jdk-22.0.2+9`, so pass `JAVA_HOME` if the
emulator complains.

**The chat is lazy loaded.** The Firebase sdk is larger than the rest of the
app put together: bundled in, first load went from 88kB to 248kB gzipped for
a feature most visitors never open. `App` pulls `ChatRoom` in with
`React.lazy`, so the main bundle is back to 84kB and the 155kB chat chunk is
fetched on the click that needs it.

**200 is a read limit here, not a delete.** Old messages stay in Firestore.
Pruning needs a scheduled function, which is not on the free plan, or letting
visitors delete each other's messages, which is worse than a growing
collection.

`probeBackend()` in `src/chat.js` does that check, and **`res.ok` is not
enough**. Plenty of static hosts answer an unknown path with their own
index.html and a 200, which would convince a naive check that a backend
exists and then fail on every read. So it also requires a json content type
and an actual `messages` array. GitHub Pages returns a real 404, which is the
easy case; the html-with-200 hosts are why the other two checks are there.

The contract is two routes, kept small so anything can implement it:

```
GET  <base>/messages  -> { messages: [{ id, user, text, at }] }
POST <base>/messages  <- { user, text }   -> { message } | 429
```

`<base>` is `VITE_CHAT_API` if set at build time, otherwise `api/chat` on the
same origin.

**`server/chat.mjs` is a working implementation**, no dependencies, about a
hundred lines. It exists so the working path is verified rather than assumed,
and as the smallest honest answer to what a host has to provide.

**All of this http chat is history.** The chat moved to Firestore, the
`npm run chat` script is gone, and port 8787 and the `/api` proxy now belong
to the Cloudflare Worker for profile pictures. `server/chat.mjs` is kept only
as a record; nothing runs it.

### What the room does

- **The name is the Blocked account.** The room asks only when there is no
  account yet, and never again after. See Accounts below.
- **Newest 200 kept**, oldest dropped, and the cap is enforced on both sides.
  The client asking for 200 is a display choice, not a limit anyone is held
  to, so the server slices as well. Verified: 250 in, 200 out, newest kept.
- **Rate limited at 1500ms between sends.** The composer counts down so the
  limit is visible rather than the button just refusing, but that is a
  courtesy, not a control: anyone can post at the endpoint with curl. The
  interval is enforced per address on the server, which is the only place it
  means anything. Verified returning 429.
- **32 colours, one per person.** Only the hue is stored on the element, in
  `--u`; the lightness comes from the theme through `--chat-l`, because a hue
  readable on the dark panel is far too pale on the light one. Hues are walked
  by the golden angle rather than in order, so two names whose hashes land in
  neighbouring slots still look different, and the hue comes from an FNV-1a of
  the lowercased name so the same person is the same colour in everyone's
  window. Measured over 2000 names: all 32 slots used, 53 to 73 per slot
  against an even 62.5.
- **Message text is rendered as text, never markup**, and wraps with
  `overflow-wrap: anywhere` so a long unbroken string cannot widen the column.
  The server strips control characters and clamps a name to 18 and a message
  to 240, verified.

## Switching mode

**There is a mode toggle in the header, left of the gear.** One click, from
anywhere, no sheet.

It matters that it is there. Mode used to be a header toggle, then the gear
replaced it and mode moved inside settings, which put it three steps away:
open the sheet, find the Look tab, scroll to Mode. That is too far for the
option people change most often, and it is why a light theme can feel like
being stuck in one. The gear still holds everything else.

**`pairTheme(settings, theme)` in `src/settings.js` is the only copy of the
mode/background pairing rule**, used by both the header toggle and the sheet.
It was written inside the sheet first; a second copy in the header would have
drifted from it the way the categorizer's two copies did.

**`?theme=dark` or `?theme=light` overrides whatever is saved.** An escape
hatch that does not depend on the interface being usable, since every option
is stored and a bad saved state would otherwise only be reachable through the
panel that is hard to read. It pairs the background too, so forcing dark onto
a saved light gradient does not swap one unreadable combination for another.

Two things make it an actual rescue rather than a demo:

- **It is written to storage.** `read()` only seeds the state, so without a
  save on mount the override lasted until the next navigation and rescued
  nobody. That was the first version of it.
- **The parameter is then stripped** with `history.replaceState`, so a copied
  link does not pin whoever opens it to that mode, and the effect stops
  matching once it has done its work.

Verified: stranded on light with a light gradient, `?theme=dark` renders dark,
writes `theme: dark` and `bgGradient: slosh`, cleans the url, and survives a
reload with no parameter.

A full reset is still the other way out: "Reset everything" in the sheet
footer restores `DEFAULTS`, which is dark mode.

Note for the next time a report like "stuck in light mode" comes in: it was
not reproducible against the code at the time, from any `bgKind`, with the
toggle working across repeated round trips and the gear measured at 5.76:1
contrast in light mode so it was clearly visible. The likely cause was a
browser running a stale bundle, which this session had already produced once.
Check what the page is actually running before hunting in the source. There is
no `prefers-color-scheme` anywhere in the stylesheet, so the OS setting cannot
be involved; `data-theme` is the only thing that decides.

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

Backgrounds are picked from **tiles, not swatches**. Thirty gradients in 28px
squares all looked like the same dark or light square.

### The gradient presets

**30 gradients, 18 dark and 12 light.** The first six of each are the neutral
ones the site started with; the rest are coloured, which is what the set was
missing when every option was either near black or near white.

Three things are true of every preset, and a new one has to keep all three.

**`css` holds gradient layers only and `base` is the flat colour.** Never end
`css` in a bare colour. See the trap above.

**`tone` says which mode it belongs to, and it is enforced, not decorative.**
The text colour comes from the mode, so a preset is only readable under the
one it claims. Picking from the other group switches the mode with it.

**`fx` is the colour of the drifting blobs**, a trio of drift, deep and
bright. Without it the blobs stay on the accent and swamp the base, so
choosing "Aurora" gave a crimson page with teal barely visible underneath and
the preset was pointless. The eight neutral presets deliberately have no
`fx`: clearing those properties puts the blobs back on the accent, which is
what keeps "picking an accent retints the background" true for the defaults.
So a coloured preset is a two colour scheme, its own background plus the
accent still driving buttons, art and the category icons.

**Readability is checked, not eyeballed:**

```
npm.cmd run check:presets
```

`scripts/check-gradients.mjs` pulls every hex out of every preset, gradients
and solids both, and measures WCAG contrast against the text colour of the
mode it claims: #f5f5f7 for dark, #121216 for light. Nothing may fall below
4.5:1, and it also reports when a preset's colours suit the opposite tone to
the one declared. Currently all 36 pass, the worst being Peacock at 12.29:1.
Run it after touching any palette; it exits non zero so it can gate a build.

Every stop is checked rather than an average, because the layers fade to
transparent over the base and the real background sits somewhere between. If
the brightest stop in a dark preset clears the bar, everything mixed from it
does too.

Verified in the browser as well as on paper: all 30 clicked through, every
one renders its layers rather than computing to `none`, every one lands in
the right mode, the 22 coloured ones produce 22 distinct blob tints and the 8
neutral ones fall back to the accent.

**Testing note.** Clicking a preset from the other tone group re-sorts the
picker, because the current mode's group is rendered first. A test that
snapshots the tile elements once and then clicks through the array will find
its later nodes detached and silently click nothing, which looks exactly like
the presets not applying. Re-query each tile by name before clicking it.

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

**`.sgroup` and `.sheet-foot` are `flex: none`, and the sheet depends on it.**
Without it the sheet was unusable on any short screen: the body is a flex
column, and when content is taller than the window flexbox shrinks the
children to fit instead of letting the body scroll. Each group's `overflow:
hidden` then clipped everything under its title, so on a 1280x600 window every
group showed as a bare header with its controls squashed to zero height. It
never showed on a tall monitor, which is how it shipped. Measured after, at
1280x600 and 360x640: every group at its full height on every tab, the body
scrolling, and nothing past the right edge.

**No descriptions.** Every hint line and explanatory note was removed on
request: under group titles, under toggles, under the performance control,
the library notes and the header subtitle. The controls say what they do.
Keep it that way; anything worth explaining belongs here, not in the sheet.

**Plain names.** Accents, solids and gradients are named by colour, Red,
Teal, Light blue, rather than Crimson, Aurora, Sorbet. Only the labels
changed, never the ids, so every saved choice still resolves. The names show
as tooltips and in each group header's value.

**Background tiles are swatches with no label.** A name under every tile
doubled the picker's height for words nobody needed, since the swatch is the
preview. A one word heading, Light or Dark, separates the presets that switch
mode from the ones that do not.

**A gradient swatch is `css` plus `base`.** The page paints the two as
separate properties because a bare colour is invalid in `background-image`,
but a tile uses the `background` shorthand, where a trailing colour is valid,
so there they go back together. Without the base every light gradient's tile
showed the dark panel through it.

## The player bar

Back, the book's own cover, title and category, then the frame counter,
favourite and fullscreen.

**The badge shows the real cover**, through the same `useCover` hook as the
cards, falling back to the generated initials. It used to always be initials,
so the bar said "FC" next to a book whose artwork was sitting in the library.

**There is no new tab button.** It was removed on request, since a links page
will cover the same ground.

**Two timers: this visit, and all time.** The clock chip is this visit and
resets per book. TOTAL is every visit to that book in this browser, kept in
`blocked:booktime` by `src/booktime.js`, one object of slug to seconds. It is
built on the visit timer's own `elapsed` rather than a second clock, so the
two tick together and the total can never read less. Saved every ten seconds,
on leaving the book and on `pagehide`; each save reads storage fresh and adds
only the unsaved part, so two tabs of one book add up instead of overwriting.
Local rather than on the server because the account is per browser anyway,
and this needs no account and no request. Verified: 20 saved on leaving, the
next visit read 0:03 and TOTAL 0:23, and a reload carried on from 23.

**A direct link renders the player before the book exists**, while the
catalogue is still loading, with `book` undefined. The first total hook
crashed the whole page there: `mark?.slug === slug` is `undefined ===
undefined`, true, so it used a mark that was still null. Anything keyed on the
slug has to survive the slug being undefined.

Below 520px the two stack into one column, clock line over TOTAL line, which
gives the book title back about 65px on a 360px phone.

**The frame counter is our frame rate, not the book's.** A cross origin
iframe cannot be measured from outside and nothing exposes another
document's rate. The two usually track each other because the tab shares a
compositor, but a book the browser has put in its own process can stutter
while this still reads 60. The counter says so in settings rather than
pretending to be a benchmark. It is sampled twice a second, not per frame,
and "Frame counter" in the Interface tab turns it off along with its
`requestAnimationFrame` loop.



## Performance, and why the defaults are lean

The site was reported as unusable on a low end laptop. It was, and it was
measurable on a fast one: scrolling the wall ran at a **median 33ms per frame
with 13 of 59 frames over 50ms**. Three things were paying for that, in order
of cost.

**The whole library was mounted at once.** 929 cards at 18 elements each is
about 17,000 dom nodes and 824 img tags in one document. `BookGrid` now builds
the wall in batches of 120 behind an IntersectionObserver with a 600px margin,
so nobody sees a seam. The batch count resets when the list changes, or a
search would be bounded by the previous list's grown count.

**`backdrop-filter` on the header, the rail and the sheet.** A blurred copy of
whatever sits behind a sticky element is recomposited every scroll frame. It
is one of the most expensive things a page can ask for and there were six of
them. Removing the blur means removing the translucency with it, or those
surfaces read as smeared rather than deliberate.

**Continuous animation.** Five drifting blobs, the hero mesh, the brandmark,
the card shine, and a staggered entry animation per card, which at 120 a batch
is 120 simultaneous transform and opacity animations per scroll.

Measured after, same script, same machine:

| | before | after |
| --- | --- | --- |
| median frame | 33.4ms | 5.6ms |
| p95 frame | 66.8ms | 11.2ms |
| frames over 50ms | 13 of 59 | 0 of 245 |
| dom nodes | 16,942 | 2,346 |
| img tags | 824 | 28 |
| backdrop-filter layers | 6 | 0 |

`effects: 'lean'` is the default and drives `data-fx`. **Fast mode is
authoritative, and the first version of it was not.** It set `bgAnimated` at
the moment its button was clicked and enforced nothing, so anyone whose saved
settings predated it kept all five blobs sloshing under a control that read
Fast. It also named about five animations out of the stylesheet's 26 infinite
ones, so the rest carried on. Both were reproduced before being fixed.

So `data-fx="lean"` now does three things regardless of any other setting:

- **`animation: none !important` on every element and pseudo element.** Not a
  list of names, because a list is how the first version missed 21 of them.
  The spinner is the one exemption, since a frozen spinner reads as a crash.
- **`.fx { display: none }`.** The blobs are not drawn at all rather than drawn
  and held still. Five large radial layers held still are still five layers
  to paint and composite.
- The blur and translucency on the header, rail and sheet.

Transitions are untouched. They only run on a hover or a click, cost nothing
at rest, and are what keep the page feeling responsive. Checked before the
blanket rule went in: nothing can vanish when its animation stops, because
the icon draw-on rests at `stroke-dashoffset: 0`, fully drawn, and every
`opacity: 0` base style in the sheet is a hover reveal done by transition.

Verified with the exact state that was sloshing, a saved `bgAnimated: true`
under Fast: 0 running animations and no blobs drawn, where it had been 7.
Switching to Full effects draws and animates all five, and back to Fast
returns to 0.

**There are no separate Moving background or Idle shimmer toggles.** They
were removed because in Fast mode they could not do anything, and a switch
that does nothing is a broken setting. **Performance** owns both: Fast is
none, Full is all of it.

Do not put `backdrop-filter` back without gating it on `data-fx="full"`, and
do not add an animation that Fast has to be told about by name.

## Lumin is the default, with a fallback

Lumin is the default library on request. It is also the lighter first load:
its covers are tokens resolved per card as they scroll into view, where
Selenite puts 824 img urls in the document.

But it is somebody else's service over somebody else's cdn, and a default that
shows an error as the front page is a defect. So a Lumin failure falls through
to Selenite **for that visit**, and `App` keeps `activeLib` pointing at what
is actually on screen so the footer credits the right people rather than
claiming Lumin's name over Selenite's books.

**The setting is deliberately not rewritten.** The choice stays Lumin and the
next visit tries again, because silently changing what someone picked is worse
than a quiet fallback.

Tested by pointing `SOURCES` at urls that do not exist and rebuilding: no
error screen, 914 Selenite books, footer crediting Selenite, and the stored
choice still Lumin.

## Moving background

Red on black. Only drawn in **Full effects**; Fast mode, the default, does
not draw the blobs at all. The base gradient under them is static either way.
It holds still under OS reduced motion.

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
untinted zones. Selenite arriving with a cover for nearly every book settled
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

## Accounts

An account is a name, tied to this browser. `src/account.js` holds it in
`blocked:account` and `useAccount()` reads it anywhere. No password and no
sign in screen, on purpose: the user asked for no extra steps.

**One prompt, three doors.** `AccountPrompt.jsx` is the only place an
account is made, and it is shown by the chat room, the settings sheet and the
Account page. Whichever someone reaches first makes the account; the other
two then never ask. It reuses the chat's own classes so it looks exactly like
the old chat prompt, which was the request.

**Settings are locked until there is an account.** The sheet renders the
prompt instead of its tabs. The header mode toggle stays outside that lock.

**Old chat names become accounts.** `load()` migrates `blocked:chatname`
into `blocked:account` on first read, so anyone who joined the chat before
accounts existed is signed in already. Verified in the browser.

**What pairs it across the chat and the leaderboard is the anonymous uid**,
not the name. `src/fbclient.js` is the one Firebase app the whole site
shares, and `signInAnonymously` hands back the browser's saved user rather
than minting a new one, so the uid is the same across reloads. Verified: the
same leaderboard row id before and after a reload. Names are not unique,
same as the chat always was.

The honest limit, worth repeating to the user if they ask: clearing site
data, a private window or another device is a new account, because there is
nothing to log back in with. Fixing that needs a real sign in, which is the
extra step they did not want.

**`account.js` and `names.js` must stay free of Firebase.** Both load on
every page. The sdk is about 160kB gzipped and is only fetched by the lazily
loaded chat, leaderboard, account page and play time code.

**The settings sheet is always mounted**, it only slides in. So the prompt
takes a `focus` prop instead of `autoFocus`; autoFocus grabbed the cursor on
page load for a box that was off screen.

## Leaderboard

Time played, in Cloudflare D1, one row per account in a `players` table
holding `uid`, `name`, `seconds` and `updated`. `worker/leaderboard.js` owns
it; `src/playtime.js` talks to it; `Leaderboard.jsx` shows the top 50 and,
when you are not in it, your own row after a gap with your real rank from a
count.

**It was on Firestore first and never worked live.** The Firestore version
depended on security rules that have to be published by hand from the
Firebase console, and that step never happened, so the live board said it was
down from day one while the chat, whose rules were published earlier, worked.
Checked directly: a signed in read of `leaderboard` was 403 while
`rooms/main/messages` was 200. Moving it to the Worker means the checks ship
with every push and there is nothing left to publish. The Firestore rules
block and its tests were deleted; the catch all keeps that collection closed.

**The player counts only visible time**, and writes it once a minute plus on
leaving the book (`usePlaytime` in `BookPlayer.jsx`). A book in a background
tab is not being played. Under 5 seconds is not worth a write and stays
banked for the next one. Nothing is counted without an account.

**The Worker decides what counts, not the browser.** `POST /api/playtime`
needs a verified Firebase token, like picture uploads. Whatever it is asked
to add is capped at 90 a write and at the time actually passed since that
account's last write plus 5 seconds, and both caps are inside one SQL
statement so D1 applies them atomically. Tested against local D1 with real
sign ins: 100,000 asked on a first write stored 90; a second 60 sent at once
stored 5; four writes of 60 fired together 20 seconds after the last stored
exactly 30 between them; negative, non numeric and nameless writes are 400.
It clamps rather than refuses, so a client that banked too much after a
network blip loses the excess instead of the whole write.

**A rename only updates a row that exists** and leaves `updated` alone, so
an account that has not played yet never shows at zero and renaming does not
eat into the next write's allowance.

**The table is created by the Worker on first use**, `CREATE TABLE IF NOT
EXISTS` once per instance, because `wrangler deploy` does not run D1
migrations. The database itself is provisioned on deploy like the picture
store: `d1_databases` has a binding and no id, on purpose.

**Reading is a plain fetch with no Firebase.** `GET /api/leaderboard` is
public, `?uid=` only says which row to find, `&only=me` skips the top 50 for
the account page. The own uid comes off the account, so opening the board no
longer downloads the Firebase sdk at all. D1 allows 5 million rows read a day
free against Firestore's 50,000.

**It is read once when opened, not listened to**, same as before.

To see the local database: `npx.cmd wrangler d1 execute DB --local --command
"SELECT * FROM players ORDER BY seconds DESC LIMIT 5"`. Drop `--local` for the
live one, which needs a `wrangler login` first.

### Testing against the emulator

The leaderboard itself is tested with `npm.cmd run worker` now, since it no
longer touches Firestore. The emulator is still the way to test the chat.

```
npm.cmd run dev:emulated
```

Runs the Firestore and Auth emulators and a dev server on 5177 with
`--mode emulated`, which loads `.env.emulated` and sets `VITE_EMULATOR=1`.
`fbclient.js` then connects to the emulators under project `demo-blocked`.
Nothing touches real data, and the rules under test are the local file, so
this works before they are published. Needs Java 21+, see the chat section.
The preview config `blocked-emulated` runs the dev server half; start the
emulators first.

Rows can be seeded past the rules with the REST api and
`Authorization: Bearer owner`, which is how the off-board row was tested with
55 fake players.

Two traps from testing it:

- **A Lumin slug from one load may not exist in the next.** A Lumin failure
  falls back to Selenite for that visit, so a book opened then can be "Book
  not found" after a reload that got Lumin. No book means no time counted,
  correctly, and it looked exactly like the timer being broken.
- **The browser pane's Enter does not submit forms.** Its synthetic keydown
  carries no default action, so a plain html form with one input ignores it
  too. Click the button instead. `Return` is worse: it arrives with an empty
  key.

## Profile pictures

Upload one on the Account page; it shows on your badge everywhere, in the
chat, the leaderboard and the rail, to everyone.

**Stored on Cloudflare, not Firebase.** Firebase Storage needs the paid plan
now, and a picture in Firestore would cost a read for every badge on every
screen, against the 50,000 a day the chat already leans on. On Cloudflare a
picture is cached at the edge and in the browser, so looking at one costs
Firebase nothing.

- `worker/index.js` takes `PUT` and `DELETE` on `/api/avatar` and serves
  `GET /avatars/<uid>`. Pictures are in Workers KV under `avatar:<uid>`.
  KV rather than R2 because R2 needs a card on file to switch on and KV does
  not.
- **The KV namespace has no id in `wrangler.jsonc` on purpose.** Wrangler
  creates it on the first deploy and reuses it after. Do not paste an id in
  unless that namespace is deleted.
- **`run_worker_first` sends only `/api/*` and `/avatars/*` to the Worker.**
  Every page load and asset is a static file, free and uncounted. The free
  plan allows 100,000 Worker requests a day, and only picture traffic spends
  them.

**Who you are is checked, not trusted.** The browser sends its Firebase ID
token, and `worker/firebase-token.js` verifies it against Google's published
keys by hand, since the admin sdk does not run on Workers: RS256 only, then
signature, audience and issuer against `FIREBASE_PROJECT`, expiry and issue
time. The uid comes out of the verified token, never the request, so nobody
can write to someone else's picture. Tested: no token, a garbage token, an
unsigned `alg: none` token and an unknown key id are all 401.

**The picture is made small in the browser.** `avatar-upload.js` crops the
middle square, scales it to 160px and encodes WebP, or JPEG where a browser
cannot write WebP. A 119KB test PNG went up as 1.9KB. The Worker takes at
most 64KB and checks the bytes really are WebP or JPEG, whatever the request
claims, then serves them with a fixed image type, `nosniff` and a sandbox
policy, so a crafted file cannot run as a page on our origin. No SVG, since
SVG can carry script. Tested: html sent as a picture is 415, 70KB is 413.

**One change per account per 20 seconds**, uploads and removals both. KV's
free plan allows 1,000 writes a day for the whole site; the gap stops one
person spending them. It does not stop someone minting many anonymous
accounts, and nothing cheap would. The worst case is that uploads fail until
the next day. Viewing is unaffected.

**Nobody's picture is known in advance.** A badge just asks for
`/avatars/<uid>` and most answer 404. That answer is cached like a picture,
ten minutes in the browser and at the edge, and `avatar.js` remembers misses
for the visit, so a chat full of people without pictures asks once per
person. Measured: a leaderboard and a chat showing the same three people made
three requests between them. The cost is that a new picture takes up to ten
minutes to reach people who already looked. Your own is instant, because
your browser asks with `?v=<when it changed>`.

**The initial is always underneath.** `Avatar.jsx` lays the picture over the
old initial badge, so a missing or slow picture looks exactly like the badge
always did, never a broken image.

**The account knows its uid** (`linkUid` in `account.js`, called on every
sign in), because the rail shows your picture on every page and must not load
Firebase to find out whose it is. A different uid than before means the
browser's sign in was reset, and the old picture is dropped from the account.

### Removing someone's picture

There is no moderation, and it is a public image upload. If a picture has to
go: right click it, copy the image address, and the part after `/avatars/`
is their uid. Then Cloudflare dashboard, Storage and databases, Workers KV,
the namespace named after the Worker, find the key `avatar:<uid>` and delete
it. Other people may keep seeing a cached copy for up to ten minutes.

### Testing pictures

`npm.cmd run worker` and open http://localhost:8787. Real Firebase sign in
works from localhost, so the whole upload runs for real against a local copy
of KV. To see someone else's picture, put one straight into local storage and
open the emulated site next to it, which forwards `/avatars`:

```
npx.cmd wrangler kv key put avatar:seed0 --path <file.webp> --binding AVATARS --local --metadata '{"type":"image/webp","at":1}'
```

Uploading does not work in `dev:emulated`: emulator tokens are unsigned, and
the Worker has no switch to accept them, on purpose.

The browser pane cannot drive a file picker, so tests set the input's files
through a `DataTransfer` and dispatch `change`, which React handles like a
real pick.

## If Firebase or the site gets slow or runs out

What each piece can take on the free plans, and what would move to
Cloudflare if one runs short. Nothing here is close yet: about 114 visits a
day at the time of writing.

- **Firestore reads, 50,000 a day, are the first thing to run out.** Opening
  the chat reads up to 200 messages, so roughly 250 chat opens a day empties
  it, and the leaderboard is 50 more per open. When it runs out the chat and
  leaderboard stop until midnight Pacific. Check Firebase console, Firestore,
  Usage. The Cloudflare answer is a Durable Object for the chat, which is
  what Cloudflare built for chat rooms, one object holding the room over
  websockets, on the free plan; and D1 for the leaderboard, 5 million reads a
  day free.
- **Worker requests, 100,000 a day,** are only spent on pictures, see above.
- **The static site** is already on Cloudflare's network and costs nothing
  per visit.
- **A slow book is not ours.** Books run from other people's servers inside a
  frame, and nothing on our side can speed those up.

## Control characters in source files

**Never write `\u0000` style escapes through any tool, Bash heredocs included.** The
tool's JSON layer turns them into the raw bytes, and it happened again while
writing this very note, so a regex meant to strip
control characters lands in the file containing real NUL and ESC bytes. It
usually still works, which is why it goes unnoticed, but it breaks diffs,
greps and some editors. `src/names.js` builds that character class from
`String.fromCharCode` for this reason. `server/chat.mjs` and
`functions/api/chat/messages.js` still carry raw bytes from before; both are
dead code now that the chat is on Firestore.

## Writing style

User-facing text on this site must not read as AI-written. No em dashes, no en
dashes, no flowery product-copy descriptions. Short and plain. This is a
standing rule across all of this user's projects.

## About the user

Newer to web development. Explain the why, not just the command, and give one
command at a time rather than a chain. They are experienced with Minecraft
modding, so programming concepts land fine, the unfamiliar part is the web
toolchain and Windows shell friction.
