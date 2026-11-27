import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import geocodeHandler from './api/geocode.mjs'
import helsinkiStreetsHandler from './api/helsinki-streets.mjs'
import paikkatietoHandler from './api/paikkatieto.mjs'
import placesHandler from './api/places.mjs'
import reverseGeocodeHandler from './api/reverse-geocode.mjs'
import routeHandler from './api/route.mjs'
import transitRouteHandler from './api/transit-route.mjs'

type ApiResponse = {
  status(code: number): ApiResponse
  setHeader(name: string, value: string): void
  json(payload: unknown): void
  send(body: string): void
}
type ApiHandler = (request: IncomingMessage, response: ApiResponse) => Promise<void>

// The dev server runs the same serverless handlers as production, so local
// requests get the same validation, size limits and rate limits.
const apiHandlers: Record<string, ApiHandler> = {
  '/api/geocode': geocodeHandler,
  '/api/helsinki-streets': helsinkiStreetsHandler,
  '/api/paikkatieto': paikkatietoHandler,
  '/api/places': placesHandler,
  '/api/reverse-geocode': reverseGeocodeHandler,
  '/api/route': routeHandler,
  '/api/transit-route': transitRouteHandler,
}

function vercelStyleResponse(response: ServerResponse): ApiResponse {
  const api: ApiResponse = {
    status(code) { response.statusCode = code; return api },
    setHeader(name, value) { response.setHeader(name, value) },
    json(payload) { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(payload)) },
    send(body) { response.end(body) },
  }
  return api
}

function devApiPlugin(env: Record<string, string>) {
  // Handlers read their keys from process.env, as they do on Vercel.
  for (const name of ['PAIKKATIETO_API_KEY', 'DIGITRANSIT_API_KEY']) {
    if (env[name]) process.env[name] = env[name]
  }
  return {
    name: 'hsm-dev-api',
    configureServer(server: { middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const handler = apiHandlers[new URL(request.url ?? '/', 'http://localhost').pathname]
        if (!handler) { next(); return }
        handler(request, vercelStyleResponse(response)).catch(() => {
          if (response.headersSent) { response.end(); return }
          response.statusCode = 502
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'service_unavailable' }))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApiPlugin(loadEnv(mode, process.cwd(), ''))],
}))
