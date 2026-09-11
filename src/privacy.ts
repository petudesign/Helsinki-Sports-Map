export type AnalyticsConsent = 'granted' | 'denied'

const CONSENT_COOKIE = 'hsm_privacy'

export function getAnalyticsConsent(): AnalyticsConsent | undefined {
  if (typeof document === 'undefined') return undefined
  const value = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1)
  if (!value) return undefined
  let decoded: string
  try { decoded = decodeURIComponent(value) } catch { return undefined }
  return decoded === 'analytics=granted' || decoded === 'analytics=denied' ? decoded.replace('analytics=', '') as AnalyticsConsent : undefined
}

export function setAnalyticsConsent(consent: AnalyticsConsent) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(`analytics=${consent}`)}; Max-Age=31536000; Path=/; SameSite=Lax`
}
