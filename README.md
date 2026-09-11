# Blocked

A game site. Vite + React, no backend.

## Run it

```
npm install
npm run dev
```

Opens on http://localhost:5174

## Build

```
npm run build
```

Output lands in `dist/`, which is plain static files. Any static host works.

## Adding games

Everything lives in `public/games.json`. One object per game:

```json
{
  "title": "2048",
  "description": "Slide the tiles, match the numbers.",
  "game_image_icon": "https://example.com/thumb.png",
  "category": "Puzzle",
  "tags": ["numbers"],
  "featured": false,
  "url": "https://example.com/game/"
}
```

`game_image_icon` can be left empty. The card falls back to the first letter of
the title.

Categories in the filter bar are built from whatever `category` values exist, so
adding a new one needs no code change.

Games open in an iframe. Some hosts refuse to be framed, and there is no way to
detect that from the page, so the player shows a "New tab" button after five
seconds.
