import { iceCandidates } from "./iceCandidates";

export { iceCandidates };
export const curatedCandidateCount = iceCandidates.length;

const MOON_RADIUS = 1.2719;

const LANDING_FACTOR_WEIGHTS = {
  safety: 0.24,
  illumination: 0.14,
  communication: 0.08,
  thermal: 0.12,
  ellipse: 0.14,
  traverse: 0.16,
  reachable: 0.12,
  riskPenalty: -0.1
};

function toCartesian(latitude, longitude, radius = MOON_RADIUS) {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  const cosLat = Math.cos(lat);

  return {
    x: Number((radius * cosLat * Math.cos(lon)).toFixed(6)),
    y: Number((radius * Math.sin(lat)).toFixed(6)),
    z: Number((radius * cosLat * Math.sin(lon)).toFixed(6))
  };
}

function scoreLandingFactors(factors) {
  const total =
    factors.safety * LANDING_FACTOR_WEIGHTS.safety +
    factors.illumination * LANDING_FACTOR_WEIGHTS.illumination +
    factors.communication * LANDING_FACTOR_WEIGHTS.communication +
    factors.thermal * LANDING_FACTOR_WEIGHTS.thermal +
    factors.ellipse * LANDING_FACTOR_WEIGHTS.ellipse +
    factors.traverse * LANDING_FACTOR_WEIGHTS.traverse +
    factors.reachable * LANDING_FACTOR_WEIGHTS.reachable +
    factors.riskPenalty * LANDING_FACTOR_WEIGHTS.riskPenalty;

  return Math.round(total * 100);
}

function percent(value) {
  return Math.round(value * 100);
}

function band(value, high, medium) {
  if (value >= high) {
    return "High";
  }

  if (value >= medium) {
    return "Medium";
  }

  return "Low";
}

function riskBand(traverse, riskPenalty) {
  const effective = traverse - riskPenalty * 0.65;

  if (effective >= 0.56) {
    return "Low";
  }

  if (effective >= 0.43) {
    return "Medium";
  }

  return "High";
}

function withDerivedSite(site) {
  const score = scoreLandingFactors(site.factors);
  const terrainSafety = (site.factors.safety + site.factors.ellipse) / 2;

  return {
    ...site,
    score,
    illumination: band(site.factors.illumination, 0.62, 0.42),
    slopeSafety: band(terrainSafety, 0.62, 0.42),
    traverseRisk: riskBand(site.factors.traverse, site.factors.riskPenalty),
    reachableIce: band(site.factors.reachable, 0.76, 0.7),
    factorPercents: {
      safety: percent(site.factors.safety),
      illumination: percent(site.factors.illumination),
      communication: percent(site.factors.communication),
      thermal: percent(site.factors.thermal),
      ellipse: percent(site.factors.ellipse),
      traverse: percent(site.factors.traverse),
      reachable: percent(site.factors.reachable),
      riskPenalty: percent(site.factors.riskPenalty)
    },
    cartesian: toCartesian(site.latitude, site.longitude)
  };
}

