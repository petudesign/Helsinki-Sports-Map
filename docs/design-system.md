# HSM design system

The HSM design system is code-first. Its source of truth is the token file in
`src/design-system/tokens.css`; Paper can be used as a visual canvas, but is
not part of the runtime or the canonical design data.

## What belongs here

- semantic color roles, not component-specific color names
- typography families and UI text sizes
- spacing, radius and elevation primitives
- shared component states such as focus, selected, approved, rejected and skipped
- map canvas roles with a TypeScript counterpart for Canvas and OffscreenCanvas

Components should consume these tokens instead of inventing new values. A
future city should inherit the same system; city-specific visual changes belong
in an explicit theme layer, not in copied component styles.

## Current first layer

The first layer centralizes the current HSM palette and the repeated values used
by the map and reviewer workbench. The map and review surfaces are different
tools, but they share the same page/surface colors, ink hierarchy, accents,
controls, borders, spacing and semantic states. Feature-specific density and
layout remain local to each surface. We will add component variants only when a
real repeated pattern appears. Renderer-only canvas colors have a matching
semantic file in `src/design-system/canvasTheme.ts` because workers cannot
resolve CSS custom properties.

The component and state preview is available locally at
`http://localhost:4181/?design-system=1`. It is an implementation reference,
not a second production route: interactive examples use the same state classes
and semantic tokens as the real UI.

To change the visual direction, edit the values in `tokens.css` first and then
check the map and reviewer routes. The design system does not require Figma.

## Paper workflow

Paper may import these CSS variables through its MCP connection and can be used
to explore layouts or component states. Changes made in Paper should come back
through MCP as reviewed code changes. The production app continues to consume
the code tokens directly.
