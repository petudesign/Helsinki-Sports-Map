import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve(process.cwd(), 'src/data/review-staging.json')
const staging = JSON.parse(fs.readFileSync(filePath, 'utf8'))
const failures = []

if (staging.schemaVersion !== 1) failures.push('schemaVersion must be 1')
if (!staging.city) failures.push('city is missing')
if (!staging.source?.provider || !staging.source?.url) failures.push('source provenance is incomplete')
if (!Array.isArray(staging.candidates) || staging.candidates.length === 0) failures.push('no staging candidates found')

for (const candidate of staging.candidates ?? []) {
  if (!candidate.id || !candidate.venueName || !candidate.sourceUrl) failures.push(`${candidate.id ?? 'unknown'} has incomplete identity/provenance`)
  if (!Array.isArray(candidate.priceOptions) || candidate.priceOptions.length === 0) failures.push(`${candidate.id ?? 'unknown'} has no structured price options`)
  if (!Array.isArray(candidate.checks) || candidate.checks.reduce((sum, check) => sum + check.weight, 0) !== 100) failures.push(`${candidate.id ?? 'unknown'} checks do not total 100 points`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

const optionCount = staging.candidates.reduce((sum, candidate) => sum + candidate.priceOptions.length, 0)
console.log(`Review staging valid · ${staging.candidates.length} candidates · ${optionCount} price options`)