export const landingSites = [
  {
    id: "ls-01",
    name: "Outer Shelf Prime",
    classification: "Primary",
    latitude: -84.32,
    longitude: 342,
    anchorTarget: "spi-012",
    campaignTargets: ["spi-012", "spi-001", "spi-002", "spi-003", "spi-004"],
    geomorphology:
      "far-outer south-polar shelf selected to maximize illumination proxy and make the rover traverse cut back through the inner hazard field",
    factors: {
      safety: 1,
      illumination: 0.979,
      communication: 0.952,
      thermal: 0.538,
      ellipse: 0.93,
      traverse: 0.667,
      reachable: 0.625,
      riskPenalty: 0
    }
  },
  {
    id: "ls-02",
    name: "Arc Light Shelf",
    classification: "Primary",
    latitude: -84.24,
    longitude: 178,
    anchorTarget: "spi-007",
    geomorphology:
      "farther meridian shelf with high visibility and a long inward traverse that crosses the central obstacle geometry",
    factors: {
      safety: 1,
      illumination: 0.929,
      communication: 0.984,
      thermal: 0.543,
      ellipse: 0.93,
      traverse: 0.661,
      reachable: 0.643,
      riskPenalty: 0
    }
  },
  {
    id: "ls-03",
    name: "Sunward Ridge Gate",
    classification: "Primary",
    latitude: -84.32,
    longitude: 202,
    anchorTarget: "spi-007",
    geomorphology:
      "sun-facing outer shelf retained to show a visibly longer bend back toward the interior ice-support corridor",
    factors: {
      safety: 1,
      illumination: 0.982,
      communication: 0.952,
      thermal: 0.488,
      ellipse: 0.93,
      traverse: 0.637,
      reachable: 0.615,
      riskPenalty: 0
    }
  },
  {
    id: "ls-04",
    name: "Eastern Bench Shelf",
    classification: "Primary",
    latitude: -84.24,
    longitude: 93,
    anchorTarget: "spi-004",
    geomorphology:
      "outer eastern bench kept well away from the pole so the route has to work back around the crater band before closing on the target",
    factors: {
      safety: 1,
      illumination: 0.928,
      communication: 0.982,
      thermal: 0.47,
      ellipse: 0.925,
      traverse: 0.615,
      reachable: 0.62,
      riskPenalty: 0
    }
  },
  {
    id: "ls-05",
    name: "Traverse Shelf Meridian",
    classification: "Primary",
    latitude: -84.32,
    longitude: 279,
    anchorTarget: "spi-012",
    geomorphology:
      "outer western meridian shelf chosen to emphasize the path-length tradeoff between illumination gain and deeper traverse complexity",
    factors: {
      safety: 1,
      illumination: 0.976,
      communication: 0.952,
      thermal: 0.429,
      ellipse: 0.93,
      traverse: 0.601,
      reachable: 0.605,
      riskPenalty: 0
    }
  },
  {
    id: "ls-r1",
    name: "Eastern Arc Reserve",
    classification: "Reserve",
    latitude: -84.32,
    longitude: 47,
    anchorTarget: "spi-003",
    geomorphology:
      "reserve outer-arc shelf with strong illumination and a long inward eastern traverse toward the retained target sector",
    factors: {
      safety: 1,
      illumination: 0.981,
      communication: 0.952,
      thermal: 0.442,
      ellipse: 0.86,
      traverse: 0.61,
      reachable: 0.626,
      riskPenalty: 0
    }
  },
  {
    id: "ls-r2",
    name: "Relief Shelf Reserve",
    classification: "Reserve",
    latitude: -84.32,
    longitude: 340,
    anchorTarget: "spi-012",
    geomorphology:
      "reserve far-outer shelf retained as a second high-visibility descent option along the same polar arc",
    factors: {
      safety: 1,
      illumination: 0.978,
      communication: 0.952,
      thermal: 0.54,
      ellipse: 0.93,
      traverse: 0.667,
      reachable: 0.626,
      riskPenalty: 0
    }
  }
].map(withDerivedSite);

export const traverseHazards = [
  { id: "hz-01", latitude: -88.7, longitude: 18, radiusDeg: 0.95 },
  { id: "hz-02", latitude: -88.3, longitude: 42, radiusDeg: 0.82 },
  { id: "hz-03", latitude: -87.9, longitude: 74, radiusDeg: 1.05 },
  { id: "hz-04", latitude: -88.4, longitude: 116, radiusDeg: 0.9 },
  { id: "hz-05", latitude: -87.8, longitude: 154, radiusDeg: 1.08 },
  { id: "hz-06", latitude: -88.2, longitude: 208, radiusDeg: 0.92 },
  { id: "hz-07", latitude: -87.7, longitude: 248, radiusDeg: 1.12 },
  { id: "hz-08", latitude: -88.6, longitude: 296, radiusDeg: 0.86 },
  { id: "hz-09", latitude: -88.1, longitude: 332, radiusDeg: 0.9 }
];

