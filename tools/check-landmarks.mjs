import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('../src/data/olympic-area.json', import.meta.url), 'utf8'))
const sports = data.features.filter(({ properties }) => properties.category === 'sport')
const names = new Set(sports.map(({ properties }) => properties.name).filter(Boolean))
const required = ['Helsingin olympiastadion', 'Bolt Arena', 'Helsingin jäähalli', 'Uimastadion']
const missing = required.filter((name) => !names.has(name))
if (missing.length) throw new Error(`Landmark source features missing: ${missing.join(', ')}`)

const sportsTypes = new Set(sports.flatMap(({ properties }) => (properties.sport ?? '').split(';')).filter(Boolean))
if (![...sportsTypes].some((sport) => ['soccer', 'football'].includes(sport))) throw new Error('Study area needs a football pitch')
if (![...sportsTypes].some((sport) => ['athletics', 'running'].includes(sport))) throw new Error('Study area needs an athletics track')
for (const sport of ['swimming', 'ice_hockey', 'basketball']) {
  if (!sportsTypes.has(sport)) throw new Error(`Study area needs ${sport} data for its visible filter`)
}

const [west, south, east, north] = data.bbox
const [towerLon, towerLat] = [24.92604, 60.18633]
if (towerLon < west || towerLon > east || towerLat < south || towerLat > north) throw new Error('Olympic Stadium tower anchor is outside the study area')

console.log(`Landmark data OK: ${required.length} landmarks, ${sports.length} sports features`)
