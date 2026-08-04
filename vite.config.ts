import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3001,
        host: '0.0.0.0',
        hmr: { port: 3003 },
      },
      // VitePWA (Workbox service worker) used to live here. It precached the
      // entire app shell and served it cache-first on every visit — which
      // meant returning users could refresh forever and never see a new
      // deploy, because the service worker never let a fresh index.html/JS
      // bundle reach the page in the first place. Nothing in this app
      // actually uses installability/offline mode (no install prompt, no
      // "Add to Home Screen" UX), so it was pure downside. public/sw.js is
      // now a hand-written kill-switch that unregisters any service worker
      // still installed from a past build; removing the plugin here just
      // stops a new one from ever being generated again.
      plugins: [
        react(),
        tailwindcss(),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
