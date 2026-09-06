// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://blog.charlie-cloud.me',
  output: 'static',
  integrations: [
    react(),
    sitemap({
      // 只收录展示端,排除后台/搜索/404
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/dashboard') &&
        !page.includes('/search') &&
        !page.includes('/404'),
    }),
  ],
  vite: {
    // @ts-ignore - tailwind v4 vite plugin
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
