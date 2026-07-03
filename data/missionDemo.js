import { iceCandidates } from "./iceCandidates";

export { iceCandidates };
export const curatedCandidateCount = iceCandidates.length;

export const landingSites = [
  {
    id: "ls-01",
    name: "Ridge Access A",
    score: 92,
    illumination: "High",
    traverseRisk: "Low",
    cartesian: { x: 0.17, y: -1.235, z: 0.06 }
  },
  {
    id: "ls-02",
    name: "PSR Rim B",
    score: 88,
    illumination: "Medium",
    traverseRisk: "Medium",
    cartesian: { x: -0.11, y: -1.229, z: 0.13 }
  },
  {
    id: "ls-03",
    name: "Shadow Edge C",
    score: 83,
    illumination: "Medium",
    traverseRisk: "Low",
    cartesian: { x: 0.03, y: -1.242, z: -0.18 }
  }
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
    body: "The mission is scoring safe operational zones near the detected ice regions using illumination, traverse feasibility, and overall site safety."
  },
  landingResults: {
    title: "Landing Sites Ranked",
    body: "The highest-score site is preselected, but you can choose another candidate before committing to descent."
  },
  landingDescent: {
    title: "Landing Sequence",
    body: "The descent module is approaching the selected site. Once touchdown is complete, the rover mission can begin."
  },
  landed: {
    title: "Landing Complete",
    body: "The lander is down. Proceed with the surface mission to traverse toward nearby ice-supporting regions."
  },
  traverse: {
    title: "Rover Traverse",
    body: "The rover is following a route from the landing site toward the nearest high-priority south-polar ice target."
  },
  hopper: {
    title: "Hopper Investigation",
    body: "The main rover has reached the target zone and deployed the hopping micro-rover for close local inspection."
  },
  complete: {
    title: "Local Ice Estimate",
    body: "Mission demonstration complete. Ice detected near the target zone and a rough accessible local ice estimate is now available."
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
    "evaluating illumination stability around retained ice-target clusters",
    "solving landing-ellipse safety against slope and local roughness exposure",
    "measuring traverse feasibility from candidate landing sites to ranked targets",
    "computing reachable-ice opportunity for each operational zone"
  ],
  landingResults: [
    "candidate landing sites ranked from safety, illumination, and reachable science return",
    "highest-score operational zone preselected for descent planning",
    "manual landing-site override remains available for science trade studies"
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
  traverse: [
    "rover route constrained to the nearest ranked ice-indicative cluster",
    "traverse maintaining slope and roughness margins from dem-derived risk layers",
    "science waypoint handoff active near the retained south-polar target"
  ],
  hopper: [
    "hopper deployed at the target perimeter for micro-terrain inspection",
    "local morphology and subsurface-accessibility checks now refining the target zone",
    "high-resolution follow-up pass active near the southern crater interior"
  ],
  complete: [
    "local fusion pass complete for the selected south-polar target",
    "accessible ice estimate published with conservative interpretation",
    "mission demonstration sequence closed with ranked science products retained"
  ]
};

export const finalEstimate = {
  detected: "Confirmed candidate ice-support signal near target",
  volume: "Estimated accessible local ice volume: 0.42-0.68 million m³",
  confidence: "Conservative mission confidence: medium-high"
};
