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
  server: { port: 5174, strictPort: true },
})
