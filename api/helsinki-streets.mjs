import { applyRateLimit, readBoundedQueryParam, timeoutSignal } from '../server/security.mjs'

const HELSINKI_WFS_URL = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs'

function escapeCqlLiteral(value) {
  return value.replace(/'/g, "''")
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!applyRateLimit(request, response, { scope: 'helsinki-streets', limit: 60 })) return

  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const prefixParam = readBoundedQueryParam(requestUrl, 'prefix', { maxLength: 64 })
  if (!prefixParam.valid) {
    response.status(400).json({ error: 'Invalid street prefix' })
    return
  }
  const prefix = prefixParam.value ?? ''
  if (prefix.length < 2) {
    response.status(200).json({ type: 'FeatureCollection', features: [] })
    return
  }

  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'avoindata:Helsinki_osoiteluettelo',
    count: '200',
    outputFormat: 'application/json',
    CQL_FILTER: `katunimi ILIKE '${escapeCqlLiteral(prefix)}%' AND osoitenumero IS NOT NULL`,
  })

  try {
    const upstream = await fetch(`${HELSINKI_WFS_URL}?${params}`, { signal: timeoutSignal(5_000) })
    const contentLength = Number(upstream.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
      response.status(502).json({ error: 'Street response was too large' })
      return
    }
    const body = await upstream.text()
    if (body.length > 1_000_000) {
      response.status(502).json({ error: 'Street response was too large' })
      return
    }
    if (!upstream.ok) {
      response.status(502).json({ error: 'Helsinki street lookup failed' })
      return
    }
    response.status(200)
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=86400')
    response.send(body)
  } catch {
    response.status(502).json({ error: 'Helsinki street lookup failed' })
  }
}
