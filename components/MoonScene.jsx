"use client";

import { ArcballControls, Html, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import * as THREE from "three";

const LATITUDES = [-60, -30, 0, 30, 60];
const MIN_CAMERA_DISTANCE = 2.15;
const MAX_CAMERA_DISTANCE = 10;
const ICE_VISIBLE_FRACTION = 0.12;
const SCAN_STAGES = new Set(["iceScan", "landingScan"]);
const ICE_VISIBLE_STAGES = new Set([
  "iceResults",
  "landingScan",
  "landingResults",
  "landingDescent",
  "landed",
  "pathReady",
  "traverse",
  "hopper",
  "complete"
]);
const LANDING_VISIBLE_STAGES = new Set([
  "landingResults"
]);
const MOON_MODEL_URL = "/moon.glb";
const MOON_MODEL_SIZE_BYTES = 53851232;

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function SceneFallback({ progress = 0, active = true }) {
  const percent = Math.min(100, Math.max(0, Number(progress.toFixed(1))));
  const statusLabel = active ? "Loading" : "Preparing";

  return (
    <Html center>
      <div className="scene-status scene-status-loading">
        <div className="scene-status-copy">
          <span className="scene-status-title">{statusLabel}</span>
          <span className="scene-status-percent">{percent.toFixed(1)}%</span>
        </div>
        <div className="scene-status-meter" aria-hidden="true">
          <span
            className="scene-status-meter-fill"
            style={{ transform: `scaleX(${percent / 100})` }}
          />
        </div>
      </div>
    </Html>
  );
}

function SceneError() {
  return (
    <Html center>
      <div className="scene-status scene-status-error">
        failed to load moon model
      </div>
    </Html>
  );
}

function LatitudeRing({ radius, latitude, color }) {
  const points = useMemo(() => {
    const lat = THREE.MathUtils.degToRad(latitude);
    const ringRadius = radius * Math.cos(lat);
    const y = radius * Math.sin(lat);
    const segments = 256;
    const result = [];

    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      result.push(
        new THREE.Vector3(
          Math.cos(angle) * ringRadius,
          y,
          Math.sin(angle) * ringRadius
        )
      );
    }

    return result;
  }, [latitude, radius]);

  return (
    <line>
      <bufferGeometry setFromPoints={points} />
      <lineBasicMaterial
        color={color}
        transparent
        opacity={latitude === 0 ? 0.85 : 0.32}
      />
    </line>
  );
}

function PoleMarkers({ points, radius }) {
  if (!points) {
    return null;
  }

  const textSize = radius * 0.04;

  return (
    <group>
      <Text
        position={points.northLabel}
        fontSize={textSize}
        color="#ff5a5a"
        outlineWidth="6%"
        outlineColor="#5c0d0d"
        anchorX="center"
        anchorY="middle"
      >
        N
      </Text>
      <Text
        position={points.southLabel}
        fontSize={textSize}
        color="#ff5a5a"
        outlineWidth="6%"
        outlineColor="#5c0d0d"
        anchorX="center"
        anchorY="middle"
      >
        S
      </Text>
    </group>
  );
}

