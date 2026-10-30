// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: 'https://www.glasgowmushroom.co',
  // The business has wound down: every old public page and the trade portal
  // point at the placeholder homepage.
  redirects: {
    '/home': '/',
    '/products': '/',
    '/recipes': '/',
    '/where-to-find-us': '/',
    '/direct-sales': '/',
    '/wholesale': '/',
    '/markets': '/',
    '/contact': '/',
    '/equipment-sale': '/',
    '/portal': '/',
    '/portal/register': '/',
    '/portal/forgot-password': '/',
    '/portal/reset-password': '/',
  },
  integrations: [react({
    include: ['src/portal/**', 'src/components/assets/**'],
  })],
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
});
