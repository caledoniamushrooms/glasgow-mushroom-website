// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react({
    include: ['src/portal/**'],
  })],
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});
