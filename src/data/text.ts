// Comparison key for venue names and addresses: lower case, accents and
// punctuation removed, so "Töölön Kisahalli" and "toolon kisahalli" match.
export function nameKey(value: string | undefined) {
  return (value ?? '').toLocaleLowerCase('fi-FI').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')
}
