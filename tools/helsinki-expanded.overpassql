[out:json][timeout:240];
(
  nwr["building"](60.1400,24.8000,60.2800,25.1200);
  way["highway"~"primary|secondary|tertiary|residential|living_street|service|pedestrian|footway|cycleway|path"](60.1400,24.8000,60.2800,25.1200);
  way["railway"~"rail|light_rail|tram"](60.1400,24.8000,60.2800,25.1200);
  way["natural"="coastline"](60.1400,24.8000,60.2800,25.1200);
  nwr["leisure"~"pitch|stadium|track|sports_centre|sports_hall|fitness_station|swimming_pool|park|garden"](60.1400,24.8000,60.2800,25.1200);
  nwr["sport"~"soccer|football|athletics|running|swimming|ice_hockey|basketball|tennis|padel|fitness|skateboard|roller_skating|scooter"](60.1400,24.8000,60.2800,25.1200);
  nwr["landuse"~"grass|meadow|recreation_ground|basin|residential"](60.1400,24.8000,60.2800,25.1200);
  nwr["natural"~"water|wood|tree"](60.1400,24.8000,60.2800,25.1200);
  nwr["water"](60.1400,24.8000,60.2800,25.1200);
  nwr["waterway"~"riverbank|stream|river|canal"](60.1400,24.8000,60.2800,25.1200);
);
out tags geom;
