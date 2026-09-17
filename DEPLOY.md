# Getting Blocked online

Two hosts are set up in this repo. Both are free to start, both give you a
working link before you own a domain, and you can try one and switch.

|                  | Cloudflare Pages          | Render                    |
| ---------------- | ------------------------- | ------------------------- |
| the site         | yes                       | yes                       |
| the chat room    | yes, on D1                | yes, in memory            |
| free link        | `yourname.pages.dev`      | `blocked.onrender.com`    |
| sleeps when idle | no                        | yes, after about 15 min   |
| chat survives    | restarts and deploys      | nothing, it is in memory  |
| setup            | a few clicks plus a table | point it at the repo      |

Cloudflare is the better end result. Render is less to understand. The chat
backend is written twice because of that difference: a Render service is one
Node process that stays running, so an array in memory works; a Cloudflare
Function is a fresh instance per request, so it needs real storage.

Nothing here needs a card.

## Step 1, both hosts: get the code on GitHub

Neither host can see your laptop. They deploy from a repo.

Make an empty **public** repo at <https://github.com/new>. Call it `Blocked`.
Do not add a README or a licence, the repo already has files.

Then, in this folder, one command at a time. Replace `YOURNAME`.

```bash
git remote add origin https://github.com/YOURNAME/Blocked.git
```

```bash
git branch -M main
```

```bash
git push -u origin main
```

If it asks for a password, that is not your GitHub password: GitHub wants a
personal access token. Easier is to install GitHub Desktop and publish from
there, or install the `gh` CLI and run `gh auth login` first.

## Step 2a: Cloudflare Pages

1. Sign up at <https://dash.cloudflare.com/sign-up>.
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, and pick
   the repo.
3. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Save and Deploy.** A few minutes later you have a link ending in
   `.pages.dev`. **The site works at this point.** The chat room will say it
   is down, because it has nowhere to keep messages yet.

Now give it that place:

5. **Workers & Pages** → **D1** → **Create database**. Name it `blocked-chat`.
6. Open it, go to its **Console**, paste in everything from `schema.sql` in
   this repo, and run it. That creates the two tables.
7. Back in your Pages project: **Settings** → **Functions** → **D1 database
   bindings** → **Add binding**.
   - Variable name: `CHAT_DB` (exactly this, the code looks for that name)
   - D1 database: `blocked-chat`
8. **Deployments** → **Retry deployment**, so the running build picks up the
   binding.

The chat room now works. `functions/api/chat/messages.js` is picked up
automatically, no configuration, because Cloudflare maps the `functions`
folder to url paths and that file's path is the one the client already asks
for.

## Step 2b: Render

1. Sign up at <https://dashboard.render.com>.
2. **New** → **Blueprint**, and pick the repo. It reads `render.yaml` and
   fills everything in, so there is nothing to type.
3. **Apply.** The first build takes a few minutes, then you have a link
   ending in `.onrender.com`, with the chat working.

If you use **New** → **Web Service** instead, `render.yaml` is ignored and
these are the fields:

| field           | value                                 |
| --------------- | ------------------------------------- |
| Language        | Node                                  |
| Branch          | `main`                                |
| Root Directory  | leave empty                           |
| Build Command   | `npm ci --include=dev && npm run build` |
| Start Command   | `node server/chat.mjs`                |
| Compute         | Free                                  |

`--include=dev` matters: `vite` is a devDependency, and a host that sets
`NODE_ENV=production` makes npm skip those, so the build fails with
"vite: not found". No environment variables are needed, and `engines.node`
in package.json tells Render which Node to use.

One service serves the site and the chat, out of `server/chat.mjs`.

Two things about the free plan, so they are not a surprise: it sleeps after
about 15 minutes with no traffic, so the next visit waits for it to wake, and
the chat keeps messages in memory, so a sleep empties the room. Paying lifts
the sleeping. Keeping messages across restarts needs storage instead of the
array, and nothing else in that file would change.

## Step 3: your domain

**Your Route 53 domain is not wasted.** Route 53 is DNS and a registrar. It
was never going to hold your files, but a domain registered there points
wherever you tell it, including at either host above.

On Cloudflare:

1. Pages project → **Custom domains** → **Set up a domain**, enter yours.
2. It shows you the records to create. In the AWS console, Route 53 → your
   hosted zone → create those records.
3. HTTPS is issued for you.

On Render it is the same shape: **Settings** → **Custom domain**, then create
the record it gives you in Route 53.

If you would rather not keep paying Route 53 prices, Cloudflare Registrar
sells domains at cost with no markup, and you can transfer one in. Do that
later though. Get the free link working first.

## What works only once it is deployed

- **The chat room.** It needs a backend. On any static host, including GitHub
  Pages, it will say it is down, and that is correct rather than broken.
- **The Lumin library.** Their service checks the domain it runs on.

Everything else, all 2190 games across the nine other libraries, works
locally and deployed alike.

## Running it locally

```bash
npm.cmd run dev
```

The chat needs its backend alongside, in a second terminal:

```bash
npm.cmd run chat
```

The dev server proxies `/api/chat` to it. Without it running the room shows
its "down" state, which is the same thing a static host produces, so both
halves are testable before you deploy anything.
