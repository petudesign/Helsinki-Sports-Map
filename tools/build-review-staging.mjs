import fs from 'node:fs'
import path from 'node:path'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index]
  if (!value.startsWith('--')) continue
  args.set(value.slice(2), process.argv[index + 1])
  index += 1
}

const sourcePath = path.resolve(process.cwd(), args.get('source') ?? 'src/data/service-map-helsinki.json')
const outputPath = path.resolve(process.cwd(), args.get('output') ?? 'src/data/review-staging.json')
const city = args.get('city') ?? 'Helsinki'
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))

function firstAudience(value) {
  return value.split('\n').map((line) => line.trim()).find(Boolean) ?? 'Audience needs review'
}

function parsePriceOptions(value) {
  const initialAudience = firstAudience(value)
  let audience = /free\s+(?:of\s+charge|entry)|maksuton/i.test(initialAudience) ? 'General access' : initialAudience
  const options = []

  for (const rawLine of value.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const standalonePrice = /^(free\s+(?:of\s+charge|entry)|maksuton|€\s*\d+(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?\s*€)$/i.test(line)
    if (!line.startsWith('-') && !standalonePrice) {
      audience = line
      continue
    }

    const sourceLine = line.replace(/^-\s*/, '')
    const pricePattern = /(free\s+(?:of\s+charge|entry)|maksuton|€\s*\d+(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?\s*€)/gi
    const matches = [...sourceLine.matchAll(pricePattern)]
    for (const [index, match] of matches.entries()) {
      if (match.index === undefined) continue
      const previous = matches[index - 1]
      const previousEnd = previous?.index === undefined ? 0 : previous.index + previous[0].length
      const rawPrice = match[0].trim()
      const price = /free|maksuton/i.test(rawPrice)
        ? 'Free of charge'
        : `${(rawPrice.match(/\d+(?:[,.]\d{1,2})?/)?.[0] ?? '').replace(',', '.')} €`
      const label = sourceLine.slice(previousEnd, match.index).replace(/^\s*or\s+/i, '').replace(/[–—:-]\s*$/, '').trim() || 'Entry'
      const optionAudience = /personal customer card/i.test(label) ? 'All customers' : audience
      options.push({ label, audience: optionAudience, price, sourceLine })
    }
  }

  return options
}

const candidates = (source.units ?? [])
  .filter((unit) => typeof unit.priceEn === 'string' && unit.priceEn.trim())
  .slice(0, 12)
  .map((unit) => {
    const sourceText = unit.priceEn
    const priceOptions = parsePriceOptions(sourceText)
    const mapped = unit.lipasId !== undefined
    const checks = [
      { label: 'Price format', detail: priceOptions.length ? 'Currency amount found' : 'No structured price found', status: priceOptions.length ? 'pass' : 'review', weight: 35 },
      { label: 'Venue match', detail: mapped ? 'Matches LIPAS venue' : 'Needs venue match', status: mapped ? 'pass' : 'review', weight: 30 },
      { label: 'Source freshness', detail: unit.updatedAt ? `Source updated ${unit.updatedAt.slice(0, 10)}` : 'No update timestamp', status: unit.updatedAt ? 'pass' : 'review', weight: 20 },
      { label: 'Cross-source check', detail: 'Not verified yet', status: 'review', weight: 15 },
    ]

    return {
      id: `service-map-${unit.serviceMapId}`,
      venueName: unit.nameFi ?? `Service Map unit ${unit.serviceMapId}`,
      category: 'PRICE connection',
      proposedPrice: priceOptions[0]?.price ?? 'Price needs review',
      audience: priceOptions[0]?.audience ?? firstAudience(sourceText),
      sourceLabel: 'Helsinki Service Map · PRICE',
      sourceUrl: unit.sourceUrl,
      sourceUpdatedAt: unit.updatedAt,
      sourceText,
      checks,
      priceOptions,
    }
  })

const staging = {
  schemaVersion: 1,
  generatedAt: source.importedAt ?? new Date().toISOString(),
  city,
  source: {
    provider: 'Helsinki Service Map',
    url: source.source,
    importedAt: source.importedAt,
  },
  candidates,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(staging, null, 2)}\n`)
console.log(`Built ${candidates.length} review candidates from ${path.relative(process.cwd(), sourcePath)}`)
console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`)
