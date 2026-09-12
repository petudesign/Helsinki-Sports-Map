/*
 * Canvas counterpart of the CSS design tokens. Canvas and OffscreenCanvas do
 * not have access to computed CSS variables, so renderer-only colors live here
 * under the same semantic HSM roles.
 */
export const hsmCanvasTheme = {
  page: '#f0ede6',
  surface: '#fffdf9',
  ink: '#18324a',
  accent: '#b9543e',
  mapGround: '#dfe7e1',
  mapWater: '#acd8df',
  mapPark: '#b7c8b0',
  mapSport: '#82966f',
  mapSwimming: '#8fbabd',
} as const
