import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 5173 is taken by the DeblockedX clone, so keep them separate.
  server: { port: 5174, strictPort: true },
})
