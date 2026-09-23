import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reads the `/*` block of public/_headers so `vite preview` (and therefore Playwright) serves the
 * same CSP and security headers as Cloudflare Pages. One source of truth for the policy.
 */
function pagesHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  let inRoot = false;
  for (const line of readFileSync(path.join(__dirname, 'public/_headers'), 'utf8').split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      inRoot = line.trim() === '/*';
      continue;
    }
    const m = /^\s+([\w-]+):\s*(.+)$/.exec(line);
    // HSTS and upgrade-insecure-requests only make sense over HTTPS; preview runs on http://localhost.
    if (inRoot && m?.[1] && m[2] && m[1] !== 'Strict-Transport-Security') {
      headers[m[1]] = m[2].replace(/;\s*upgrade-insecure-requests/, '');
    }
  }
  return headers;
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'RentReady',
        short_name: 'RentReady',
        description: "Know what you're signing before you get the keys.",
        theme_color: '#0B6E4F',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // The PDF and Word readers are large and only needed by someone who uploads a file: keep
        // them out of the install-time precache and cache them the first time they are used.
        globIgnores: ['**/pdfjs-*.js', '**/mammoth-*.js'],
        runtimeCaching: [
          {
            // Never cache Gemini responses — they are per-user content
            urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/assets\/(pdfjs|mammoth|pdf\.worker)-[\w-]+\.m?js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'rentready-parsers', expiration: { maxEntries: 8 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Stable names for the heavy, lazily loaded parsers so the service worker can skip them.
        manualChunks(id) {
          if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs';
          if (id.includes('node_modules/mammoth')) return 'mammoth';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4317,
    strictPort: true,
    headers: pagesHeaders(),
  },
});