function IceSpots({ radius, candidates }) {
  const rankedCandidates = useMemo(() => {
    const scores = candidates.map((candidate) => candidate.score ?? 0);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    return [...candidates]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((candidate, index) => {
        const score = candidate.score ?? 0;
        const normalized =
          maxScore === minScore
            ? 1
            : (score - minScore) / (maxScore - minScore);

        return {
          ...candidate,
          rank: index,
          normalized
        };
      });
  }, [candidates]);

  return (
    <group>
      {rankedCandidates.map((candidate) => {
        const markerRadius = radius * (0.0022 + candidate.normalized * 0.0016);
        const markerHeight = radius * (0.018 + candidate.normalized * 0.016);
        const surfaceLift = markerHeight * 0.002;
        const markerOffset = markerHeight * (ICE_VISIBLE_FRACTION - 0.5);
        const base = new THREE.Vector3(
          candidate.cartesian.x,
          candidate.cartesian.y,
          candidate.cartesian.z
        );
        const normal = base.clone().normalize();
        const position = base.add(normal.clone().multiplyScalar(surfaceLift));
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          normal
        );
        const color =
          candidate.score >= 0.85
            ? "#aefbff"
            : candidate.score >= 0.7
              ? "#7fe7ff"
              : "#4fc7d9";
        const opacity = 0.68 + candidate.normalized * 0.22;

        return (
          <group
            key={candidate.id}
            position={[position.x, position.y, position.z]}
            quaternion={quaternion}
          >
            <mesh position={[0, markerOffset, 0]}>
              <cylinderGeometry
                args={[markerRadius * 0.9, markerRadius, markerHeight, 20]}
              />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
            {candidate.score >= 0.85 && (
              <mesh position={[0, markerHeight * (ICE_VISIBLE_FRACTION + 0.06), 0]}>
                <sphereGeometry args={[markerRadius * 0.58, 12, 12]} />
                <meshBasicMaterial color="#d4fdff" transparent opacity={0.92} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function LandingSites({ radius, sites, selectedSiteId, stage }) {
  const spotSize = radius * 0.012;
  const spotHeight = radius * 0.018;
  const spotLift = radius * 0.026;
  const groupRefs = useRef([]);
  const visibleSites = useMemo(() => {
    if (stage === "landingResults") {
      return sites;
    }

    return sites.filter((site) => site.id === selectedSiteId);
  }, [selectedSiteId, sites, stage]);

  useFrame(({ clock }) => {
    if (stage !== "landingScan") {
      groupRefs.current.forEach((group, index) => {
        if (!group) {
          return;
        }

        const site = visibleSites[index];
        const selected = site?.id === selectedSiteId;
        const baseScale = selected ? 1.05 : 1;
        group.scale.setScalar(baseScale);
      });
      return;
    }

    const t = clock.getElapsedTime();
    groupRefs.current.forEach((group, index) => {
      if (!group) {
        return;
      }

      const site = visibleSites[index];
      const selected = site?.id === selectedSiteId;
      const phase = (site?.score ?? 0) * 0.11;
      const pulse = 1 + Math.sin(t * 2.2 + phase) * 0.14;
      const baseScale = selected ? 1.06 : 0.96;
      group.scale.setScalar(baseScale * pulse);
    });
  });

  return (
    <group>
      {visibleSites.map((site, index) => {
        const selected = site.id === selectedSiteId;
        const base = new THREE.Vector3(
          site.cartesian.x,
          site.cartesian.y,
          site.cartesian.z
        );
        const normal = base.clone().normalize();
        const position = base.add(normal.multiplyScalar(spotLift));
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          normal
        );
        const scoreWeight = site.score / 100;
        const markerScale = selected ? 1.18 : 0.9 + scoreWeight * 0.18;
        const opacity =
          stage === "landingScan"
            ? 0.34 + scoreWeight * 0.36
            : selected
              ? 0.98
              : 0.36 + scoreWeight * 0.24;
        const haloOpacity =
          stage === "landingScan"
            ? 0.06 + scoreWeight * 0.06
            : selected
              ? 0.16
              : 0.04;

        return (
          <group
            key={site.id}
            ref={(node) => {
              groupRefs.current[index] = node;
            }}
            position={[position.x, position.y, position.z]}
            quaternion={quaternion}
          >
            <mesh>
              <boxGeometry args={[spotSize * markerScale, spotHeight, spotSize * markerScale]} />
              <meshBasicMaterial
                color={selected ? "#9bff9a" : "#49d97a"}
                transparent
                opacity={opacity}
              />
            </mesh>
            {(selected || stage === "landingScan") && (
              <mesh position={[0, spotHeight * 0.08, 0]}>
                <cylinderGeometry
                  args={[spotSize * 1.65, spotSize * 1.65, spotHeight * 0.35, 24]}
                />
                <meshBasicMaterial
                  color={selected ? "#9bff9a" : "#67ec91"}
                  transparent
                  opacity={haloOpacity}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function ScanOverlay({ radius, mode }) {
  const ringRef = useRef(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) {
      return;
    }

    const t = clock.getElapsedTime();
    const sweep = Math.sin(t * 1.3) * radius * 0.95;
    ringRef.current.position.y = sweep;
    ringRef.current.rotation.z += 0.012;
    ringRef.current.material.opacity = mode === "iceScan" ? 0.34 : 0.24;
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius * 1.03, radius * 0.012, 20, 120]} />
      <meshBasicMaterial
        color={mode === "iceScan" ? "#7fe7ff" : "#ffd479"}
        transparent
        opacity={0.3}
      />
    </mesh>
  );
}

function PathOverlay({ points, dimmed = false }) {
  const { size } = useThree();
  const lineRef = useRef(null);
  const lineOpacity = dimmed ? 0.2 : 1;
  const segmentOpacity = dimmed ? 0.2 : 0.98;
  const segmentData = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);

    return points
      .slice(0, -1)
      .map((startPoint, index) => {
        const endPoint = points[index + 1];
        const delta = endPoint.clone().sub(startPoint);
        const length = delta.length();

        if (length <= 0.0001) {
          return null;
        }

        const direction = delta.clone().normalize();
        const midpoint = startPoint.clone().add(endPoint).multiplyScalar(0.5);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);

        return {
          key: `segment-${index}`,
          midpoint,
          quaternion,
          length
        };
      })
      .filter(Boolean);
  }, [points]);

  const geometry = useMemo(() => {
    const lineGeometry = new LineGeometry();
    const flat = points.flatMap((point) => [point.x, point.y, point.z]);
    lineGeometry.setPositions(flat);
    return lineGeometry;
  }, [points]);

  const material = useMemo(() => {
    const lineMaterial = new LineMaterial({
      color: "#ff7d7d",
      linewidth: 9,
      transparent: true,
      opacity: lineOpacity,
      depthTest: false,
      depthWrite: false,
      dashed: false
    });
    lineMaterial.resolution.set(size.width, size.height);
    return lineMaterial;
  }, [lineOpacity, size.height, size.width]);

  const line = useMemo(() => {
    const nextLine = new Line2(geometry, material);
    nextLine.computeLineDistances();
    nextLine.renderOrder = 12;
    return nextLine;
  }, [geometry, material]);

  useEffect(() => {
    material.resolution.set(size.width, size.height);
  }, [material, size.height, size.width]);

  useEffect(
    () => () => {
      lineRef.current = null;
      line.geometry.dispose();
      line.material.dispose();
    },
    [line]
  );

  return (
    <group renderOrder={12}>
      <primitive ref={lineRef} object={line} />
      {segmentData.map((segment) => (
        <mesh
          key={segment.key}
          position={segment.midpoint}
          quaternion={segment.quaternion}
          renderOrder={13}
        >
          <cylinderGeometry args={[0.0054, 0.0054, segment.length, 10]} />
          <meshBasicMaterial
            color="#ff8e8e"
            transparent
            opacity={segmentOpacity}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function cartesianToLatLon(point) {
  const vector = new THREE.Vector3(point.x, point.y, point.z);
  const radius = vector.length() || 1;
  const latitude = THREE.MathUtils.radToDeg(Math.asin(vector.y / radius));
  let longitude = THREE.MathUtils.radToDeg(Math.atan2(vector.z, vector.x));

  if (longitude < 0) {
    longitude += 360;
  }

  return { latitude, longitude };
}

function latLonToPolar({ latitude, longitude }) {
  const rho = 90 + latitude;
  const theta = THREE.MathUtils.degToRad(longitude);
  return {
    x: rho * Math.cos(theta),
    y: rho * Math.sin(theta)
  };
}

function polarToLatLon({ x, y }) {
  const rho = Math.hypot(x, y);
  let longitude = THREE.MathUtils.radToDeg(Math.atan2(y, x));

  if (longitude < 0) {
    longitude += 360;
  }

  return {
    latitude: -90 + rho,
    longitude
  };
}

function latLonToCartesian(latitude, longitude, radius) {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);
  const cosLat = Math.cos(lat);

  return new THREE.Vector3(
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    radius * cosLat * Math.sin(lon)
  );
}

function projectPointOntoMesh(point, meshRoot, fallbackRadius, lift = 0.003) {
  const normal = point.clone().normalize();

  if (!meshRoot) {
    return normal.multiplyScalar(fallbackRadius + lift);
  }

  const raycaster = new THREE.Raycaster();
  const forwardOrigin = normal.clone().multiplyScalar(fallbackRadius * 2.2);
  raycaster.set(forwardOrigin, normal.clone().negate());
  const forwardHits = raycaster.intersectObject(meshRoot, true);

  if (forwardHits[0]?.point) {
    return forwardHits[0].point.clone().add(normal.clone().multiplyScalar(lift));
  }

  const reverseOrigin = normal.clone().multiplyScalar(-fallbackRadius * 2.2);
  raycaster.set(reverseOrigin, normal.clone());
  const reverseHits = raycaster.intersectObject(meshRoot, true);

  if (reverseHits[0]?.point) {
    return reverseHits[0].point.clone().add(normal.clone().multiplyScalar(lift));
  }

  return normal.multiplyScalar(fallbackRadius + lift);
}

function offsetPointFromSurface(intersection, offset) {
  const point = intersection.point.clone();

  if (!intersection.face?.normal) {
    return point.add(point.clone().normalize().multiplyScalar(offset));
  }

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersection.object.matrixWorld);
  const worldNormal = intersection.face.normal.clone().applyMatrix3(normalMatrix).normalize();
  return point.add(worldNormal.multiplyScalar(offset));
}

function projectDirectionOntoSurface(direction, meshRoot, fallbackRadius, lift = 0.003) {
  const normal = direction.clone().normalize();

  if (!meshRoot) {
    return normal.multiplyScalar(fallbackRadius + lift);
  }

  const raycaster = new THREE.Raycaster();
  const origin = normal.clone().multiplyScalar(fallbackRadius * 2.2);
  raycaster.set(origin, normal.clone().negate());
  const hits = raycaster.intersectObject(meshRoot, true);

  if (hits[0]) {
    return offsetPointFromSurface(hits[0], lift);
  }

  const reverseOrigin = normal.clone().multiplyScalar(-fallbackRadius * 2.2);
  raycaster.set(reverseOrigin, normal.clone());
  const reverseHits = raycaster.intersectObject(meshRoot, true);

  if (reverseHits[0]) {
    return offsetPointFromSurface(reverseHits[0], lift);
  }

  return normal.multiplyScalar(fallbackRadius + lift);
}

function pointInsideHazard(point, hazards) {
  return hazards.some((hazard) => {
    const dx = point.x - hazard.x;
    const dy = point.y - hazard.y;
    return Math.hypot(dx, dy) < hazard.radius + 0.22;
  });
}

function pointHazardPenalty(point, hazards) {
  return hazards.reduce((penalty, hazard) => {
    const distance = Math.hypot(point.x - hazard.x, point.y - hazard.y);
    const margin = hazard.radius + 1.05;

    if (distance >= margin) {
      return penalty;
    }

    return penalty + (margin - distance) * 38;
  }, 0);
}

function buildPolarGrid(targetLatLon, hazards) {
  const target = latLonToPolar(targetLatLon);
  const worldMin = -10.5;
  const worldMax = 10.5;
  const step = 0.18;
  const gridSize = Math.round((worldMax - worldMin) / step) + 1;
  const hazardMap = hazards.map((hazard) => {
    const point = latLonToPolar(hazard);
    return {
      x: point.x,
      y: point.y,
      radius: hazard.radiusDeg
    };
  });
  const toGrid = (value) =>
    Math.max(0, Math.min(gridSize - 1, Math.round((value - worldMin) / step)));
  const toWorld = (index) => worldMin + index * step;

  return {
    target,
    worldMin,
    worldMax,
    step,
    gridSize,
    hazardMap,
    toGrid,
    toWorld
  };
}

function isPolarWorldPointBlocked(point, hazards) {
  const rho = Math.hypot(point.x, point.y);
  return rho < 0.28 || rho > 9.7 || pointInsideHazard(point, hazards);
}

function cellToWorld(cell, grid) {
  return {
    x: grid.toWorld(cell.x),
    y: grid.toWorld(cell.y)
  };
}

function cellDistance(a, b, grid) {
  const aw = cellToWorld(a, grid);
  const bw = cellToWorld(b, grid);
  return Math.hypot(aw.x - bw.x, aw.y - bw.y);
}

function segmentTraversalCost(startCell, endCell, grid) {
  const startWorld = cellToWorld(startCell, grid);
  const endWorld = cellToWorld(endCell, grid);
  const distance = Math.hypot(endWorld.x - startWorld.x, endWorld.y - startWorld.y);
  const steps = Math.max(2, Math.ceil(distance / (grid.step * 0.55)));
  let penalty = 0;

  for (let stepIndex = 0; stepIndex <= steps; stepIndex += 1) {
    const t = stepIndex / steps;
    const worldPoint = {
      x: THREE.MathUtils.lerp(startWorld.x, endWorld.x, t),
      y: THREE.MathUtils.lerp(startWorld.y, endWorld.y, t)
    };

    if (isPolarWorldPointBlocked(worldPoint, grid.hazardMap)) {
      return Infinity;
    }

    const rho = Math.hypot(worldPoint.x, worldPoint.y);
    penalty +=
      pointHazardPenalty(worldPoint, grid.hazardMap) * 0.02 +
      Math.max(0, 1.18 - rho) * 0.08 +
      Math.abs(rho - Math.hypot(grid.target.x, grid.target.y)) * 0.002;
  }

  return distance + penalty;
}

function hasLineOfSight(startCell, endCell, grid) {
  return Number.isFinite(segmentTraversalCost(startCell, endCell, grid));
}

function reconstructGridPath(cameFrom, currentKey) {
  const path = [currentKey];
  let walker = currentKey;

  while (cameFrom.has(walker)) {
    walker = cameFrom.get(walker);
    path.push(walker);
  }

  return path.reverse();
}

function solvePolarThetaStarPath(startLatLon, targetLatLon, hazards) {
  const start = latLonToPolar(startLatLon);
  const grid = buildPolarGrid(targetLatLon, hazards);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ];
  const startCell = { x: grid.toGrid(start.x), y: grid.toGrid(start.y) };
  const targetCell = { x: grid.toGrid(grid.target.x), y: grid.toGrid(grid.target.y) };
  const startKey = `${startCell.x},${startCell.y}`;
  const targetKey = `${targetCell.x},${targetCell.y}`;
  const open = new Set([startKey]);
  const cameFrom = new Map([[startKey, startKey]]);
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([
    [
      startKey,
      Math.hypot(startCell.x - targetCell.x, startCell.y - targetCell.y)
    ]
  ]);

  while (open.size) {
    let currentKey = null;
    let currentScore = Infinity;

    open.forEach((key) => {
      const score = fScore.get(key) ?? Infinity;
      if (score < currentScore) {
        currentScore = score;
        currentKey = key;
      }
    });

    if (!currentKey) {
      break;
    }

    if (currentKey === targetKey) {
      return reconstructGridPath(cameFrom, currentKey).map((key) => {
        const [x, y] = key.split(",").map(Number);
        return { x: grid.toWorld(x), y: grid.toWorld(y) };
      });
    }

    open.delete(currentKey);
    const [cx, cy] = currentKey.split(",").map(Number);
    const currentCell = { x: cx, y: cy };
    const parentKey = cameFrom.get(currentKey) ?? currentKey;
    const [px, py] = parentKey.split(",").map(Number);
    const parentCell = { x: px, y: py };

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;

      if (nx < 0 || ny < 0 || nx >= grid.gridSize || ny >= grid.gridSize) {
        continue;
      }

      const neighborCell = { x: nx, y: ny };
      const worldPoint = cellToWorld(neighborCell, grid);

      if (isPolarWorldPointBlocked(worldPoint, grid.hazardMap)) {
        continue;
      }

      const neighborKey = `${nx},${ny}`;
      let predecessorKey = currentKey;
      let tentative =
        (gScore.get(currentKey) ?? Infinity) + segmentTraversalCost(currentCell, neighborCell, grid);

      if (
        parentKey !== currentKey &&
        hasLineOfSight(parentCell, neighborCell, grid)
      ) {
        const parentTentative =
          (gScore.get(parentKey) ?? Infinity) + segmentTraversalCost(parentCell, neighborCell, grid);

        if (parentTentative < tentative) {
          tentative = parentTentative;
          predecessorKey = parentKey;
        }
      }

      if (tentative >= (gScore.get(neighborKey) ?? Infinity)) {
        continue;
      }

      cameFrom.set(neighborKey, predecessorKey);
      gScore.set(neighborKey, tentative);
      fScore.set(
        neighborKey,
        tentative + Math.hypot(nx - targetCell.x, ny - targetCell.y)
      );
      open.add(neighborKey);
    }
  }

  return null;
}

function selectCampaignTargets(selectedLandingSite, candidates, minTargets = 5) {
  const preferred = candidates.filter((candidate) => candidate.tier === "high");
  const candidatePool = preferred.length ? preferred : candidates;

  if (selectedLandingSite.campaignTargets?.length) {
    const explicitTargets = selectedLandingSite.campaignTargets
      .map((targetId) => candidatePool.find((candidate) => candidate.id === targetId))
      .filter(Boolean);

    if (explicitTargets.length) {
      return explicitTargets.slice(0, Math.max(minTargets, 1));
    }
  }

  const anchor =
    candidatePool.find((candidate) => candidate.id === selectedLandingSite.anchorTarget) ??
    candidatePool[0];
  const targetCount = Math.max(minTargets, 1);
  const signedDelta = (candidateLongitude) =>
    (candidateLongitude - selectedLandingSite.longitude + 540) % 360 - 180;
  const anchorDirection = Math.sign(signedDelta(anchor.longitude)) || -1;
  const candidateBaseScore = (candidate) =>
    (candidate.score ?? 0) * 12 -
    Math.hypot(
      candidate.cartesian.x - selectedLandingSite.cartesian.x,
      candidate.cartesian.y - selectedLandingSite.cartesian.y,
      candidate.cartesian.z - selectedLandingSite.cartesian.z
    ) *
      4;
  const directionScore = (candidate, direction) => {
    const delta = signedDelta(candidate.longitude);
    const forwardDelta = direction > 0 ? (delta + 360) % 360 : (-delta + 360) % 360;

    return {
      ...candidate,
      forwardDelta
    };
  };

  const buildSweep = (direction) =>
    [...candidatePool]
      .map((candidate) => directionScore(candidate, direction))
      .sort((a, b) => {
        const aAnchorBias = a.id === anchor.id ? -1000 : 0;
        const bAnchorBias = b.id === anchor.id ? -1000 : 0;
        return (
          aAnchorBias -
          bAnchorBias ||
          a.forwardDelta - b.forwardDelta ||
          candidateBaseScore(b) - candidateBaseScore(a)
        );
      })
      .slice(0, targetCount);

  const primarySweep = buildSweep(anchorDirection);
  const alternateSweep = buildSweep(anchorDirection * -1);
  const scoreSweep = (sweep) =>
    sweep.reduce((sum, candidate, index) => {
      const rawDelta = Math.abs(signedDelta(candidate.longitude));
      const visibilityBias = Math.max(0, 150 - rawDelta) * 0.12;
      const progressionBias = Math.max(0, 32 - index * 4);
      return sum + candidateBaseScore(candidate) + visibilityBias + progressionBias;
    }, 0);

  const chosenSweep =
    scoreSweep(alternateSweep) > scoreSweep(primarySweep) ? alternateSweep : primarySweep;

  return chosenSweep.slice(0, targetCount);
}

function buildCampaignTraversePath(startLatLon, campaignTargets, hazards, returnLatLon = null) {
  const fullPath = [];
  let current = startLatLon;

  for (const target of campaignTargets) {
    const segment =
      solvePolarThetaStarPath(
        current,
        {
          latitude: target.latitude,
          longitude: target.longitude
        },
        hazards
      ) ??
      fallbackPolarTraversePath(
        current,
        {
          latitude: target.latitude,
          longitude: target.longitude
        },
        hazards
      );

    if (!segment?.length) {
      continue;
    }

    if (!fullPath.length) {
      fullPath.push(...segment);
    } else {
      fullPath.push(...segment.slice(1));
    }

    current = {
      latitude: target.latitude,
      longitude: target.longitude
    };
  }

  if (returnLatLon) {
    const returnSegment =
      solvePolarThetaStarPath(current, returnLatLon, hazards) ??
      fallbackPolarTraversePath(current, returnLatLon, hazards);

    if (returnSegment?.length) {
      if (!fullPath.length) {
        fullPath.push(...returnSegment);
      } else {
        fullPath.push(...returnSegment.slice(1));
      }
    }
  }

  return fullPath.length ? fullPath : null;
}

function fallbackPolarTraversePath(startLatLon, targetLatLon, hazards) {
  const start = latLonToPolar(startLatLon);
  const target = latLonToPolar(targetLatLon);
  const hazardMap = hazards.map((hazard) => {
    const point = latLonToPolar(hazard);
    return {
      x: point.x,
      y: point.y,
      radius: hazard.radiusDeg
    };
  });
  const points = [start];
  const segment = target.clone ? target.clone() : { ...target };
  const direction = {
    x: segment.x - start.x,
    y: segment.y - start.y
  };
  const directionLength = Math.hypot(direction.x, direction.y) || 1;
  const unit = {
    x: direction.x / directionLength,
    y: direction.y / directionLength
  };
  const normal = { x: -unit.y, y: unit.x };
  const detours = [];

  hazardMap.forEach((hazard) => {
    const toHazard = { x: hazard.x - start.x, y: hazard.y - start.y };
    const along = toHazard.x * unit.x + toHazard.y * unit.y;

    if (along <= 0 || along >= directionLength) {
      return;
    }

    const closest = {
      x: start.x + unit.x * along,
      y: start.y + unit.y * along
    };
    const distance = Math.hypot(hazard.x - closest.x, hazard.y - closest.y);
    const safeRadius = hazard.radius + 0.7;

    if (distance >= safeRadius) {
      return;
    }

    const side = (hazard.x * normal.x + hazard.y * normal.y) > 0 ? -1 : 1;
    detours.push({
      along,
      point: {
        x: hazard.x + normal.x * safeRadius * side,
        y: hazard.y + normal.y * safeRadius * side
      }
    });
  });

  detours
    .sort((a, b) => a.along - b.along)
    .forEach((detour) => {
      points.push(detour.point);
    });

  points.push(target);
  return points;
}

function smoothSurfaceRoute(path, surfaceRadius) {
  if (!path?.length) {
    return null;
  }

  const anchors = path.map((node) => {
    const latLon = polarToLatLon(node);
    return latLonToCartesian(latLon.latitude, latLon.longitude, surfaceRadius * 1.002);
  });

  const result = [];

  anchors.forEach((anchor, index) => {
    if (index === anchors.length - 1) {
      result.push(anchor.clone());
      return;
    }

    const start = anchor.clone().normalize();
    const end = anchors[index + 1].clone().normalize();
    const angle = start.angleTo(end);
    const steps = Math.max(6, Math.ceil(angle / 0.018));

    for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
      const t = stepIndex / steps;
      const point = start.clone().lerp(end, t).normalize();
      result.push(point.multiplyScalar(surfaceRadius * 1.002));
    }
  });

  return result;
}

function MissionActors({
  stage,
  routePoints,
  landingPoint,
  campaignStopPoints,
  surfaceRadius,
  onTraverseComplete
}) {
  const landerRef = useRef(null);
  const roverRef = useRef(null);
  const hopperRef = useRef(null);
  const stageStartRef = useRef({});
  const tempVectorRef = useRef(new THREE.Vector3());
  const curve = useMemo(() => {
    if (!routePoints?.length) {
      return null;
    }

    return new THREE.CatmullRomCurve3(routePoints.map((point) => point.clone()));
  }, [routePoints]);
  const traverseDone = useRef(false);
  const missionTimeline = useMemo(() => {
    if (!routePoints?.length || !campaignStopPoints?.length) {
      return null;
    }

    const cumulativeDistances = [0];
    for (let index = 1; index < routePoints.length; index += 1) {
      cumulativeDistances[index] =
        cumulativeDistances[index - 1] + routePoints[index].distanceTo(routePoints[index - 1]);
    }

    const routeLength = cumulativeDistances[cumulativeDistances.length - 1] || 1;
    let searchStartIndex = 0;
    const stopSamples = campaignStopPoints.map((targetPoint) => {
      let bestIndex = searchStartIndex;
      let bestDistance = Infinity;

      for (let index = searchStartIndex; index < routePoints.length; index += 1) {
        const distance = routePoints[index].distanceToSquared(targetPoint);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }

      searchStartIndex = bestIndex;
      return {
        routeIndex: bestIndex,
        t: cumulativeDistances[bestIndex] / routeLength
      };
    });

    const moveSpeed = 0.18;
    const initialHold = 0.55;
    const deployDelay = 0.45;
    const deployDuration = 0.9;
    const sampleDuration = 1.15;
    const recoverDuration = 0.8;
    const finalHold = 1.2;
    let elapsed = initialHold;

    const stopPhases = stopSamples.map((stop, index) => {
      const startT = index === 0 ? 0 : stopSamples[index - 1].t;
      const travelDelta = Math.max(0.0001, stop.t - startT);
      const travelDuration = Math.max(1.15, (travelDelta * routeLength) / moveSpeed);
      const stopPhase = {
        index,
        startT,
        endT: stop.t,
        travelStart: elapsed,
        travelEnd: elapsed + travelDuration,
        deployStart: elapsed + travelDuration + deployDelay,
        deployEnd: elapsed + travelDuration + deployDelay + deployDuration,
        sampleEnd:
          elapsed + travelDuration + deployDelay + deployDuration + sampleDuration,
        recoverEnd:
          elapsed +
          travelDuration +
          deployDelay +
          deployDuration +
          sampleDuration +
          recoverDuration
      };
      elapsed = stopPhase.recoverEnd;
      return stopPhase;
    });

    const lastStopT = stopSamples[stopSamples.length - 1]?.t ?? 0;
    const returnDelta = Math.max(0.0001, 1 - lastStopT);
    const returnDuration = Math.max(1.4, (returnDelta * routeLength) / (moveSpeed * 1.08));
    const returnPhase = {
      startT: lastStopT,
      endT: 1,
      travelStart: elapsed,
      travelEnd: elapsed + returnDuration,
      finalHoldEnd: elapsed + returnDuration + finalHold
    };

    return {
      initialHold,
      totalDuration: returnPhase.finalHoldEnd,
      stopPhases,
      returnPhase
    };
  }, [campaignStopPoints, routePoints]);

  useEffect(() => {
    delete stageStartRef.current[stage];
  }, [stage]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (stageStartRef.current[stage] === undefined) {
      stageStartRef.current[stage] = elapsed;
    }
    const stageElapsed = elapsed - stageStartRef.current[stage];

    if (stage === "landingDescent" && landerRef.current && landingPoint) {
      const end = new THREE.Vector3(...landingPoint);
      const normal = end.clone().normalize();
      const tangentSeed = Math.abs(normal.y) > 0.92
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
      const tangent = tangentSeed.clone().cross(normal).normalize();
      const start = end
        .clone()
        .add(normal.clone().multiplyScalar(surfaceRadius * 0.54))
        .add(tangent.multiplyScalar(surfaceRadius * 0.1));
      const t = Math.min(stageElapsed / 3.4, 1);
      const arc = new THREE.Vector3().lerpVectors(start, end, t);
      arc.add(normal.clone().multiplyScalar((1 - t) * surfaceRadius * 0.04));
      landerRef.current.position.copy(arc);
    }

    if ((stage === "traverse" || stage === "hopper" || stage === "complete") && roverRef.current && curve) {
      let cycle = 1;
      let activeStopPhase = null;

      if (stage === "traverse" && missionTimeline) {
        const clampedElapsed = Math.min(stageElapsed, missionTimeline.totalDuration);

        if (clampedElapsed <= missionTimeline.initialHold) {
          cycle = 0;
        } else {
          activeStopPhase =
            missionTimeline.stopPhases.find((segment) => clampedElapsed <= segment.recoverEnd) ??
            null;

          if (activeStopPhase) {
            if (clampedElapsed <= activeStopPhase.travelEnd) {
              const segmentProgress = THREE.MathUtils.clamp(
                (clampedElapsed - activeStopPhase.travelStart) /
                  Math.max(0.0001, activeStopPhase.travelEnd - activeStopPhase.travelStart),
                0,
                1
              );
              cycle = THREE.MathUtils.lerp(
                activeStopPhase.startT,
                activeStopPhase.endT,
                segmentProgress
              );
            } else {
              cycle = activeStopPhase.endT;
            }
          } else {
            const returnPhase = missionTimeline.returnPhase;
            const segmentProgress = THREE.MathUtils.clamp(
              (clampedElapsed - returnPhase.travelStart) /
                Math.max(0.0001, returnPhase.travelEnd - returnPhase.travelStart),
              0,
              1
            );
            cycle = THREE.MathUtils.lerp(
              returnPhase.startT,
              returnPhase.endT,
              segmentProgress
            );
          }
        }
      }

      const point = curve.getPointAt(cycle);
      const surfaceNormal = point.clone().normalize();
      const roverLift = 0.022;
      roverRef.current.position.copy(
        point.clone().add(surfaceNormal.clone().multiplyScalar(roverLift))
      );

      const tangent = curve
        .getTangentAt(Math.min(cycle + 0.002, 1))
        .projectOnPlane(surfaceNormal)
        .normalize();
      if (tangent.lengthSq() < 1e-6) {
        tangent.copy(
          tempVectorRef.current
            .set(1, 0, 0)
            .projectOnPlane(surfaceNormal)
            .normalize()
        );
      }
      const right = new THREE.Vector3().crossVectors(surfaceNormal, tangent).normalize();
      const correctedUp = new THREE.Vector3().crossVectors(tangent, right).normalize();
      const basis = new THREE.Matrix4().makeBasis(tangent, correctedUp, right);
      roverRef.current.quaternion.setFromRotationMatrix(basis);

      if (
        stage === "traverse" &&
        missionTimeline &&
        stageElapsed >= missionTimeline.totalDuration &&
        !traverseDone.current
      ) {
        traverseDone.current = true;
        onTraverseComplete?.();
      }

      if (hopperRef.current) {
        if (
          stage === "traverse" &&
          activeStopPhase &&
          stageElapsed >= activeStopPhase.deployStart &&
          stageElapsed <= activeStopPhase.recoverEnd
        ) {
          const stopPoint = campaignStopPoints[activeStopPhase.index]?.clone();
          if (stopPoint) {
            const stopNormal = stopPoint.clone().normalize();
            const roverDock = point.clone().add(surfaceNormal.clone().multiplyScalar(roverLift + 0.008));
            const hoverBase = stopPoint.clone().add(stopNormal.clone().multiplyScalar(0.036));
            let hopperPoint = hoverBase.clone();

            if (stageElapsed <= activeStopPhase.deployEnd) {
              const t = THREE.MathUtils.clamp(
                (stageElapsed - activeStopPhase.deployStart) /
                  Math.max(0.0001, activeStopPhase.deployEnd - activeStopPhase.deployStart),
                0,
                1
              );
              hopperPoint = roverDock.clone().lerp(hoverBase, t);
            } else if (stageElapsed <= activeStopPhase.sampleEnd) {
              hopperPoint = hoverBase.clone().add(
                stopNormal.multiplyScalar(Math.sin((stageElapsed - activeStopPhase.deployEnd) * 5.2) * 0.006)
              );
            } else {
              const t = THREE.MathUtils.clamp(
                (stageElapsed - activeStopPhase.sampleEnd) /
                  Math.max(0.0001, activeStopPhase.recoverEnd - activeStopPhase.sampleEnd),
                0,
                1
              );
              hopperPoint = hoverBase.clone().lerp(roverDock, t);
            }

            hopperRef.current.visible = true;
            hopperRef.current.position.copy(hopperPoint);
          } else {
            hopperRef.current.visible = false;
          }
        } else {
          hopperRef.current.visible = false;
        }
      }
    }

    if (stage !== "traverse") {
      traverseDone.current = false;
    }
  });

  return (
    <group>
      {stage === "landingDescent" && (
        <mesh ref={landerRef} renderOrder={20}>
          <sphereGeometry args={[0.018, 14, 14]} />
          <meshStandardMaterial
            color="#f6eee3"
            emissive="#d2b37b"
            emissiveIntensity={0.3}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {(stage === "landed" ||
        stage === "pathReady" ||
        stage === "traverse" ||
        stage === "hopper" ||
        stage === "complete") &&
        landingPoint && (
          <mesh position={landingPoint} renderOrder={18}>
            <sphereGeometry args={[0.015, 14, 14]} />
            <meshStandardMaterial
              color="#f6eee3"
              emissive="#d2b37b"
              emissiveIntensity={0.24}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        )}

      {(stage === "pathReady" ||
        stage === "traverse" ||
        stage === "hopper" ||
        stage === "complete") &&
        routePoints?.length > 1 && (
        <>
          <PathOverlay
            points={routePoints}
            dimmed={stage === "traverse" || stage === "hopper" || stage === "complete"}
          />
          {(stage === "traverse" || stage === "hopper" || stage === "complete") && (
            <mesh ref={roverRef} renderOrder={24}>
              <boxGeometry args={[0.036, 0.012, 0.018]} />
              <meshStandardMaterial
                color="#ff7c7c"
                emissive="#e45151"
                emissiveIntensity={0.34}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          )}
        </>
      )}

      {stage === "traverse" && (
        <mesh ref={hopperRef} renderOrder={25}>
          <sphereGeometry args={[0.011, 12, 12]} />
          <meshStandardMaterial
            color="#86f2a6"
            emissive="#5edd82"
            emissiveIntensity={0.34}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      )}

    </group>
  );
}

function MoonModel({
  stage,
  selectedLandingSite,
  landingSites,
  iceCandidates,
  traverseHazards,
  onTraverseComplete
}) {
  const [gltfScene, setGltfScene] = useState(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadActive, setLoadActive] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const modelScene = useMemo(() => (gltfScene ? gltfScene.clone() : null), [gltfScene]);
  const rootRef = useRef(null);
  const [bounds, setBounds] = useState({ radius: 1 });
  const [polePoints, setPolePoints] = useState(null);
  const [surfaceReady, setSurfaceReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    const abortController = new AbortController();

    setLoadActive(true);
    setLoadError(null);
    setLoadProgress(0);

    const loadModel = async () => {
      try {
        const response = await fetch(MOON_MODEL_URL, {
          signal: abortController.signal,
          cache: "force-cache"
        });

        if (!response.ok || !response.body) {
          throw new Error(`failed to fetch glb: ${response.status}`);
        }

        const contentLength =
          Number(response.headers.get("content-length")) || MOON_MODEL_SIZE_BYTES;
        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = 0;

        while (!cancelled) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (!value) {
            continue;
          }

          chunks.push(value);
          receivedLength += value.length;

          setLoadProgress(
            Math.min(100, (receivedLength / Math.max(contentLength, 1)) * 100)
          );
        }

        if (cancelled) {
          return;
        }

        const glbBytes = new Uint8Array(receivedLength);
        let offset = 0;

        chunks.forEach((chunk) => {
          glbBytes.set(chunk, offset);
          offset += chunk.length;
        });

        setLoadActive(false);

        loader.parse(
          glbBytes.buffer,
          "",
          (gltf) => {
            if (cancelled) {
              return;
            }

            setGltfScene(gltf.scene);
            setLoadProgress(100);
          },
          () => {
            if (cancelled) {
              return;
            }

            setLoadError(true);
          }
        );
      } catch (error) {
        if (cancelled || error?.name === "AbortError") {
          return;
        }

        setLoadError(true);
        setLoadActive(false);
      }
    };

    loadModel();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, []);

  useLayoutEffect(() => {
    setSurfaceReady(false);

    if (!rootRef.current || !modelScene) {
      return;
    }

    const box = new THREE.Box3().setFromObject(rootRef.current);
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    rootRef.current.position.set(-sphere.center.x, -sphere.center.y, -sphere.center.z);
    rootRef.current.updateWorldMatrix(true, true);

    const raycaster = new THREE.Raycaster();
    const findPolePoint = (direction) => {
      const origin = direction.clone().multiplyScalar(sphere.radius * 2);
      raycaster.set(origin, direction.clone().negate());
      const hits = raycaster.intersectObject(rootRef.current, true);
      return hits[0]?.point ?? direction.clone().multiplyScalar(sphere.radius);
    };

    const north = findPolePoint(new THREE.Vector3(0, 1, 0));
    const south = findPolePoint(new THREE.Vector3(0, -1, 0));
    const labelOffset = sphere.radius * 0.018;

    setPolePoints({
      north: north.toArray(),
      south: south.toArray(),
      northLabel: north.clone().add(new THREE.Vector3(0, labelOffset, 0)).toArray(),
      southLabel: south.clone().add(new THREE.Vector3(0, -labelOffset, 0)).toArray()
    });

    setBounds({ radius: sphere.radius });
    setSurfaceReady(true);
  }, [modelScene]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("moon-glb-cached", "1");
  }, []);
  const campaignTargets = useMemo(() => {
    if (!selectedLandingSite || !iceCandidates?.length) {
      return [];
    }

    return selectCampaignTargets(selectedLandingSite, iceCandidates, 5);
  }, [iceCandidates, selectedLandingSite]);

  const routePoints = useMemo(() => {
    const shouldBuildRoute =
      stage === "pathReady" ||
      stage === "traverse" ||
      stage === "hopper" ||
      stage === "complete";

    if (
      !shouldBuildRoute ||
      !selectedLandingSite ||
      !iceCandidates?.length ||
      !bounds.radius ||
      !surfaceReady ||
      !rootRef.current
    ) {
      return null;
    }

    const start = selectedLandingSite.cartesian;
    const startLatLon = cartesianToLatLon(start);
    const campaignPath = buildCampaignTraversePath(
      startLatLon,
      campaignTargets,
      traverseHazards,
      startLatLon
    );

    return campaignPath
      ? smoothSurfaceRoute(campaignPath, bounds.radius)?.map((point) =>
          projectDirectionOntoSurface(point, rootRef.current, bounds.radius, 0.018)
        )
      : null;
  }, [bounds.radius, campaignTargets, selectedLandingSite, stage, surfaceReady, traverseHazards]);
  const campaignStopPoints = useMemo(() => {
    const shouldBuildStops =
      stage === "pathReady" ||
      stage === "traverse" ||
      stage === "hopper" ||
      stage === "complete";

    if (
      !shouldBuildStops ||
      !selectedLandingSite ||
      !iceCandidates?.length ||
      !bounds.radius ||
      !surfaceReady ||
      !rootRef.current
    ) {
      return null;
    }

    return campaignTargets.map((target) =>
      projectPointOntoMesh(
        new THREE.Vector3(target.cartesian.x, target.cartesian.y, target.cartesian.z),
        rootRef.current,
        bounds.radius,
        0.024
      )
    );
  }, [bounds.radius, campaignTargets, iceCandidates, selectedLandingSite, stage, surfaceReady]);

  const projectedLandingSites = useMemo(() => {
    if (!bounds.radius || !surfaceReady || !rootRef.current) {
      return landingSites;
    }

    return landingSites.map((site) => {
      const projected = projectPointOntoMesh(
        new THREE.Vector3(site.cartesian.x, site.cartesian.y, site.cartesian.z),
        rootRef.current,
        bounds.radius,
        0.0038
      );

      return {
        ...site,
        cartesian: {
          x: projected.x,
          y: projected.y,
          z: projected.z
        }
      };
    });
  }, [bounds.radius, landingSites, surfaceReady]);

  const projectedSelectedLandingSite =
    projectedLandingSites.find((site) => site.id === selectedLandingSite.id) ??
    selectedLandingSite;

  if (loadError) {
    return <SceneError />;
  }

  if (!modelScene) {
    return <SceneFallback progress={loadProgress} active={loadActive} />;
  }

  return (
    <group>
      <primitive ref={rootRef} object={modelScene} />
      <group>
        {LATITUDES.map((latitude) => (
          <LatitudeRing
            key={latitude}
            radius={bounds.radius * 1.01}
            latitude={latitude}
            color={latitude === 0 ? "#ffd479" : "#7dc6ff"}
          />
        ))}
        {SCAN_STAGES.has(stage) && <ScanOverlay radius={bounds.radius} mode={stage} />}
        {ICE_VISIBLE_STAGES.has(stage) && (
          <IceSpots radius={bounds.radius * 1.01} candidates={iceCandidates} />
        )}
        {LANDING_VISIBLE_STAGES.has(stage) && (
          <LandingSites
            radius={bounds.radius * 1.01}
            sites={projectedLandingSites}
            selectedSiteId={projectedSelectedLandingSite.id}
            stage={stage}
          />
        )}
        <PoleMarkers points={polePoints} radius={bounds.radius * 1.01} />
        <MissionActors
          stage={stage}
          landingPoint={[
            projectedSelectedLandingSite.cartesian.x,
            projectedSelectedLandingSite.cartesian.y,
            projectedSelectedLandingSite.cartesian.z
          ]}
          routePoints={routePoints}
          campaignStopPoints={campaignStopPoints}
          surfaceRadius={bounds.radius}
          onTraverseComplete={onTraverseComplete}
        />
      </group>
    </group>
  );
}

export default function MoonScene({
  stage,
  selectedLandingSite,
  landingSites,
  iceCandidates,
  traverseHazards,
  onTraverseComplete
}) {
  return (
    <div className="canvas-wrap">
      <Canvas
        camera={{ position: [0, 0, 4.1], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#01030a"]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[5, 0.9, 0]} intensity={1.15} color="#efe2b8" />
        <directionalLight position={[-4, -2, -3]} intensity={0.08} color="#5f7fb0" />
        <SceneErrorBoundary fallback={<SceneError />}>
          <MoonModel
            stage={stage}
            selectedLandingSite={selectedLandingSite}
            landingSites={landingSites}
            iceCandidates={iceCandidates}
            traverseHazards={traverseHazards}
            onTraverseComplete={onTraverseComplete}
          />
        </SceneErrorBoundary>
        <ArcballControls
          enablePan={false}
          minDistance={MIN_CAMERA_DISTANCE}
          maxDistance={MAX_CAMERA_DISTANCE}
          rotateSpeed={0.9}
        />
      </Canvas>
      <div className="viewer-hud">
        <div className="hud-chip">Drag: rotate</div>
      </div>
    </div>
  );
}
