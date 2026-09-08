export const editorialTheme = {
  ground: '#ede8df',
  grain: '#2f3330',
  water: '#b9d3d2',
  waterLine: '#8fb7b5',
  green: '#b8c1aa',
  greenEdge: 'rgba(72, 86, 68, .16)',
  buildingTop: '#e9e3da',
  buildingSide: '#c5bbb1',
  buildingSideDark: '#aea49a',
  buildingOutline: 'rgba(47, 51, 48, .3)',
  shadow: 'rgba(69, 61, 54, .11)',
  road: '#d3cbc1',
  roadEdge: '#a79d92',
  path: 'rgba(104, 96, 87, .4)',
  accent: '#c45f46',
  ink: '#2f3330',
  tree: '#70856c',
  treeLight: '#899c77',
}

export const sportStyles: Record<string, { fill: string; stroke: string; marking: string }> = {
  soccer: { fill: '#82966f', stroke: '#b95843', marking: 'rgba(239,235,224,.82)' },
  football: { fill: '#82966f', stroke: '#b95843', marking: 'rgba(239,235,224,.82)' },
  athletics: { fill: '#bb735f', stroke: '#914b3e', marking: 'rgba(244,226,215,.76)' },
  running: { fill: '#bb735f', stroke: '#914b3e', marking: 'rgba(244,226,215,.76)' },
  swimming: { fill: '#8fbabd', stroke: '#b95843', marking: 'rgba(239,235,224,.78)' },
  ice_hockey: { fill: '#d3dedb', stroke: '#b95843', marking: 'rgba(113,139,139,.62)' },
  basketball: { fill: '#c68b67', stroke: '#994e3c', marking: 'rgba(247,232,218,.76)' },
  multi: { fill: '#c9916f', stroke: '#a34f3d', marking: 'rgba(247,232,218,.76)' },
}

export function sportStyle(sport: string) {
  return sportStyles[sport] ?? sportStyles.multi
}
