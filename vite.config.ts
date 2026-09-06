import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Commit count as the version number: it only moves forward, needs no manual
// bumping to stay accurate (unlike a hand-maintained package.json version,
// which is easy to forget), and maps 1:1 to an exact commit — "v62" is
// always traceable back to precisely which code is live. The short hash
// rides along too, for the rare case of telling apart two deploys of a
// worktree with uncommitted changes.
function readGit(cmd: string, fallback: string) {
  try { return execSync(cmd, { encoding: 'utf-8' }).trim() } catch { return fallback }
}
const APP_VERSION = 'v' + readGit('git rev-list --count HEAD', '0')
const COMMIT_HASH = readGit('git rev-parse --short HEAD', 'sin-commit')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // So the header can show what's actually live without anyone needing to
  // check the Netlify dashboard — baked in at build time, not runtime.
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __COMMIT_HASH__: JSON.stringify(COMMIT_HASH),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/react') || id.includes('/react-dom') || id.includes('/react-router'))
            return 'vendor-react'
          if (id.includes('/framer-motion'))   return 'vendor-motion'
          if (id.includes('/date-fns'))        return 'vendor-dates'
          if (id.includes('/@supabase'))       return 'vendor-supabase'
        },
      },
    },
  },
})
