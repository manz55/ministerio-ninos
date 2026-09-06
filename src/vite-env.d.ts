/// <reference types="vite/client" />

// Injected at build time via vite.config.ts's `define` — the ISO timestamp
// of when this exact bundle was built, not when the page happened to load.
declare const __BUILD_TIME__: string
