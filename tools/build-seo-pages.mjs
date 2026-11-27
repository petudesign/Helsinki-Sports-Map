import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(root, 'dist')
const BASE_URL = 'https://helsinki-sports-map.vercel.app'

// Run the real TypeScript classifiers so SEO pages stay 100% in sync with the app.
const classifierSource = ['text.ts', 'geometry.ts', 'lipas.ts']
  .map((file) => readFileSync(resolve(root, 'src/data', file), 'utf8'))
  .join('\n')
const stripped = stripTypeScriptTypes(
  classifierSource.replace(/^import .*$/gm, '').replace(/^export /gm, ''),
) + '\nexports.sportsFromSite = sportsFromSite; exports.explicitPrice = explicitPrice; exports.sites = sites;'

const lipasSnapshot = JSON.parse(readFileSync(resolve(root, 'src/data/lipas-helsinki-runtime.json'), 'utf8'))
const helsinkiBoundary = JSON.parse(readFileSync(resolve(root, 'src/data/helsinki-boundary.json'), 'utf8'))
const context = { exports: {}, lipasSnapshot, helsinkiBoundary }
vm.runInNewContext(stripped, context)
const { sportsFromSite, explicitPrice, sites } = context.exports

// Deduplicate by venue parent name so multi-field parks appear once per landing page.
const venuesByParent = new Map()
for (const { site, coordinate } of sites) {
  const sports = sportsFromSite(site)
  if (!sports.length) continue
  const parentName = site.name.split(' / ')[0].trim()
  const key = parentName.toLocaleLowerCase('fi-FI')
  const existing = venuesByParent.get(key)
  const price = explicitPrice(site)
  const slug = `${parentName.toLocaleLowerCase('fi-FI').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${site.id}`
  if (!existing) {
    venuesByParent.set(key, {
      id: slug,
      name: parentName,
      address: site.address ?? '',
      coordinate,
      sports: new Set(sports),
      prices: new Set(price ? [price] : []),
    })
  } else {
    sports.forEach((sport) => existing.sports.add(sport))
    if (price) existing.prices.add(price)
    if (!existing.address && site.address) existing.address = site.address
  }
}

const allVenues = [...venuesByParent.values()].map((venue) => ({
  ...venue,
  sports: [...venue.sports],
  price: venue.prices.has('free') && venue.prices.has('paid')
    ? 'mixed'
    : venue.prices.has('free')
      ? 'free'
      : venue.prices.has('paid')
        ? 'paid'
        : 'unknown',
}))

