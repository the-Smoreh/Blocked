# Blocked

A book site. Vite + React, no backend.

## Run it

```
npm install
npm run dev
```

Opens on http://localhost:5174

## Build

```
npm.cmd run build
```

Output lands in `dist/`, which is plain static files. Any static host works.

## Putting it on GitHub Pages

Push the repo, then set **Settings -> Pages -> Source** to **GitHub Actions**.
The workflow in `.github/workflows/deploy.yml` builds and publishes on every
push to `main`, and can also be run by hand from the Actions tab.

There is nothing to configure for the repo name. `vite.config.js` uses
`base: './'`, so the same build works at

- a project site, `https://<user>.github.io/<repo>/`
- a user site, `https://<user>.github.io/`
- a custom domain

Both were tested with the same `dist` folder.

Two details that make this work, in case they get changed later:

- **Hash routing.** Every url is `#/...`, so the server only ever serves
  `index.html` from the base. Pages has no rewrite rules, so a real router
  would 404 on refresh and need a `404.html` shim.
- **`public/.nojekyll`.** Pages runs Jekyll by default, which skips files and
  folders beginning with an underscore. The empty file turns that off.

To check a subpath build locally before pushing:

```
npm.cmd run build
npm.cmd run preview -- --base /Blocked/
```

then open `http://localhost:4173/Blocked/`.

## Adding books

Everything lives in `public/books.json`. One object per book:

```json
{
  "title": "2048",
  "description": "Slide the tiles, match the numbers.",
  "book_image_icon": "https://example.com/thumb.png",
  "category": "Puzzle",
  "tags": ["numbers"],
  "featured": false,
  "url": "https://example.com/book/"
}
```

`book_image_icon` can be left empty. The card falls back to the first letter of
the title.

Categories in the filter bar are built from whatever `category` values exist, so
adding a new one needs no code change.

Books open in an iframe. Some hosts refuse to be framed, and there is no way to
detect that from the page, so the player shows a "New tab" button after five
seconds.
