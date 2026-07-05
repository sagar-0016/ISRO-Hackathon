"use client";

import { useEffect, useMemo, useState } from "react";
import MoonScene from "../components/MoonScene";
import {
  curatedCandidateCount,
  finalEstimate,
  iceCandidates,
  landingSites,
  missionMessages,
  telemetryByStage,
  traverseHazards
} from "../data/missionDemo";

const STAGES = {
  IDLE: "idle",
  ICE_SCAN: "iceScan",
  ICE_RESULTS: "iceResults",
  LANDING_SCAN: "landingScan",
  LANDING_RESULTS: "landingResults",
  LANDING_DESCENT: "landingDescent",
  LANDED: "landed",
  PATH_READY: "pathReady",
  TRAVERSE: "traverse",
  HOPPER: "hopper",
  COMPLETE: "complete"
};
const STAGE_ORDER = Object.values(STAGES);
const STAGE_DURATIONS_MS = {
  idle: 1800,
  iceScan: 4200,
  iceResults: 1200,
  landingScan: 3800,
  landingResults: 1200,
  landingDescent: 3400,
  landed: 1200,
  pathReady: 1200,
  traverse: 16000,
  hopper: 1800,
  complete: 1200
};
const TELEMETRY_LINE_GAP_CHARS = 4;

