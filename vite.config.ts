import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import transitRouteHandler from './api/transit-route.mjs'

function transitDevApiPlugin(apiKey: string) {
  if (apiKey) process.env.DIGITRANSIT_API_KEY = apiKey
  return {
    name: 'hsm-transit-dev-api',
    configureServer(server: { middlewares: { use: (path: string, handler: (request: any, response: any, next: () => void) => void) => void } }) {
      server.middlewares.use('/api/transit-route', (request, response, next) => {
        if (request.method !== 'POST') { next(); return }
        let rawBody = ''
        request.on('data', (chunk: Buffer) => { rawBody += chunk.toString() })
        request.on('end', async () => {
          let body
          try { body = JSON.parse(rawBody) } catch {
            response.statusCode = 400
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify({ error: 'Invalid transit request' }))
            return
          }
          const apiResponse = {
            status(code: number) { response.statusCode = code; return apiResponse },
            setHeader(name: string, value: string) { response.setHeader(name, value) },
            json(payload: unknown) { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(payload)) },
          }
          try { await transitRouteHandler({ ...request, body }, apiResponse) }
          catch { response.statusCode = 502; response.end(JSON.stringify({ error: 'transit_service_unavailable' })) }
        })
      })
    },
  }
}

function wfsProxyPath(path: string) {
  const requestUrl = new URL(path, 'http://localhost')
  const prefix = requestUrl.searchParams.get('prefix')?.trim() ?? ''
  const escapedPrefix = prefix.replace(/'/g, "''")
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'avoindata:Helsinki_osoiteluettelo',
    count: '200',
    outputFormat: 'application/json',
    CQL_FILTER: `katunimi ILIKE '${escapedPrefix}%' AND osoitenumero IS NOT NULL`,
  })
  return `/ws/geoserver/avoindata/wfs?${params}`
}

function nominatimSearchProxyPath(path: string) {
  const requestUrl = new URL(path, 'http://localhost')
  const query = requestUrl.searchParams.get('q')?.trim() ?? ''
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', addressdetails: '1', countrycodes: 'fi', 'accept-language': 'fi,en', viewbox: '24.89,60.215,24.98,60.165', bounded: '1', q: query })
  return `/search?${params}`
}

function nominatimReverseProxyPath(path: string) {
  const requestUrl = new URL(path, 'http://localhost')
  const params = new URLSearchParams({ format: 'jsonv2', zoom: '18', addressdetails: '1', 'accept-language': 'fi,en', lat: requestUrl.searchParams.get('lat') ?? '', lon: requestUrl.searchParams.get('lon') ?? '' })
  return `/reverse?${params}`
}

function routeProxyPath(path: string) {
  const requestUrl = new URL(path, 'http://localhost')
  const servers = { walk: 'routed-foot', bike: 'routed-bike', car: 'routed-car' }
  const server = servers[requestUrl.searchParams.get('mode') as keyof typeof servers] ?? 'routed-foot'
  const coordinates = [
    `${requestUrl.searchParams.get('originLng') ?? ''},${requestUrl.searchParams.get('originLat') ?? ''}`,
    `${requestUrl.searchParams.get('destinationLng') ?? ''},${requestUrl.searchParams.get('destinationLat') ?? ''}`,
  ].join(';')
  return `/${server}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.PAIKKATIETO_API_KEY
  const transitApiKey = env.DIGITRANSIT_API_KEY

  return {
    plugins: [react(), transitDevApiPlugin(transitApiKey)],
    server: {
      proxy: {
          '/api/paikkatieto': {
          target: 'https://paikkatietohaku.api.hel.fi',
          changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/paikkatieto/, '/v1/address/'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyRequest) => {
              if (apiKey) proxyRequest.setHeader('Api-Key', apiKey)
            })
            },
          },
          '/api/helsinki-streets': {
            target: 'https://kartta.hel.fi',
            changeOrigin: true,
            rewrite: wfsProxyPath,
          },
          '/api/geocode': {
            target: 'https://nominatim.openstreetmap.org',
            changeOrigin: true,
            rewrite: nominatimSearchProxyPath,
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyRequest) => proxyRequest.setHeader('User-Agent', 'Helsinki-Sports-Map/0.0.1 (+https://helsinki-sports-map.vercel.app/)'))
            },
          },
          '/api/reverse-geocode': {
            target: 'https://nominatim.openstreetmap.org',
            changeOrigin: true,
            rewrite: nominatimReverseProxyPath,
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyRequest) => proxyRequest.setHeader('User-Agent', 'Helsinki-Sports-Map/0.0.1 (+https://helsinki-sports-map.vercel.app/)'))
            },
          },
          '/api/route': {
            target: 'https://routing.openstreetmap.de',
            changeOrigin: true,
            rewrite: routeProxyPath,
          },
        },
    },
  }
})
