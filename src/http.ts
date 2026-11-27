// Shared fetch wrapper for the app's own /api endpoints.

export class HttpRequestError extends Error {
  readonly status: number
  readonly responseError?: string

  constructor(status: number, responseError?: string) {
    super(`Request failed (${status})`)
    this.name = 'HttpRequestError'
    this.status = status
    this.responseError = responseError
  }
}

// Bound both the request and JSON body read. A disconnected local proxy must not
// leave autocomplete or routing waiting forever. Preserve caller cancellation.
export async function requestJson<T>(url: string, signal?: AbortSignal, timeoutMs = 10_000, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...(init.headers ?? {}) } })
    if (!response.ok) {
      let responseError: string | undefined
      try { responseError = (await response.json() as { error?: string }).error } catch { /* Keep the HTTP status as the useful error. */ }
      throw new HttpRequestError(response.status, responseError)
    }
    return await response.json() as T
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
