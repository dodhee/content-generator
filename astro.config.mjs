import react from '@astrojs/react';
import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    react({
      include: ['**/*.react.tsx'],
    }),
    solidJs({
      include: ['**/*.solid.tsx'],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
