import { readFile, writeFile } from 'node:fs/promises'

const serviceMapUnitsUrl = 'https://www.hel.fi/palvelukarttaws/rest/v4/unit/?arealcity=91&search=liikunta'
const serviceMapBaseUrl = 'https://www.hel.fi/palvelukarttaws/rest/v4'
const serviceMapWebUrl = 'https://palvelukartta.hel.fi/fi/unit'
const sourcePath = new URL('../src/data/lipas-helsinki.json', import.meta.url)
const outputPath = new URL('../src/data/service-map-helsinki.json', import.meta.url)
const requestTimeoutMs = 30_000
const concurrency = 8

async function getJson(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Service Map ${response.status}: ${url}`)
    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

function lipasIdForUnit(unit) {
  const source = (unit.sources ?? []).find((entry) => String(entry.source ?? '').toLowerCase() === 'lipas')
  return source?.id ? Number(source.id) : undefined
}

function connection(unit, sectionType) {
  return (unit.connections ?? []).find((entry) => entry.section_type === sectionType)
}

function localizedConnectionText(unit, sectionType, locale) {
  const item = connection(unit, sectionType)
  return item?.[`name_${locale}`] ?? item?.name?.[locale] ?? ''
}

function linksFor(unit) {
  return (unit.connections ?? []).flatMap((entry) => {
    const url = entry.www_fi ?? entry.www_en ?? entry.www?.fi ?? entry.www?.en
    if (!url) return []
    return [{ labelFi: entry.name_fi ?? entry.name_en ?? entry.name?.fi ?? entry.name?.en ?? 'Linkki', labelEn: entry.name_en ?? entry.name_fi ?? entry.name?.en ?? entry.name?.fi ?? 'Link', url }]
  })
}

function triState(properties, patterns) {
  const matches = properties.filter((property) => patterns.some((pattern) => pattern.test(property.variable_name ?? '')))
  if (!matches.length) return 'unknown'
  const hasYes = matches.some((property) => /^(true|yes|existing|accessible)$/i.test(property.value ?? '') || (/\.count$/i.test(property.variable_name ?? '') && Number(property.value) > 0))
  const hasNo = matches.some((property) => /^(false|no|not_existing|not_accessible)$/i.test(property.value ?? '') || (/\.count$/i.test(property.variable_name ?? '') && Number(property.value) === 0))
  if (hasYes && hasNo) return 'unknown'
  if (hasYes) return 'yes'
  if (hasNo) return 'no'
  return 'unknown'
}

function accessibilityFor(properties) {
  return {
    stepFreeEntrance: triState(properties, [/^ENTRANCE\.STEPS\.existing$/i, /^ROUTE_TO_ENTRANCE\.STEPS\.existing$/i]),
    accessibleToilet: triState(properties, [/ACCESSIBLE_WC\.existing/i]),
    accessibleParking: triState(properties, [/ACCESSIBLE_PARKING_SPACE\.(count|existing)/i]),
    lift: triState(properties, [/^INTERIOR\.LIFT\.existing$/i]),
    ramp: triState(properties, [/\.RAMP\.existing$/i]),
    wheelchairSpace: triState(properties, [/wheelchair/i]),
    entranceSurface: first(properties.filter((property) => /^ROUTE_TO_ENTRANCE\.surface$/i.test(property.variable_name ?? '')).map((property) => property.value)),
  }
}

function familySignalsFor(unit) {
  const text = [unit.name_fi, unit.short_desc_fi, unit.desc_fi, localizedConnectionText(unit, 'PRICE', 'fi'), ...(unit.connections ?? []).map((entry) => entry.name?.fi)].filter(Boolean).join(' ')
  const signals = []
  if (/perhe|lasten|lapsi|liikuntahulina|perhehulin/i.test(text)) signals.push('children-or-family-activity')
  if (/leikkialue|leikkipuisto|kahluuallas|lastenallas/i.test(text)) signals.push('play-area-or-child-pool')
  if (/alle\s*(7|9)|lapsi.*maksut|maksutt.*laps/i.test(text)) signals.push('child-price-or-free-entry')
  if (/perhepukuhuone|lastenvaunu|vaunuparkki/i.test(text)) signals.push('family-facilities')
  if (/ikäraja|ikä\s*\d+|under\s*\d+|age\s*limit/i.test(text)) signals.push('age-information')
  return signals
}

function usageStatusFor(unit, priceText) {
  const text = [unit.name_fi, unit.short_desc_fi, unit.desc_fi, priceText, ...(unit.connections ?? []).map((entry) => entry.name?.fi)].filter(Boolean).join(' ')
  if (/vain .*seur|vain .*koulu|jäsen|kuntoutusasiakas|private|members only/i.test(text)) return 'restricted'
  if (/varaus vaaditaan|varattava|varattavissa vain|booking required/i.test(text)) return 'booking'
  if (/voi käyttää|yleisölle|kaikille|omatoim|open to the public|drop-in/i.test(text)) return 'open'
  return 'unknown'
}

function priceClassFor(priceText) {
  if (!priceText) return 'unknown'
  const free = /maksuton|ilmainen|free of charge|no charge/i.test(priceText)
  const paid = /€|euro|maksull|pääsymaks|käyttömaks|price|fee/i.test(priceText)
  if (free && paid) return 'mixed'
  if (free) return 'free'
  if (paid) return 'paid'
  return 'unknown'
}

const lipas = JSON.parse(await readFile(sourcePath, 'utf8'))
const units = await getJson(serviceMapUnitsUrl)
const candidateUnits = units.filter((unit) => lipas.sites.some((site) => site.id === lipasIdForUnit(unit)))
const sportsUnits = []

for (let index = 0; index < candidateUnits.length; index += concurrency) {
  const batch = candidateUnits.slice(index, index + concurrency)
  const results = await Promise.all(batch.map(async (unit) => {
    try {
      return await getJson(`${serviceMapBaseUrl}/unit/${unit.id}`)
    } catch (error) {
      console.warn(`Unit detail import skipped for ${unit.id}: ${error.message}`)
      return unit
    }
  }))
  sportsUnits.push(...results)
  console.log(`Imported unit details ${Math.min(index + concurrency, candidateUnits.length)}/${candidateUnits.length}`)
}

const accessibility = new Map()

for (let index = 0; index < sportsUnits.length; index += concurrency) {
  const batch = sportsUnits.slice(index, index + concurrency)
  const results = await Promise.all(batch.map(async (unit) => {
    try {
      const response = await getJson(`${serviceMapBaseUrl}/unit/${unit.id}/accessibility/`)
      return [unit.id, response.accessibility_properties ?? []]
    } catch (error) {
      console.warn(`Accessibility import skipped for unit ${unit.id}: ${error.message}`)
      return [unit.id, []]
    }
  }))
  results.forEach(([id, properties]) => accessibility.set(id, properties))
  console.log(`Imported accessibility ${Math.min(index + concurrency, sportsUnits.length)}/${sportsUnits.length}`)
}

const importedAt = new Date().toISOString()
const output = {
  source: serviceMapUnitsUrl,
  accessibilitySource: `${serviceMapBaseUrl}/unit/{id}/accessibility/`,
  webSource: serviceMapWebUrl,
  municipality: 91,
  license: 'CC BY 4.0',
  importedAt,
  units: sportsUnits.map((unit) => {
    const lipasId = lipasIdForUnit(unit)
    const priceFi = localizedConnectionText(unit, 'PRICE', 'fi') || undefined
    const priceEn = localizedConnectionText(unit, 'PRICE', 'en') || undefined
    const properties = accessibility.get(unit.id) ?? []
    return {
      serviceMapId: unit.id,
      lipasId,
      nameFi: unit.name_fi,
      nameEn: unit.name_en,
      shortDescriptionFi: unit.short_desc_fi,
      shortDescriptionEn: unit.short_desc_en,
      descriptionFi: unit.desc_fi,
      descriptionEn: unit.desc_en,
      openingHoursFi: localizedConnectionText(unit, 'OPENING_HOURS', 'fi') || undefined,
      openingHoursEn: localizedConnectionText(unit, 'OPENING_HOURS', 'en') || undefined,
      priceFi,
      priceEn,
      priceClass: priceClassFor(priceFi ?? priceEn),
      usageStatus: usageStatusFor(unit, priceFi ?? priceEn),
      familySignals: familySignalsFor(unit),
      accessibility: accessibilityFor(properties),
      links: linksFor(unit),
      sourceUrl: `${serviceMapWebUrl}/${unit.id}`,
      updatedAt: unit.modified_time ?? unit.last_modified_time,
    }
  }),
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Service Map import complete: ${output.units.length} LIPAS-linked Helsinki units`)
