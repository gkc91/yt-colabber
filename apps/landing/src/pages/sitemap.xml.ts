import type { APIRoute } from 'astro';

import { canonical, LOCALES, ROUTES } from '../data/site';

/**
 * Written by hand rather than with an integration: every page of the site has to be
 * listed with its hreflang alternates, and scripts/check-landing.mjs verifies that
 * the file and the built pages agree (E1 acceptance criteria).
 */
export const GET: APIRoute = () => {
  const urls = LOCALES.flatMap((locale) =>
    ROUTES.map((route) => {
      const alternates = [
        ...LOCALES.map(
          (other) =>
            `    <xhtml:link rel="alternate" hreflang="${other}" href="${canonical(route, other)}" />`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${canonical(route, 'en')}" />`,
      ].join('\n');

      return [
        '  <url>',
        `    <loc>${canonical(route, locale)}</loc>`,
        alternates,
        `    <changefreq>${route === '/' ? 'weekly' : 'monthly'}</changefreq>`,
        `    <priority>${route === '/' ? '1.0' : '0.7'}</priority>`,
        '  </url>',
      ].join('\n');
    }),
  );

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
