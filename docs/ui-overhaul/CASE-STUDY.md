# Helsinki Sports Map: three rounds of making it hold up

Helsinki Sports Map puts the city's public sports facilities on one map, from LIPAS and the Helsinki Service Map. It worked, but it had been built against kind data and looked like it had been assembled in layers. I ran three rounds on it: break it, watch people use it, then measure it. Each round set the agenda for the next.

## 1. Break it

Before touching the visuals, I built a development-only switch that loads worst-case data through the same path as the real data. The cases were Finnish compound names that don't wrap, a venue with 35 sports, eight times the facilities, every optional field missing, an empty search, denied location, and the map or the dataset failing to load.

Fifteen things broke. A long name squeezed the panel title to one letter per line at 200 % zoom. When the basemap failed, the user got dots on a blank canvas and no message. "Price not listed" filled nearly every row, and missing facts were laid out as a table of blanks. The page never told screen readers it had switched to Finnish. I fixed what broke and kept the switch as the regression test for every later round.

## 2. Watch five people use it

Five independent agents used the app only through screenshots, each as a persona with a task and a device: a commuter with 60 seconds to find a free court nearby, a family looking for swimming hours and prices, an English speaker who knows no Finnish place names, a design lead with two minutes, and a low-vision user on keyboard at 200 % zoom with red–green colour blindness.

None of them fully completed their task, and trust averaged 2.2 out of 5. The useful part was the overlap. Four of the five hit the same problems: the place panel covered the map on a phone, the "official details" links led to a provider's front page, and nothing told you what was near you. Two found that filters silently hid places with an unknown price. I fixed the repeated findings first, then rebuilt the visual layer: one token file, one accent colour, three text levels all above 5:1 contrast, one radius and shadow scale, and one model per component. The map now fills the screen under floating panels, and its markers use the same blue as everything else, which also survives both red–green deficiencies.

## 3. Measure

Lighthouse, medians of three runs on production builds. Mobile performance went from 58 to 79, desktop from 93 to 98, and accessibility, best practices and SEO reached 100 on both. Most of the mobile gain came from no longer waiting on the data before drawing the interface. The panel paints first, and the map library loads in its own chunk.

Measuring also caught two problems that no screenshot of the dev server showed. Splitting the bundle changed the CSS order in production and collapsed the map to zero height. And once the map was back, the largest thing on a phone screen turned out to be MapLibre's attribution text, which opens on load. Both are fixed, and the remaining distance to 100 on mobile is written down with the reason, not hidden.

Every decision, and what I chose not to do, is logged in `DECISIONS.md`. The before and after screenshots for each round are in `docs/ui-overhaul/`.
