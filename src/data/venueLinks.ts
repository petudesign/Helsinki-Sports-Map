type VenueProfile = {
  sports?: string[]
  officialUrl?: string
  serviceMapId?: number
}

const venueProfiles: Record<string, VenueProfile> = {
  'way/138324256': {
    sports: ['basketball', 'volleyball', 'badminton', 'table_tennis', 'karate', 'golf'],
    officialUrl: 'https://palvelukartta.hel.fi/fi/unit/45925',
    serviceMapId: 45925,
  },
  'way/138324248': {
    sports: ['athletics', 'football'],
    officialUrl: 'https://palvelukartta.hel.fi/fi/unit/40204',
  },
}

export function venueProfile(id: string) {
  return venueProfiles[id]
}
