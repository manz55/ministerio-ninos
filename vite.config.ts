import { defineConfig, type Plugin } from 'vite'
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
// v2 desde el rediseño completo; el número sigue contando commits.
const APP_VERSION = 'v2.' + readGit('git rev-list --count HEAD', '0')
const COMMIT_HASH = readGit('git rev-parse --short HEAD', 'sin-commit')

// Genera dist/sw.js con la lista exacta de archivos de este build, para que
// el service worker los guarde todos desde la primera visita (incluidas las
// páginas que se cargan "lazy", como Familias) y la app abra sin internet.
// Sin dependencias extra: el SW es corto y vive aquí abajo.
function offlineServiceWorker(): Plugin {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter((f) => !f.endsWith('.map')).map((f) => '/' + f)
      const precache = ['/', '/manifest.json', '/logo-ninos-192.png', '/logo-ninos-32.png', ...assets]
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: SW_TEMPLATE
          .replace('__CACHE__', JSON.stringify('ministerio-' + COMMIT_HASH + '-' + APP_VERSION))
          .replace('__PRECACHE__', JSON.stringify(precache)),
      })
    },
  }
}

const SW_TEMPLATE = `
const CACHE = __CACHE__
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ministerio-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  // Supabase y todo lo de otros dominios pasa directo: nunca se sirve de caché.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    // Red primero (para recibir versiones nuevas), pero con internet lento
    // no se espera más de 4 s: se abre la copia guardada.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const network = fetch(req).then((res) => { if (res.ok) cache.put('/', res.clone()); return res })
      const timeout = new Promise((resolve) => setTimeout(resolve, 4000))
      const winner = await Promise.race([network.catch(() => null), timeout])
      if (winner) return winner
      const cached = await cache.match('/')
      return cached || network
    })())
    return
  }

  // Archivos con hash (/assets/...) nunca cambian: caché primero.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && url.pathname.startsWith('/assets/')) {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    }))
  )
})
`

export default defineConfig(({ mode }) => ({
  // `--mode demo` (npm run build:demo): versión de prueba con datos falsos
  // (src/demo/), rutas relativas para poder abrirla desde cualquier lugar y
  // sin service worker.
  ...(mode === 'demo' ? { base: './' } : {}),
  plugins: [react(), tailwindcss(), ...(mode === 'demo' ? [] : [offlineServiceWorker()])],
  // So the header can show what's actually live without anyone needing to
  // check the Netlify dashboard — baked in at build time, not runtime.
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __COMMIT_HASH__: JSON.stringify(COMMIT_HASH),
  },
  build: {
    ...(mode === 'demo' ? { outDir: 'dist-demo' } : {}),
    rollupOptions: {
      ...(mode === 'demo' ? { input: 'demo.html' } : {}),
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
}))