export default function Home() {
  const defaultLanding = useMemo(
    () => [...landingSites].sort((a, b) => b.score - a.score)[0],
    []
  );
  const [stage, setStage] = useState(STAGES.IDLE);
  const [selectedLandingSiteId, setSelectedLandingSiteId] = useState(defaultLanding.id);
  const [visibleTelemetryCount, setVisibleTelemetryCount] = useState(1);
  const [typedCharCount, setTypedCharCount] = useState(0);
  const selectedLandingSite =
    landingSites.find((site) => site.id === selectedLandingSiteId) ?? defaultLanding;

  useEffect(() => {
    if (stage === STAGES.ICE_SCAN) {
      const timer = window.setTimeout(() => setStage(STAGES.ICE_RESULTS), 4200);
      return () => window.clearTimeout(timer);
    }

    if (stage === STAGES.LANDING_SCAN) {
      const timer = window.setTimeout(() => setStage(STAGES.LANDING_RESULTS), 3800);
      return () => window.clearTimeout(timer);
    }

    if (stage === STAGES.LANDING_DESCENT) {
      const timer = window.setTimeout(() => setStage(STAGES.LANDED), 3400);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [stage]);

  const currentMessage = missionMessages[stage];
  const currentStageIndex = STAGE_ORDER.indexOf(stage);
  const currentStageTelemetry = telemetryByStage[stage] ?? [];

  const findings = useMemo(() => {
    const entries = [];
    const hasReached = (targetStage) =>
      currentStageIndex >= STAGE_ORDER.indexOf(targetStage);

    if (hasReached(STAGES.ICE_RESULTS)) {
      entries.push({
        id: "finding-ice",
        label: "Ice",
        marker: "ice",
        title: `${curatedCandidateCount} south-polar target zones retained`,
        detail: "ranked south-polar target regions are now available for landing-site analysis."
      });
    }

    if (hasReached(STAGES.LANDING_RESULTS)) {
      entries.push({
        id: "finding-landing-rank",
        label: "Landing",
        marker: "landing",
        title: "5 primary and 2 reserve landing zones retained",
        detail:
          "Mission scoring fused GLB-derived terrain safety, landing-patch continuity, route feasibility, and conservative illumination and thermal proxies."
      });
    }

    if (hasReached(STAGES.LANDING_DESCENT)) {
      entries.push({
        id: "finding-landing-site",
        label: "Selected",
        marker: "selected",
        title: `${selectedLandingSite.name} committed for descent`,
        detail: `Score ${selectedLandingSite.score}. ${selectedLandingSite.classification} zone anchored to ${selectedLandingSite.anchorTarget}, with ${selectedLandingSite.traverseRisk.toLowerCase()} traverse risk and ${selectedLandingSite.reachableIce.toLowerCase()} reachable ice.`
      });
    }

    if (hasReached(STAGES.PATH_READY)) {
      entries.push({
        id: "finding-traverse",
        label: "Traverse",
        marker: "traverse",
        title: "Rover campaign route locked across 5 ice targets",
        detail:
          "The surface path now chains five retained south-polar science targets and uses Theta*-style pruning through the polar hazard cost field."
      });
    }

    if (hasReached(STAGES.HOPPER)) {
      entries.push({
        id: "finding-hopper",
        label: "Hopper",
        marker: "hopper",
        title: "Micro-rover deployed for local inspection",
        detail:
          "Close-range terrain inspection and local subsurface-accessibility checks are now active near the target perimeter."
      });
    }

    if (hasReached(STAGES.COMPLETE)) {
      entries.push({
        id: "finding-final",
        label: "Estimate",
        marker: "estimate",
        title: finalEstimate.detected,
        detail: `${finalEstimate.volume}. ${finalEstimate.confidence}.`
      });
    }

    return entries;
  }, [currentStageIndex, selectedLandingSite]);

  useEffect(() => {
    setVisibleTelemetryCount(1);
    setTypedCharCount(0);
  }, [stage]);

  const lineRevealDelays = useMemo(() => {
    const lines = currentStageTelemetry;
    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
    const totalGapChars = Math.max(0, lines.length - 1) * TELEMETRY_LINE_GAP_CHARS;
    const durationMs = STAGE_DURATIONS_MS[stage] ?? 1200;
    const msPerChar = durationMs / Math.max(1, totalChars + totalGapChars);
    let elapsedChars = 0;

    return lines.map((line) => {
      const charCount = line.length;
      const delayMs = elapsedChars * msPerChar;
      elapsedChars += charCount + TELEMETRY_LINE_GAP_CHARS;
      return delayMs;
    });
  }, [currentStageTelemetry, stage]);

  useEffect(() => {
    if (visibleTelemetryCount >= currentStageTelemetry.length) {
      return undefined;
    }

    const nextDelay = lineRevealDelays[visibleTelemetryCount] ?? 0;
    const currentDelay = lineRevealDelays[visibleTelemetryCount - 1] ?? 0;
    const waitMs = Math.max(120, nextDelay - currentDelay);
    const timer = window.setTimeout(() => {
      setVisibleTelemetryCount((count) =>
        Math.min(count + 1, currentStageTelemetry.length)
      );
    }, waitMs);

    return () => window.clearTimeout(timer);
  }, [currentStageTelemetry.length, lineRevealDelays, visibleTelemetryCount]);

  useEffect(() => {
    const currentLine = currentStageTelemetry[visibleTelemetryCount - 1] ?? "";
    if (!currentLine) {
      return undefined;
    }

    setTypedCharCount(0);
    const totalChars = currentStageTelemetry.reduce((sum, line) => sum + line.length, 0);
    const totalGapChars =
      Math.max(0, currentStageTelemetry.length - 1) * TELEMETRY_LINE_GAP_CHARS;
    const durationMs = STAGE_DURATIONS_MS[stage] ?? 1200;
    const msPerChar = durationMs / Math.max(1, totalChars + totalGapChars);
    const charIntervalMs = Math.max(14, msPerChar);

    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      setTypedCharCount(count);
      if (count >= currentLine.length) {
        window.clearInterval(timer);
      }
    }, charIntervalMs);

    return () => window.clearInterval(timer);
  }, [currentStageTelemetry, stage, visibleTelemetryCount]);

  const telemetryDisplay = useMemo(() => {
    const lines = currentStageTelemetry.slice(0, visibleTelemetryCount);

    return lines.map((line, index) => {
      const isTyping = index === lines.length - 1;
      const visibleLine = isTyping ? line.slice(0, typedCharCount) : line;

      return {
        id: `${stage}-${index}`,
        line: visibleLine,
        isTyping
      };
    });
  }, [currentStageTelemetry, stage, typedCharCount, visibleTelemetryCount]);

  return (
    <main className="mission-shell">
      <section className="mission-panel mission-panel-top-left">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Mission</p>
            <h1>Chandrayaan 4.0</h1>
          </div>
        </div>
      </section>

      <section className="mission-panel mission-panel-bottom-left">
        <div className="panel-block">
          <p className="panel-kicker">Mission Control</p>
          <div className="action-stack">
            {(stage === STAGES.IDLE || stage === STAGES.ICE_RESULTS) && (
              <button
                className="action-button primary"
                onClick={() => setStage(STAGES.ICE_SCAN)}
                disabled={stage === STAGES.ICE_SCAN}
              >
                Detect Ice
              </button>
            )}

            {stage === STAGES.ICE_RESULTS && (
              <button
                className="action-button primary"
                onClick={() => setStage(STAGES.LANDING_SCAN)}
              >
                Find Landing Sites
              </button>
            )}

            {stage === STAGES.LANDING_RESULTS && (
              <button
                className="action-button primary"
                onClick={() => setStage(STAGES.LANDING_DESCENT)}
              >
                Land At Selected Site
              </button>
            )}

            {stage === STAGES.LANDED && (
              <button
                className="action-button primary"
                onClick={() => setStage(STAGES.PATH_READY)}
              >
                Create Rover Path
              </button>
            )}

            {stage === STAGES.PATH_READY && (
              <button
                className="action-button primary"
                onClick={() => setStage(STAGES.TRAVERSE)}
              >
                Start Autonomous Traverse
              </button>
            )}
          </div>
        </div>

        {(stage === STAGES.LANDING_RESULTS ||
          stage === STAGES.LANDING_DESCENT ||
          stage === STAGES.LANDED ||
          stage === STAGES.PATH_READY ||
          stage === STAGES.TRAVERSE ||
          stage === STAGES.HOPPER ||
          stage === STAGES.COMPLETE) && (
          <div className="panel-block">
            <p className="panel-kicker">Landing Site Options</p>
            <div className="site-list">
              {landingSites.map((site) => (
                <button
                  key={site.id}
                  className={`site-card ${
                    selectedLandingSiteId === site.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedLandingSiteId(site.id)}
                  disabled={stage !== STAGES.LANDING_RESULTS}
                >
                  <div className="site-card-head">
                    <strong>{site.name}</strong>
                    <span>{site.score}</span>
                  </div>
                  <p>{site.classification} zone · anchor {site.anchorTarget}</p>
                  <p>
                    Safety {site.factorPercents.safety}% · Ellipse {site.factorPercents.ellipse}%
                  </p>
                  <p>
                    Illumination {site.factorPercents.illumination}% · Traverse {site.factorPercents.traverse}%
                  </p>
                  <p>
                    Reachable ice {site.factorPercents.reachable}% · Risk penalty {site.factorPercents.riskPenalty}%
                  </p>
                  <p className="site-note">{site.geomorphology}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mission-panel mission-panel-bottom-center">
        <div className="mission-console">
          <div className="telemetry-list">
            {telemetryDisplay.map((entry) => (
              <div
                key={entry.id}
                className={`telemetry-line ${entry.isTyping ? "is-typing" : ""}`}
              >
                <span className="telemetry-dot" />
                <span className="telemetry-text">
                  <span className="telemetry-line-copy">{entry.line}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mission-panel mission-panel-bottom-right">
        <div className="findings-stack">
          {findings.map((finding) => (
            <div key={finding.id} className="panel-block finding-card">
              <div className="finding-head">
                {finding.marker && (
                  <span
                    className={`finding-legend finding-legend-${finding.marker}`}
                    aria-label={`${finding.marker} marker`}
                    title={`${finding.marker} marker`}
                  />
                )}
                <p className="panel-kicker">{finding.label}</p>
              </div>
              <strong className="finding-title">{finding.title}</strong>
              <p className="finding-detail">{finding.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="viewer-stage">
        <MoonScene
          stage={stage}
          selectedLandingSite={selectedLandingSite}
          landingSites={landingSites}
          iceCandidates={iceCandidates}
          traverseHazards={traverseHazards}
          onTraverseComplete={() => setStage(STAGES.COMPLETE)}
        />
      </section>
    </main>
  );
}
