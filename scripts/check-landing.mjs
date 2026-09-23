// Landing SEO kontrolü (E1). Önce build, sonra:
//   node scripts/check-landing.mjs
// Lighthouse'un SEO bölümünün sorduklarını build çıktısı üzerinde doğrular:
// benzersiz title/description, canonical, hreflang karşılıklılığı, OG/Twitter,
// tek h1, geçerli JSON-LD, sitemap kapsaması, robots.txt ve kırık iç bağlantı.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'apps/landing/dist';
const SITE = 'https://clickable.app';
const LOCALES = ['en', 'tr'];

const NICHES = [
  'animation',
  'gaming',
  'education',
  'tech',
  'finance',
  'fitness',
  'vlog',
  'food',
  'music',
  'diy',
  'science',
  'comedy',
  'travel',
  'kids',
];
const ROUTES = ['/', '/thumbnail-test', '/hook-test', '/privacy', '/terms'].concat(
  NICHES.map((slug) => `/for/${slug}`),
);

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const localePath = (route, locale) => {
  if (locale === 'en') return route;
  return route === '/' ? '/tr' : `/tr${route}`;
};

/** `/` -> index.html, `/tr` -> tr.html, `/for/gaming` -> for/gaming.html */
const fileFor = (path) => (path === '/' ? 'index.html' : `${path.slice(1)}.html`);

const attr = (html, re) => {
  const match = html.match(re);
  return match ? match[1] : null;
};

// ---------- her sayfa ----------
const pages = [];
for (const locale of LOCALES) {
  for (const route of ROUTES) {
    const path = localePath(route, locale);
    const file = join(DIST, fileFor(path));
    if (!existsSync(file)) {
      check(`sayfa üretildi: ${path}`, false, file);
      continue;
    }
    pages.push({ path, route, locale, html: readFileSync(file, 'utf8') });
  }
}
check(
  'bütün sayfalar üretildi',
  pages.length === ROUTES.length * LOCALES.length,
  `${pages.length}`,
);

const titles = new Map();
const descriptions = new Map();
let headProblems = [];

for (const page of pages) {
  const { html, path, route, locale } = page;
  const problems = [];

  const lang = attr(html, /<html[^>]*lang="([^"]+)"/);
  if (lang !== locale) problems.push(`lang=${lang}`);

  const title = attr(html, /<title>([^<]*)<\/title>/);
  if (!title || title.length < 15 || title.length > 70) problems.push(`title(${title?.length})`);
  else if (titles.has(title)) problems.push(`title tekrar: ${titles.get(title)}`);
  else titles.set(title, path);

  const description = attr(html, /<meta name="description" content="([^"]*)"/);
  if (!description || description.length < 70 || description.length > 170)
    problems.push(`description(${description?.length})`);
  else if (descriptions.has(description)) problems.push(`description tekrar`);
  else descriptions.set(description, path);

  const canonical = attr(html, /<link rel="canonical" href="([^"]+)"/);
  if (canonical !== `${SITE}${path}`) problems.push(`canonical=${canonical}`);

  for (const other of LOCALES) {
    const expected = `${SITE}${localePath(route, other)}`;
    if (!html.includes(`hreflang="${other}" href="${expected}"`))
      problems.push(`hreflang ${other} eksik`);
  }
  if (!html.includes(`hreflang="x-default" href="${SITE}${route}"`))
    problems.push('x-default eksik');

  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1Count !== 1) problems.push(`h1 sayısı ${h1Count}`);

  for (const meta of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (!html.includes(`property="${meta}"`)) problems.push(`${meta} eksik`);
  }
  if (!html.includes('name="twitter:card"')) problems.push('twitter:card eksik');
  if (!html.includes('name="viewport"')) problems.push('viewport eksik');

  const ogUrl = attr(html, /<meta property="og:url" content="([^"]+)"/);
  if (ogUrl !== `${SITE}${path}`) problems.push(`og:url=${ogUrl}`);

  for (const block of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ??
    []) {
    const json = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/, '');
    try {
      JSON.parse(json);
    } catch (error) {
      problems.push(`JSON-LD bozuk: ${error.message}`);
    }
  }
  if (!html.includes('"@type":"SoftwareApplication"')) problems.push('SoftwareApplication eksik');

  if (problems.length > 0) headProblems.push(`${path}: ${problems.join(', ')}`);
}

check(
  'title/description/canonical/hreflang/OG hepsi doğru',
  headProblems.length === 0,
  headProblems.join(' | '),
);
check('bütün title değerleri benzersiz', titles.size === pages.length, `${titles.size}`);
check(
  'bütün description değerleri benzersiz',
  descriptions.size === pages.length,
  `${descriptions.size}`,
);

// ---------- iç bağlantılar ----------
const broken = new Set();
for (const page of pages) {
  for (const match of page.html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = match[1];
    if (href.endsWith('.svg') || href.endsWith('.png') || href.endsWith('.xml')) continue;
    if (!existsSync(join(DIST, fileFor(href)))) broken.add(`${page.path} -> ${href}`);
  }
}
check('kırık iç bağlantı yok', broken.size === 0, [...broken].join(' | '));

// ---------- sitemap ----------
const sitemapFile = join(DIST, 'sitemap.xml');
if (!existsSync(sitemapFile)) {
  check('sitemap.xml üretildi', false);
} else {
  const sitemap = readFileSync(sitemapFile, 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = LOCALES.flatMap((locale) =>
    ROUTES.map((route) => `${SITE}${localePath(route, locale)}`),
  );
  const missing = expected.filter((url) => !locs.includes(url));
  const extra = locs.filter((url) => !expected.includes(url));
  check('sitemap tüm sayfaları listeliyor', missing.length === 0, missing.join(' | '));
  check('sitemap fazladan adres içermiyor', extra.length === 0, extra.join(' | '));
  check(
    'sitemap adreslerinin hepsi gerçek dosya',
    locs.every((url) => existsSync(join(DIST, fileFor(url.slice(SITE.length) || '/')))),
  );
  check('sitemap hreflang alternatifleri taşıyor', sitemap.includes('hreflang="x-default"'));
}

// ---------- robots ve varlıklar ----------
const robotsFile = join(DIST, 'robots.txt');
const robots = existsSync(robotsFile) ? readFileSync(robotsFile, 'utf8') : '';
check(
  'robots.txt sitemap gösteriyor',
  robots.includes(`Sitemap: ${SITE}/sitemap.xml`),
  robots.trim(),
);
check('og.png var', existsSync(join(DIST, 'og.png')));
check('favicon var', existsSync(join(DIST, 'favicon.svg')));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
