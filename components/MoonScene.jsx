"use client";

import { ArcballControls, Html, Text, useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Component, Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const LATITUDES = [-60, -30, 0, 30, 60];
const MIN_CAMERA_DISTANCE = 2.15;
const MAX_CAMERA_DISTANCE = 10;
const SCAN_STAGES = new Set(["iceScan", "landingScan"]);
const ICE_VISIBLE_STAGES = new Set([
  "iceResults",
  "landingScan",
  "landingResults",
  "landingDescent",
  "landed",
  "traverse",
  "hopper",
  "complete"
]);
const LANDING_VISIBLE_STAGES = new Set([
  "landingResults",
  "landingDescent",
  "landed",
  "traverse",
  "hopper",
  "complete"
]);

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

function SceneFallback() {
  const { progress, active } = useProgress();
  const label = active ? `loading moon model ${Math.round(progress)}%` : "initializing scene";

  return (
    <Html center>
      <div className="scene-status scene-status-loading">{label}</div>
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
        const surfaceLift = markerHeight * 0.42;
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
            <mesh>
              <cylinderGeometry
                args={[markerRadius * 0.9, markerRadius, markerHeight, 20]}
              />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
            {candidate.score >= 0.85 && (
              <mesh position={[0, markerHeight * 0.44, 0]}>
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

function LandingSites({ radius, sites, selectedSiteId }) {
  const spotRadius = radius * 0.011;
  const spotLift = radius * 0.022;

  return (
    <group>
      {sites.map((site) => {
        const selected = site.id === selectedSiteId;
        const base = new THREE.Vector3(
          site.cartesian.x,
          site.cartesian.y,
          site.cartesian.z
        );
        const normal = base.clone().normalize();
        const position = base.add(normal.multiplyScalar(spotLift));

        return (
          <group key={site.id} position={[position.x, position.y, position.z]}>
            <mesh>
              <sphereGeometry args={[spotRadius, 18, 18]} />
              <meshBasicMaterial
                color={selected ? "#9bff9a" : "#49d97a"}
                transparent
                opacity={selected ? 0.95 : 0.7}
              />
            </mesh>
            {selected && (
              <mesh>
                <sphereGeometry args={[spotRadius * 1.6, 20, 20]} />
                <meshBasicMaterial color="#8bffb0" transparent opacity={0.12} />
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

function PathLine({ points }) {
  const vectors = useMemo(
    () => points.map((point) => new THREE.Vector3(point[0], point[1], point[2])),
    [points]
  );

  return (
    <line>
      <bufferGeometry setFromPoints={vectors} />
      <lineBasicMaterial color="#9ae88f" transparent opacity={0.92} />
    </line>
  );
}

function MissionActors({ stage, routePoints, landingPoint, onTraverseComplete }) {
  const landerRef = useRef(null);
  const roverRef = useRef(null);
  const hopperRef = useRef(null);
  const curve = useMemo(() => {
    if (!routePoints?.length) {
      return null;
    }

    return new THREE.CatmullRomCurve3(
      routePoints.map((point) => new THREE.Vector3(point[0], point[1], point[2]))
    );
  }, [routePoints]);
  const traverseDone = useRef(false);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    if (stage === "landingDescent" && landerRef.current && landingPoint) {
      const start = new THREE.Vector3(landingPoint[0], landingPoint[1] + 0.8, landingPoint[2]);
      const end = new THREE.Vector3(...landingPoint);
      const t = Math.min((elapsed % 3.4) / 3.4, 1);
      landerRef.current.position.lerpVectors(start, end, t);
    }

    if ((stage === "traverse" || stage === "hopper" || stage === "complete") && roverRef.current && curve) {
      const cycle = Math.min((elapsed % 11) / 11, 1);
      const point = curve.getPointAt(cycle);
      roverRef.current.position.copy(point);

      if (stage === "traverse" && cycle >= 0.995 && !traverseDone.current) {
        traverseDone.current = true;
        onTraverseComplete?.();
      }
    }

    if ((stage === "hopper" || stage === "complete") && hopperRef.current && routePoints?.length) {
      const anchor = new THREE.Vector3(...routePoints[routePoints.length - 1]);
      hopperRef.current.position.set(
        anchor.x + 0.03,
        anchor.y + 0.02 + Math.abs(Math.sin(elapsed * 2.8)) * 0.03,
        anchor.z - 0.02
      );
    }

    if (stage !== "traverse") {
      traverseDone.current = false;
    }
  });

  return (
    <group>
      {stage === "landingDescent" && (
        <mesh ref={landerRef}>
          <sphereGeometry args={[0.045, 18, 18]} />
          <meshStandardMaterial color="#f6eee3" emissive="#d2b37b" emissiveIntensity={0.3} />
        </mesh>
      )}

      {(stage === "landed" || stage === "traverse" || stage === "hopper" || stage === "complete") &&
        landingPoint && (
          <mesh position={landingPoint}>
            <sphereGeometry args={[0.04, 18, 18]} />
            <meshStandardMaterial color="#f6eee3" emissive="#d2b37b" emissiveIntensity={0.24} />
          </mesh>
        )}

      {(stage === "traverse" || stage === "hopper" || stage === "complete") && routePoints?.length > 1 && (
        <>
          <PathLine points={routePoints} />
          <mesh ref={roverRef}>
            <sphereGeometry args={[0.028, 16, 16]} />
            <meshStandardMaterial color="#9ae88f" emissive="#67d86f" emissiveIntensity={0.35} />
          </mesh>
        </>
      )}

      {(stage === "hopper" || stage === "complete") && (
        <mesh ref={hopperRef}>
          <sphereGeometry args={[0.017, 14, 14]} />
          <meshStandardMaterial color="#ffb56c" emissive="#ff9c52" emissiveIntensity={0.32} />
        </mesh>
      )}
    </group>
  );
}

function MoonModel({ stage, selectedLandingSite, landingSites, iceCandidates, onTraverseComplete }) {
  const { scene } = useGLTF("/moon.glb");
  const rootRef = useRef(null);
  const [bounds, setBounds] = useState({ radius: 1 });
  const [polePoints, setPolePoints] = useState(null);

  useLayoutEffect(() => {
    if (!rootRef.current) {
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
  }, [scene]);

  const routePoints = useMemo(() => {
    if (!selectedLandingSite || !iceCandidates?.length) {
      return null;
    }

    const start = selectedLandingSite.cartesian;
    const target = iceCandidates[0].cartesian;
    const midOne = [
      start.x * 0.78 + target.x * 0.22,
      start.y * 0.86 + target.y * 0.14 + 0.012,
      start.z * 0.78 + target.z * 0.22
    ];
    const midTwo = [
      start.x * 0.42 + target.x * 0.58,
      start.y * 0.68 + target.y * 0.32 + 0.016,
      start.z * 0.42 + target.z * 0.58
    ];

    return [
      [start.x, start.y, start.z],
      midOne,
      midTwo,
      [target.x, target.y, target.z]
    ];
  }, [iceCandidates, selectedLandingSite]);

  return (
    <group>
      <primitive ref={rootRef} object={scene.clone()} />
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
            sites={landingSites}
            selectedSiteId={selectedLandingSite.id}
          />
        )}
        <PoleMarkers points={polePoints} radius={bounds.radius * 1.01} />
        <MissionActors
          stage={stage}
          landingPoint={[
            selectedLandingSite.cartesian.x,
            selectedLandingSite.cartesian.y,
            selectedLandingSite.cartesian.z
          ]}
          routePoints={routePoints}
          onTraverseComplete={onTraverseComplete}
        />
      </group>
    </group>
  );
}

useGLTF.preload("/moon.glb");

export default function MoonScene({
  stage,
  selectedLandingSite,
  landingSites,
  iceCandidates,
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
          <Suspense fallback={<SceneFallback />}>
            <MoonModel
              stage={stage}
              selectedLandingSite={selectedLandingSite}
              landingSites={landingSites}
              iceCandidates={iceCandidates}
              onTraverseComplete={onTraverseComplete}
            />
          </Suspense>
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
