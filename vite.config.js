import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// BASE_PATH: '/' lokalnie, '/asystent-kdr/' na GitHub Pages (ustawiane w .github/workflows/deploy.yml)
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' = aktualizacja NIGDY nie przeładowuje aplikacji sama (nie w trakcie akcji)
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'sw-notify.js'],
      manifest: {
        name: 'Asystent KDR',
        short_name: 'KDR',
        description: 'Wsparcie Kierującego Działaniem Ratowniczym – działa offline',
        lang: 'pl',
        start_url: base,
        scope: base,
        display: 'standalone', // zostawia pasek stanu Androida (bateria, godzina)
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // cała aplikacja w pamięci podręcznej – zero zapytań do sieci w czasie pracy
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2,json}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        importScripts: ['sw-notify.js'], // kliknięcie powiadomienia o kontroli → moduł ODO
      },
      devOptions: { enabled: false },
    }),
  ],
})
