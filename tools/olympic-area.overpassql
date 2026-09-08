[out:json][timeout:90];
(
  nwr["building"](60.1825,24.9175,60.1920,24.9370);
  way["highway"~"primary|secondary|tertiary|residential|living_street|service|pedestrian|footway|cycleway|path"](60.1825,24.9175,60.1920,24.9370);
  nwr["leisure"~"pitch|stadium|track|sports_centre|park|garden"](60.1825,24.9175,60.1920,24.9370);
  nwr["landuse"~"grass|meadow|recreation_ground"](60.1825,24.9175,60.1920,24.9370);
  nwr["natural"~"water|wood|tree"](60.1825,24.9175,60.1920,24.9370);
  nwr["waterway"="riverbank"](60.1825,24.9175,60.1920,24.9370);
);
out tags geom;