export const missionMessages = {
  idle: {
    title: "Mission Ready",
    body: "Begin with orbital ice detection. The model will rotate and the south polar region will be scanned before likely ice regions are revealed."
  },
  iceScan: {
    title: "Detecting Ice",
    body: "Hydrogen, thermal, radar, and spectral logic are being simulated to isolate likely south-polar ice regions."
  },
  iceResults: {
    title: "Ice Regions Identified",
    body: "Candidate ice-supporting regions are now visible. Proceed to landing-site analysis to find safe access points."
  },
  landingScan: {
    title: "Finding Landing Sites",
    body: "The mission is ranking outer south-polar landing shelves with stronger illumination proxies, safer stand-off from crater interiors, and clearer traverse access to retained ice targets."
  },
  landingResults: {
    title: "Landing Sites Ranked",
    body: "Five primary and two reserve operational zones are now ranked. You can keep the highest mission score or override the selection for trade studies."
  },
  landingDescent: {
    title: "Landing Sequence",
    body: "The descent module is approaching the selected site. Once touchdown is complete, the rover mission can begin."
  },
  landed: {
    title: "Landing Complete",
    body: "The lander is down. Proceed with the surface mission to traverse toward nearby ice-supporting regions."
  },
  pathReady: {
    title: "Traverse Path Created",
    body: "A Theta*-constrained rover campaign route has been generated from the selected landing site across five retained ice-supporting targets."
  },
  traverse: {
    title: "Autonomous Traverse",
    body: "The rover is following a multi-stop path from the landing site through five high-priority south-polar ice targets, deploying the hopper at each stop before returning to the lander."
  },
  hopper: {
    title: "Hopper Investigation",
    body: "The main rover has reached the target zone and deployed the hopping micro-rover for close local inspection."
  },
  complete: {
    title: "Local Ice Estimate",
    body: "Mission demonstration complete. The rover has returned to the lander after the full five-stop survey and the final accessible ice estimate is now available."
  }
};

export const telemetryByStage = {
  idle: [
    "south-polar study boundary initialized for high-latitude fusion pass",
    "orbital data stack registered: hydrogen, psr, thermal, dfsar, spectral, ohrc, dem",
    "multi-layer grid alignment and resampling pipeline standing by"
  ],
  iceScan: [
    "normalizing hydrogen enrichment support onto the common polar grid",
    "deriving psr mask and thermal survival score for volatile retention",
    "fusing dfsar cpr and dop into radar scattering support",
    "cross-checking spectral hydration support against the polar stack",
    "deriving dem slope and roughness penalties for false-positive suppression",
    "screening ohrc morphology for boulder fields, ejecta texture, and crater-wall ambiguity",
    "reviewing glb south-polar crater geometry with blender-assisted close-region inspection"
  ],
  iceResults: [
    "false-positive penalty applied to the fused south-polar evidence cube",
    `ice-indicative cells thresholded and manually curated into ${curatedCandidateCount} retained target regions`,
    "ranked probable ice-rich targets exported for landing-site analysis"
  ],
  landingScan: [
    "sampling glb south-polar shelves for contiguous landing-patch geometry and crater-rim stand-off",
    "projecting illumination, comms, and thermal proxies from exposed shoulders versus enclosed bowls",
    "measuring traverse feasibility from candidate patches to the retained high-tier ice targets",
    "applying risk penalties for choke points, hazard crowding, and constrained landing ellipses"
  ],
  landingResults: [
    "five primary and two reserve landing zones retained from the glb-assisted terrain review",
    "mission scores fused safety, illumination proxy, traverse feasibility, and reachable-ice opportunity",
    "manual landing-site override remains available for descent and science trade studies"
  ],
  landingDescent: [
    "descent corridor aligned to selected landing solution",
    "final local hazard envelope remains within simulated tolerance",
    "touchdown sequence propagating toward the selected operational zone"
  ],
  landed: [
    "surface operations nominal and rover handoff initialized",
    "target-linked traverse graph solved from the landed position",
    "hopper deployment branch standing by for close local inspection"
  ],
  pathReady: [
    "theta-star traverse path computed from the selected landing solution across the polar cost field",
    "five retained ice-supporting targets were chained into one continuous campaign route",
    "hazard exclusion zones forced route curvature around crater interiors and rough basins"
  ],
  traverse: [
    "rover route is stepping through five retained ice-indicative targets in sequence",
    "hopper deployment, local estimate capture, and rover recall are running automatically at each stop",
    "final return leg to the landing zone remains active after the last retained target is sampled"
  ],
  hopper: [
    "hopper deployed at the target perimeter for micro-terrain inspection",
    "local morphology and subsurface-accessibility checks now refining the target zone",
    "high-resolution follow-up pass active near the southern crater interior"
  ],
  complete: [
    "multi-stop south-polar rover campaign closed back at the selected landing zone",
    "accessible ice estimate published with conservative interpretation",
    "mission demonstration sequence closed with ranked science products retained"
  ]
};

export const finalEstimate = {
  detected: "Confirmed candidate ice-support signal near target",
  volume: "Estimated accessible local ice volume: 0.42-0.68 million m³",
  confidence: "Conservative mission confidence: medium-high"
};
