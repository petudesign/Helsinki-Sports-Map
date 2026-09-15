const PAIKKATIETO_ADDRESS_URL = 'https://paikkatietohaku.api.hel.fi/v1/address/'
import { applyRateLimit, readBoundedInteger, readBoundedQueryParam, timeoutSignal } from '../server/security.mjs'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!applyRateLimit(request, response, { scope: 'paikkatieto', limit: 30 })) return

  const apiKey = process.env.PAIKKATIETO_API_KEY
  if (!apiKey) {
    response.status(503).json({ error: 'Paikkatieto API is not configured' })
    return
  }

  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const streetname = readBoundedQueryParam(requestUrl, 'streetname', { maxLength: 80, required: true })
  const streetnumber = readBoundedQueryParam(requestUrl, 'streetnumber', { maxLength: 8 })
  const page = readBoundedInteger(requestUrl, 'page', { min: 1, max: 10, defaultValue: 1 })
  const pageSize = readBoundedInteger(requestUrl, 'page_size', { min: 1, max: 25, defaultValue: 5 })
  if (!streetname.valid || !page.valid || !pageSize.valid || (streetnumber.value && !/^\d{1,4}[A-Za-z]?$/.test(streetnumber.value))) {
    response.status(400).json({ error: 'Invalid address query' })
    return
  }
  const query = new URLSearchParams()
  query.set('municipality', 'Helsinki')
  query.set('page', String(page.value))
  query.set('page_size', String(pageSize.value))
  query.set('streetname', streetname.value)
  if (streetnumber.value) query.set('streetnumber', streetnumber.value)

  try {
    const upstream = await fetch(`${PAIKKATIETO_ADDRESS_URL}?${query}`, {
      headers: { Accept: 'application/json', 'Api-Key': apiKey },
      signal: timeoutSignal(5_000),
    })
    const contentLength = Number(upstream.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
      response.status(502).json({ error: 'Address response was too large' })
      return
    }
    const body = await upstream.text()
    if (body.length > 1_000_000) {
      response.status(502).json({ error: 'Address response was too large' })
      return
    }
    if (!upstream.ok) {
      response.status(502).json({ error: 'Paikkatieto API request failed' })
      return
    }
    response.status(200)
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800, stale-if-error=600')
    response.send(body)
  } catch {
    response.status(502).json({ error: 'Paikkatieto API request failed' })
  }
}
