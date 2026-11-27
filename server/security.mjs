const RATE_WINDOW_MS = 60_000
const rateBuckets = new Map()
let nextNominatimRequestAt = 0

function headerValue(request, name) {
  const value = request.headers?.[name]
  return Array.isArray(value) ? value[0] : value
}

// Vercel sets these headers itself and does not forward client-supplied IPs, so
// they are trustworthy there. Anywhere else (the local dev server) a client can
// send its own value, which is acceptable only because that server is local.
function clientIdentifier(request) {
  const forwarded = headerValue(request, 'x-vercel-forwarded-for') ?? headerValue(request, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown'
  return headerValue(request, 'x-real-ip')?.trim() || 'unknown'
}

// This is defence in depth for a warm function instance. Vercel WAF must be
// the authoritative cross-instance rate limit in production.
export function applyRateLimit(request, response, { scope, limit }) {
  const now = Date.now()
  const key = `${scope}:${clientIdentifier(request)}`
  let bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    bucket = { startedAt: now, count: 0 }
    rateBuckets.set(key, bucket)
  }
  bucket.count += 1

  if (rateBuckets.size > 2_000) {
    for (const [bucketKey, candidate] of rateBuckets) {
      if (now - candidate.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(bucketKey)
    }
  }

  const resetAt = bucket.startedAt + RATE_WINDOW_MS
  response.setHeader('X-RateLimit-Limit', String(limit))
  response.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)))
  response.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  if (bucket.count <= limit) return true

  response.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - now) / 1000))))
  response.status(429).json({ error: 'Too many requests' })
  return false
}

export function readBoundedQueryParam(url, name, { maxLength = 64, required = false } = {}) {
  const raw = url.searchParams.get(name)
  if (raw === null) return required ? { valid: false, value: undefined } : { valid: true, value: undefined }
  const value = raw.trim()
  if (!value || value.length > maxLength || /[\u0000-\u001F\u007F]/.test(value)) return { valid: false, value: undefined }
  return { valid: true, value }
}

export function readBoundedInteger(url, name, { min, max, defaultValue }) {
  const raw = url.searchParams.get(name)
  if (raw === null || raw.trim() === '') return { valid: true, value: defaultValue }
  if (!/^\d+$/.test(raw.trim())) return { valid: false, value: undefined }
  const value = Number(raw)
  return Number.isInteger(value) && value >= min && value <= max
    ? { valid: true, value }
    : { valid: false, value: undefined }
}

export function readCoordinate(url, name, { min, max }) {
  const raw = url.searchParams.get(name)?.trim()
  if (!raw || raw.length > 24 || !/^-?\d+(?:\.\d+)?$/.test(raw)) return { valid: false, value: undefined }
  const value = Number(raw)
  return Number.isFinite(value) && value >= min && value <= max
    ? { valid: true, value }
    : { valid: false, value: undefined }
}

// Answers 405 and returns false unless the request uses the given method.
export function requireMethod(request, response, method) {
  if (request.method === method) return true
  response.setHeader('Allow', method)
  response.status(405).json({ error: 'Method not allowed' })
  return false
}

// Handlers only read the query string; the host is a placeholder.
export function requestUrlOf(request) {
  return new URL(request.url ?? '/', 'http://localhost')
}

export const NOMINATIM_USER_AGENT = 'Helsinki-Sports-Map/0.0.1 (+https://helsinki-sports-map.vercel.app/)'

// Nominatim's public service asks applications to stay at or below one
// request per second. This guard is per warm instance; the app also uses
// WAF limits and only calls Nominatim for explicit user actions.
export function reserveNominatimSlot() {
  const now = Date.now()
  if (now < nextNominatimRequestAt) return Math.ceil((nextNominatimRequestAt - now) / 1000)
  nextNominatimRequestAt = now + 1_000
  return 0
}

// Read an upstream response body, stopping as soon as it exceeds maxBytes so an
// oversized or endless response never sits fully in memory. Returns undefined
// when the body is too large.
export async function readBoundedText(response, maxBytes) {
  const declared = Number(response.headers?.get?.('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) return undefined
  const reader = response.body?.getReader?.()
  if (!reader) {
    const text = await response.text()
    return new TextEncoder().encode(text).byteLength > maxBytes ? undefined : text
  }
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return undefined
    }
    chunks.push(value)
  }
  const decoder = new TextDecoder()
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode()
}

export class RequestBodyTooLargeError extends Error {}

// Parse a JSON request body with a hard size limit. Vercel may hand over an
// already-parsed body; a raw Node stream is read incrementally.
export async function readJsonBody(request, maxBytes = 16_000) {
  if (request.body && typeof request.body === 'object') return request.body
  if (typeof request.body === 'string') {
    if (new TextEncoder().encode(request.body).byteLength > maxBytes) throw new RequestBodyTooLargeError()
    return JSON.parse(request.body)
  }
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    total += chunk.length
    if (total > maxBytes) throw new RequestBodyTooLargeError()
    chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
  }
  const body = new TextDecoder().decode(Buffer.concat(chunks))
  return body ? JSON.parse(body) : undefined
}

export function timeoutSignal(milliseconds) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(milliseconds)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), milliseconds)
  timer.unref?.()
  return controller.signal
}
