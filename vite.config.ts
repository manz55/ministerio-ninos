import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // So the header can show "cuándo se publicó" without anyone needing to
  // check the Netlify dashboard — baked in at build time, not runtime, so it
  // reflects when THIS bundle was actually built, not when the page loaded.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
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
