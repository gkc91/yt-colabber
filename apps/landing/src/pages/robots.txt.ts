import type { APIRoute } from 'astro';

import { SITE_URL } from '../data/site';

export const GET: APIRoute = () =>
  new Response(
    [`User-agent: *`, `Allow: /`, ``, `Sitemap: ${SITE_URL}/sitemap.xml`, ``].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
