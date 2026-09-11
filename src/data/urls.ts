export function normalizeExternalUrl(value: string | undefined) {
  const url = value?.trim()
  if (!url) return undefined
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  return `https://${url}`
}
