import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Relative asset paths, so the built site works wherever it is served from.
  //
  // GitHub Pages serves a project site from https://<user>.github.io/<repo>/
  // and a user site from https://<user>.github.io/. With the default base of
  // "/" every asset would be requested from the domain root and 404 on a
  // project site. Hardcoding "/Blocked/" would then break a user site, a
  // custom domain, and local previews.
  //
  // "./" sidesteps the choice: nothing needs to know the repo name, and the
  // same dist folder works under any prefix. It is safe here because the app
  // uses hash routing, so the document is always served from the base itself
  // and relative paths always resolve against it.
  base: './',

  // 5173 is taken by the DeblockedX clone, so keep them separate.
  server: {
    port: 5174,
    strictPort: true,

    // The chat room talks to /api/chat on its own origin. In development that
    // is this dev server, which serves files and knows nothing about chat, so
    // it is forwarded to `node server/chat.mjs` on 8787.
    //
    // No path rewrite: the reference server matches any path ending in
    // /messages, so it accepts the prefixed one as it arrives.
    //
    // With the chat server not running, the proxy fails, the probe returns
    // false and the room shows its "does not work on this link" state. That
    // is the same thing a static host produces, which makes both paths
    // testable locally.
    proxy: {
      '/api/chat': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
})
