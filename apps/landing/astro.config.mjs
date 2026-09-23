// @ts-check
import { defineConfig } from 'astro/config';

// Static output for Cloudflare Pages (E1). `site` drives canonical URLs and the sitemap.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://clickabletest.com',
  trailingSlash: 'never',
  build: { format: 'file' },
});
