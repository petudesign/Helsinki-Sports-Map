const RATE_WINDOW_MS = 60_000
const rateBuckets = new Map()
let nextNominatimRequestAt = 0

function headerValue(request, name) {
  const value = request.headers?.[name]
  return Array.isArray(value) ? value[0] : value
}

function clientIdentifier(request) {
  const forwarded = headerValue(request, 'x-forwarded-for')
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

// Nominatim's public service asks applications to stay at or below one
// request per second. This guard is per warm instance; the app also uses
// WAF limits and only calls Nominatim for explicit user actions.
export function reserveNominatimSlot() {
  const now = Date.now()
  if (now < nextNominatimRequestAt) return Math.ceil((nextNominatimRequestAt - now) / 1000)
  nextNominatimRequestAt = now + 1_000
  return 0
}

export function timeoutSignal(milliseconds) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(milliseconds)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), milliseconds)
  timer.unref?.()
  return controller.signal
}
