export const editorialTheme = {
  ground: '#f0ede6',
  grain: '#18324a',
  water: '#acd8df',
  waterLine: '#5b9eae',
  rail: '#66767a',
  railTie: 'rgba(47, 51, 48, .34)',
  waterline: '#6eaaa9',
  green: '#b7c8b0',
  greenEdge: 'rgba(55, 91, 73, .22)',
  urban: '#e3e5e1',
  urbanEdge: 'rgba(68, 91, 92, .16)',
  buildingTop: '#dad9d3',
  buildingSide: '#c2c7c3',
  buildingSideDark: '#a8b2b0',
  buildingOutline: 'rgba(24, 50, 74, .42)',
  shadow: 'rgba(69, 61, 54, .11)',
  road: '#c9ccca',
  roadEdge: '#879595',
  path: 'rgba(71, 101, 104, .42)',
  accent: '#c45f46',
  ink: '#18324a',
  tree: '#5f856e',
  treeLight: '#7ea184',
}

export const sportStyles: Record<string, { fill: string; stroke: string; marking: string }> = {
  soccer: { fill: '#82966f', stroke: '#b95843', marking: 'rgba(239,235,224,.82)' },
  football: { fill: '#82966f', stroke: '#b95843', marking: 'rgba(239,235,224,.82)' },
  athletics: { fill: '#bb735f', stroke: '#914b3e', marking: 'rgba(244,226,215,.76)' },
  running: { fill: '#bb735f', stroke: '#914b3e', marking: 'rgba(244,226,215,.76)' },
  swimming: { fill: '#8fbabd', stroke: '#b95843', marking: 'rgba(239,235,224,.78)' },
  ice_hockey: { fill: '#d3dedb', stroke: '#b95843', marking: 'rgba(113,139,139,.62)' },
  basketball: { fill: '#c68b67', stroke: '#994e3c', marking: 'rgba(247,232,218,.76)' },
  tennis: { fill: '#b7a56e', stroke: '#8f6f45', marking: 'rgba(247,240,216,.88)' },
  padel: { fill: '#a9a276', stroke: '#7e754b', marking: 'rgba(247,240,216,.88)' },
  outdoor_fitness: { fill: '#9a8d77', stroke: '#765f49', marking: 'rgba(245,235,215,.72)' },
  multi: { fill: '#c9916f', stroke: '#a34f3d', marking: 'rgba(247,232,218,.76)' },
}

export function sportStyle(sport: string) {
  return sportStyles[sport] ?? sportStyles.multi
}