const pages = [
  {
    slug: 'fi/jalkapallokentat',
    altSlug: 'en/football-helsinki',
    locale: 'fi',
    sportFilter: 'football',
    match: (sports) => sports.includes('soccer') || sports.includes('football'),
    title: 'Jalkapallokentät Helsingissä',
    description: 'Löydä Helsingin jalkapallokentät, tekonurmet, nurmikentät ja hiekkakentät yhdeltä kartalta HSL-reittiohjeineen.',
    intro: 'Kattava lista Helsingin jalkapallokentistä, tekonurmikentistä ja pallokentistä. Avaa interaktiivinen kartta nähdäksesi sijainnit, ilmaiset kentät ja HSL-reittiohjeet.',
  },
  {
    slug: 'fi/ulkokuntosalit',
    altSlug: 'en/gyms-helsinki',
    locale: 'fi',
    sportFilter: 'gym',
    match: (sports) => sports.includes('outdoor_fitness') || sports.includes('fitness'),
    title: 'Ulkokuntosalit ja kuntosalit Helsingissä',
    description: 'Helsingin ilmaiset ulkokuntosalit, kuntoportaat ja kuntosalit kartalla osoitteineen ja reittiohjeineen.',
    intro: 'Löydä Helsingin ulkokuntosalit, ulkokuntoilupaikat ja kuntosalit helposti yhdeltä kartalta.',
  },
  {
    slug: 'fi/uimahallit',
    altSlug: 'en/swimming-helsinki',
    locale: 'fi',
    sportFilter: 'swimming',
    match: (sports) => sports.includes('swimming'),
    title: 'Uimahallit Helsingissä',
    description: 'Helsingin uimahallit ja uimapaikat kartalla osoitteineen, esteettömyystietoineen ja HSL-reiteillä.',
    intro: 'Kaikki Helsingin uimahallit ja uintipaikat yhdessä näkymässä — suodata esteettömyyden tai sijainnin mukaan kartalla.',
  },
  {
    slug: 'fi/uimarannat',
    locale: 'fi',
    sportFilter: 'outdoor_swimming',
    match: (sports) => sports.includes('outdoor_swimming'),
    title: 'Uimarannat ja maauimalat Helsingissä',
    description: 'Helsingin yleiset uimarannat ja maauimalat kartalla reittiohjeineen.',
    intro: 'Tutustu Helsingin uimarantoihin ja maauimaloihin ja katso HSL-yhteydet suoraan kartalta.',
  },
  {
    slug: 'fi/koripallokentat',
    locale: 'fi',
    sportFilter: 'basketball',
    match: (sports) => sports.includes('basketball'),
    title: 'Koripallokentät Helsingissä',
    description: 'Helsingin ulko- ja sisäkoripallokentät yhdeltä kartalta osoitteineen.',
    intro: 'Löydä lähimmät koripallokentät Helsingissä ja tarkista reitti kävellen, pyörällä tai HSL:llä.',
  },
  {
    slug: 'fi/tenniskentat',
    locale: 'fi',
    sportFilter: 'tennis',
    match: (sports) => sports.includes('tennis'),
    title: 'Tenniskentät Helsingissä',
    description: 'Helsingin tenniskentät ja tennishallit kartalla osoitteineen ja reittiohjeineen.',
    intro: 'Selaa Helsingin tenniskenttiä alueittain ja avaa kohde kartalla reittiohjeita varten.',
  },
  {
    slug: 'fi/padelkentat',
    locale: 'fi',
    sportFilter: 'padel',
    match: (sports) => sports.includes('padel'),
    title: 'Padelkentät Helsingissä',
    description: 'Helsingin padelkentät ja padelhallit kartalla osoitteineen ja HSL-reiteillä.',
    intro: 'Löydä Helsingin padelkentät yhdeltä kartalta ja suunnittele matka suoraan kentälle.',
  },
  {
    slug: 'fi/skeittipuistot',
    locale: 'fi',
    sportFilter: 'skateboarding',
    match: (sports) => sports.includes('skateboarding'),
    title: 'Skeittipuistot Helsingissä',
    description: 'Helsingin skeittipuistot ja skeittipaikat kartalla osoitteineen.',
    intro: 'Kaikki Helsingin skeittipuistot ja skeittipaikat yhdellä kartalla.',
  },
  {
    slug: 'en/football-helsinki',
    altSlug: 'fi/jalkapallokentat',
    locale: 'en',
    sportFilter: 'football',
    match: (sports) => sports.includes('soccer') || sports.includes('football'),
    title: 'Football pitches in Helsinki',
    description: 'Find football pitches, artificial turf fields, and public ball fields in Helsinki with HSL public transport directions.',
    intro: 'Browse football pitches and turf fields across Helsinki. Open the interactive map to filter by free access and plan routes by foot, bike, or HSL transit.',
  },
  {
    slug: 'en/gyms-helsinki',
    altSlug: 'fi/ulkokuntosalit',
    locale: 'en',
    sportFilter: 'gym',
    match: (sports) => sports.includes('outdoor_fitness') || sports.includes('fitness'),
    title: 'Gyms & outdoor gyms in Helsinki',
    description: 'Find free outdoor gyms, workout stairs, and indoor fitness centres in Helsinki on one interactive map.',
    intro: 'Explore free outdoor gyms and indoor fitness facilities across Helsinki with addresses and HSL transit directions.',
  },
  {
    slug: 'en/swimming-helsinki',
    altSlug: 'fi/uimahallit',
    locale: 'en',
    sportFilter: 'swimming',
    match: (sports) => sports.includes('swimming'),
    title: 'Swimming pools in Helsinki',
    description: 'Find public swimming halls and pools in Helsinki with addresses, accessibility info, and HSL routes.',
    intro: 'Browse swimming halls across Helsinki and open any venue on the interactive map for directions and official details.',
  },
]

const esc = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const priceLabel = (locale, price) => {
  if (price === 'free') return locale === 'fi' ? 'Ilmainen' : 'Free'
  if (price === 'paid') return locale === 'fi' ? 'Maksullinen' : 'Paid'
  if (price === 'mixed') return locale === 'fi' ? 'Ilmaisia ja maksullisia' : 'Free and paid'
  return ''
}

