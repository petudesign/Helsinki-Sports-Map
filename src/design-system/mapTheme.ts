/*
 * MapLibre counterpart of tokens.css. Layer paint properties cannot read CSS
 * custom properties, so the map's roles are mirrored here with the same names.
 * Keep the two files in sync.
 */
export const mapTheme = {
  accent: '#0755a0',      // --accent: clusters, places, selection
  accentHalo: 'rgba(7, 85, 160, 0.16)',
  onAccent: '#ffffff',    // --on-accent
  ink: '#18181b',         // --text-1: labels, the "you are here" dot
  inkMuted: '#52525b',    // --text-2
  halo: '#ffffff',
  ground: '#f2f2f0',      // --map-ground
  water: '#d5e3ec',       // --map-water
  park: '#e2ebdf',        // --map-park
  outside: '#18181b',     // mask outside Helsinki, used at low opacity
  boundary: '#a1a1aa',    // --gray-400
  label: '#66666e',       // --text-3: place names
  labelSoft: '#8a8a93',   // street names, one step quieter
  waterLabel: '#5f7d91',
  road: '#ffffff',
  roadCasing: '#e4e4e7',  // --gray-200
  building: '#e7e7e9',
  residential: '#efefed',
  shadow: 'rgba(24, 24, 27, 0.22)',
} as const
