import { readFile, writeFile } from 'node:fs/promises'
import { runtimeSnapshot } from './lib/lipas-runtime.mjs'

const sourcePath = process.argv[2] ?? 'src/data/lipas-helsinki.json'
const outputPath = process.argv[3] ?? 'src/data/lipas-helsinki-runtime.json'
const source = JSON.parse(await readFile(sourcePath, 'utf8'))
const runtime = runtimeSnapshot(source)

await writeFile(outputPath, `${JSON.stringify(runtime)}\n`)
console.log(`LIPAS runtime data written: ${runtime.sites.length} sites`)