for (const page of pages) {
  const matched = allVenues
    .filter((venue) => page.match(venue.sports))
    .sort((a, b) => a.name.localeCompare(b.name, page.locale))
  const isFi = page.locale === 'fi'
  const appName = isFi ? 'Helsingin liikuntakartta' : 'Helsinki Sports Map'
  const canonical = `${BASE_URL}/${page.slug}/`
  const mapUrl = `/?lang=${page.locale}&sport=${page.sportFilter}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: page.title,
    description: page.description,
    url: canonical,
    numberOfItems: matched.length,
    itemListElement: matched.slice(0, 60).map((venue, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SportsActivityLocation',
        name: venue.name,
        ...(venue.address ? { address: { '@type': 'PostalAddress', streetAddress: venue.address, addressLocality: 'Helsinki', addressCountry: 'FI' } } : {}),
        geo: { '@type': 'GeoCoordinates', latitude: venue.coordinate[1], longitude: venue.coordinate[0] },
        url: `${BASE_URL}/?lang=${page.locale}&sport=${page.sportFilter}&place=${encodeURIComponent(venue.id)}`,
      },
    })),
  }

  const navLinks = pages
    .filter((item) => item.locale === page.locale && item.slug !== page.slug)
    .map((item) => `<a href="/${item.slug}/">${esc(item.title)}</a>`)
    .join('')

  const html = `<!doctype html>
<html lang="${page.locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="light" />
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fafafa" />
  <link rel="icon" type="image/png" href="/logo-64.png" />
  <link rel="canonical" href="${canonical}" />
  ${page.altSlug ? `<link rel="alternate" hreflang="${isFi ? 'en' : 'fi'}" href="${BASE_URL}/${page.altSlug}/" />` : ''}
  <link rel="alternate" hreflang="${page.locale}" href="${canonical}" />
  <title>${esc(page.title)} · ${esc(appName)}</title>
  <meta name="description" content="${esc(page.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${esc(appName)}" />
  <meta property="og:title" content="${esc(page.title)} (${matched.length}) · ${esc(appName)}" />
  <meta property="og:description" content="${esc(page.description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${BASE_URL}/helsinkisportsmaplogo.png" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root { --bg: #fafafa; --surface: #ffffff; --ink: #18181b; --muted: #52525b; --subtle: #66666e; --border: rgb(24 24 27 / 0.1); --accent: #0755a0; --accent-hover: #06498a; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
    .wrap { max-width: 820px; margin: 0 auto; padding: 24px 16px 56px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 28px; }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: inherit; font-weight: 600; text-decoration: none; }
    .brand img { width: 28px; height: 28px; }
    h1 { margin: 0 0 10px; font-size: clamp(1.6rem, 4vw, 2.2rem); letter-spacing: -0.02em; line-height: 1.15; }
    .intro { margin: 0 0 20px; color: var(--muted); max-width: 62ch; }
    .cta { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 8px; background: var(--accent); color: #fff; font-weight: 500; text-decoration: none; }
    .cta:hover { background: var(--accent-hover); }
    .count { margin: 28px 0 12px; color: var(--subtle); font-size: 13px; font-variant-numeric: tabular-nums; }
    ul { list-style: none; margin: 0; padding: 0; border-radius: 12px; background: var(--surface); box-shadow: 0 0 0 1px var(--border); overflow: hidden; }
    li + li { border-top: 1px solid rgb(24 24 27 / 0.06); }
    li a { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; color: inherit; text-decoration: none; }
    li a:hover { background: rgb(24 24 27 / 0.03); }
    .name { display: block; font-weight: 500; }
    .addr { display: block; color: var(--subtle); font-size: 13px; }
    .badge { flex: 0 0 auto; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }
    .badge-free { background: #ecfdf3; color: #166534; }
    .badge-paid { background: #fef7ec; color: #92400e; }
    .badge-mixed { background: #eef4fb; color: #0755a0; }
    nav { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 14px; }
    nav a { color: var(--accent); text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    footer { margin-top: 24px; color: var(--subtle); font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <a class="brand" href="/?lang=${page.locale}"><img src="/logo-64.png" alt="" width="28" height="28" />${esc(appName)}</a>
      ${page.altSlug ? `<a href="/${page.altSlug}/" style="color:var(--muted);font-size:14px;text-decoration:none;">${isFi ? 'In English' : 'Suomeksi'}</a>` : ''}
    </header>
    <main>
      <h1>${esc(page.title)}</h1>
      <p class="intro">${esc(page.intro)}</p>
      <a class="cta" href="${mapUrl}">${isFi ? `Avaa ${matched.length} paikkaa kartalla` : `Open ${matched.length} places on the map`} →</a>
      <p class="count">${isFi ? `${matched.length} paikkaa Helsingissä (lähde: LIPAS)` : `${matched.length} places in Helsinki (source: LIPAS)`}</p>
      <ul>
        ${matched.map((venue) => {
          const badge = priceLabel(page.locale, venue.price)
          return `<li><a href="/?lang=${page.locale}&amp;sport=${page.sportFilter}&amp;place=${encodeURIComponent(venue.id)}"><span><span class="name">${esc(venue.name)}</span>${venue.address ? `<span class="addr">${esc(venue.address)}</span>` : ''}</span>${badge ? `<span class="badge badge-${venue.price}">${esc(badge)}</span>` : ''}</a></li>`
        }).join('\n        ')}
      </ul>
      <nav aria-label="${isFi ? 'Muut lajit Helsingissä' : 'More sports in Helsinki'}">${navLinks}</nav>
    </main>
    <footer>${isFi ? 'Itsenäinen projekti · Ei Helsingin kaupungin virallinen verkkosivu · Data: LIPAS (CC BY 4.0)' : 'Independent project · Not an official City of Helsinki website · Data: LIPAS (CC BY 4.0)'}</footer>
  </div>
</body>
</html>`

  const outPath = resolve(distDir, page.slug, 'index.html')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, html, 'utf8')
}

// Keep dist/sitemap.xml in sync with the generated landing pages.
const sitemapUrls = [
  `${BASE_URL}/`,
  `${BASE_URL}/?lang=fi`,
  `${BASE_URL}/?lang=en`,
  ...pages.map((page) => `${BASE_URL}/${page.slug}/`),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${url.replace(/&/g, '&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`
writeFileSync(resolve(distDir, 'sitemap.xml'), sitemap, 'utf8')
console.log(`Generated ${pages.length} static SEO/GEO landing pages and dist/sitemap.xml`)
