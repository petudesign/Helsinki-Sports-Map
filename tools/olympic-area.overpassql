[out:json][timeout:60];
(
  nwr["building"](60.1650,24.8900,60.2150,24.9800);
  way["highway"~"primary|secondary|tertiary|residential|living_street|service|pedestrian|footway|cycleway|path"](60.1650,24.8900,60.2150,24.9800);
  way["railway"~"rail|light_rail|tram"](60.1650,24.8900,60.2150,24.9800);
  way["natural"="coastline"](60.1650,24.8900,60.2150,24.9800);
  nwr["leisure"~"pitch|stadium|track|sports_centre|sports_hall|fitness_station|swimming_pool|park|garden"](60.1650,24.8900,60.2150,24.9800);
  nwr["sport"~"soccer|football|athletics|running|swimming|ice_hockey|basketball|tennis|padel|fitness"](60.1650,24.8900,60.2150,24.9800);
  nwr["landuse"~"grass|meadow|recreation_ground|basin|residential"](60.1650,24.8900,60.2150,24.9800);
  nwr["natural"~"water|wood|tree"](60.1650,24.8900,60.2150,24.9800);
  nwr["water"](60.1650,24.8900,60.2150,24.9800);
  nwr["waterway"~"riverbank|stream|river|canal"](60.1650,24.8900,60.2150,24.9800);
);
out tags geom;
