import { readFile } from 'node:fs/promises'

const lipas = JSON.parse(await readFile(new URL('../src/data/lipas-helsinki.json', import.meta.url), 'utf8'))
const snapshot = JSON.parse(await readFile(new URL('../src/data/service-map-helsinki.json', import.meta.url), 'utf8'))
const lipasIds = new Set(lipas.sites.map((site) => site.id))
const allowedTriStates = new Set(['yes', 'no', 'unknown'])
const allowedPriceClasses = new Set(['free', 'paid', 'mixed', 'unknown'])
const accessibilityFields = ['stepFreeEntrance', 'accessibleToilet', 'accessibleParking', 'lift', 'ramp', 'wheelchairSpace']

if (!Array.isArray(snapshot.units) || snapshot.units.length === 0) throw new Error('Service Map snapshot has no units')
const serviceMapIds = new Set()
for (const unit of snapshot.units) {
  if (serviceMapIds.has(unit.serviceMapId)) throw new Error(`Duplicate Service Map id: ${unit.serviceMapId}`)
  serviceMapIds.add(unit.serviceMapId)
  if (!lipasIds.has(unit.lipasId)) throw new Error(`Unknown LIPAS id in Service Map snapshot: ${unit.lipasId}`)
  if (!allowedPriceClasses.has(unit.priceClass)) throw new Error(`Invalid price class for ${unit.serviceMapId}`)
  for (const field of accessibilityFields) {
    if (!allowedTriStates.has(unit.accessibility?.[field])) throw new Error(`Invalid accessibility state for ${unit.serviceMapId}.${field}`)
  }
  if (!/^https:\/\//.test(unit.sourceUrl)) throw new Error(`Invalid source URL for ${unit.serviceMapId}`)
}

const withPrice = snapshot.units.filter((unit) => unit.priceClass !== 'unknown').length
const withAccessibility = snapshot.units.filter((unit) => accessibilityFields.some((field) => unit.accessibility[field] !== 'unknown')).length
const withFamilySignals = snapshot.units.filter((unit) => unit.familySignals.length > 0).length
console.log(`Service Map snapshot OK: ${snapshot.units.length} units · ${withPrice} with price · ${withAccessibility} with accessibility · ${withFamilySignals} with family signals`)
