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
const DESKTOP_FINDING_LIFETIME_MS = 6000;
const MOBILE_FINDING_LIFETIME_MS = 2000;

export default function Home() {
  const defaultLanding = useMemo(
    () => [...landingSites].sort((a, b) => b.score - a.score)[0],
    []
  );
  const [stage, setStage] = useState(STAGES.IDLE);
  const [sceneReady, setSceneReady] = useState(false);
  const [routeBuildState, setRouteBuildState] = useState("idle");
  const [routeBuildProgress, setRouteBuildProgress] = useState(0);
  const [selectedLandingSiteId, setSelectedLandingSiteId] = useState(defaultLanding.id);
  const [visibleTelemetryCount, setVisibleTelemetryCount] = useState(1);
  const [typedCharCount, setTypedCharCount] = useState(0);
  const [findingBirths, setFindingBirths] = useState({});
  const [findingClock, setFindingClock] = useState(Date.now());
  const showLandingSelectionWindow = stage === STAGES.LANDING_RESULTS;
  const showSelectedSitePanel =
    stage === STAGES.LANDING_DESCENT ||
    stage === STAGES.LANDED ||
    stage === STAGES.PATH_READY ||
    stage === STAGES.TRAVERSE ||
    stage === STAGES.HOPPER ||
    stage === STAGES.COMPLETE;
  const showLandingOptionsPanel = false;
  const hasUpperPanels = showSelectedSitePanel || showLandingOptionsPanel;
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

  useEffect(() => {
    if (!findings.length) {
      return undefined;
    }

    const now = Date.now();
    setFindingBirths((current) => {
      let changed = false;
      const next = { ...current };

      findings.forEach((finding) => {
        if (!next[finding.id]) {
          next[finding.id] = now;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [findings]);

  useEffect(() => {
    if (!Object.keys(findingBirths).length) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setFindingClock(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, [findingBirths]);

  const visibleFindings = useMemo(() => {
    const lifetimeMs =
      typeof window !== "undefined" && window.innerWidth <= 720
        ? MOBILE_FINDING_LIFETIME_MS
        : DESKTOP_FINDING_LIFETIME_MS;

    return findings.filter((finding) => {
      const birth = findingBirths[finding.id];
      if (!birth) {
        return false;
      }

      return findingClock - birth < lifetimeMs;
    });
  }, [findingBirths, findingClock, findings]);

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

      {showLandingSelectionWindow && (
        <section className="selection-stage-overlay">
          <div className="selection-stage-dimmer selection-stage-dimmer-left" />

          <div className="selection-window-grid">
            <div className="selection-window-column selection-window-column-left">
              <div className="panel-block panel-block-scroll selection-window-sites">
                <p className="panel-kicker">Landing Site Options</p>
                <div className="panel-block-scroll-body">
                  <div className="site-list selection-site-list">
                    {landingSites.map((site, index) => (
                      <button
                        key={site.id}
                        className={`site-card ${
                          selectedLandingSiteId === site.id ? "selected" : ""
                        }`}
                        onClick={() => setSelectedLandingSiteId(site.id)}
                      >
                        <div className="site-card-head">
                          <strong>{`Site ${String.fromCharCode(65 + index)}`}</strong>
                          <span>{site.score}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="selection-window-preview" aria-hidden="true" />

            <div className="selection-window-column selection-window-column-right">
              <div className="selection-window-side">
                <div className="panel-block panel-block-scroll selection-window-details">
                  <p className="panel-kicker">Selected Landing Site</p>
                  <div className="panel-block-scroll-body">
                    <div className="site-card-head site-card-head-static">
                      <strong>{selectedLandingSite.name}</strong>
                      <span>{selectedLandingSite.score}</span>
                    </div>
                    <p className="site-summary-line">
                      {selectedLandingSite.classification} zone · anchor {selectedLandingSite.anchorTarget}
                    </p>
                    <p className="site-summary-line">
                      Safety {selectedLandingSite.factorPercents.safety}% · Ellipse {selectedLandingSite.factorPercents.ellipse}%
                    </p>
                    <p className="site-summary-line">
                      Illumination {selectedLandingSite.factorPercents.illumination}% · Traverse {selectedLandingSite.factorPercents.traverse}%
                    </p>
                    <p className="site-summary-line">
                      Reachable ice {selectedLandingSite.factorPercents.reachable}% · Risk penalty {selectedLandingSite.factorPercents.riskPenalty}%
                    </p>
                    <p className="site-note">{selectedLandingSite.geomorphology}</p>
                  </div>
                </div>

                <div className="panel-block selection-window-action">
                  <div className="action-stack">
                    <button
                      className="action-button primary"
                      onClick={() => setStage(STAGES.LANDING_DESCENT)}
                    >
                      Land Here
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="selection-stage-dimmer selection-stage-dimmer-right" />
        </section>
      )}

      <section
        className={`mission-panel mission-panel-bottom-left ${
          showSelectedSitePanel
              ? "mission-panel-bottom-left-details-only"
              : "mission-panel-bottom-left-compact"
        }`}
      >
        <div className="left-panel-upper">
          {showSelectedSitePanel && (
            <div className="panel-block panel-block-scroll panel-block-details">
              <p className="panel-kicker">Selected Landing Site</p>
              <div className="panel-block-scroll-body">
                <div className="site-card-head site-card-head-static">
                  <strong>{selectedLandingSite.name}</strong>
                  <span>{selectedLandingSite.score}</span>
                </div>
                {stage === STAGES.LANDING_RESULTS ? (
                  <>
                    <p className="site-summary-line">
                      {selectedLandingSite.classification} zone · anchor {selectedLandingSite.anchorTarget}
                    </p>
                    <p className="site-summary-line">
                      Safety {selectedLandingSite.factorPercents.safety}% · Ellipse {selectedLandingSite.factorPercents.ellipse}%
                    </p>
                    <p className="site-summary-line">
                      Illumination {selectedLandingSite.factorPercents.illumination}% · Traverse {selectedLandingSite.factorPercents.traverse}%
                    </p>
                    <p className="site-summary-line">
                      Reachable ice {selectedLandingSite.factorPercents.reachable}% · Risk penalty {selectedLandingSite.factorPercents.riskPenalty}%
                    </p>
                    <p className="site-note">{selectedLandingSite.geomorphology}</p>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="panel-block panel-block-mission">
          <p className="panel-kicker">Mission Control</p>
          <div className="action-stack">
            {(stage === STAGES.IDLE || stage === STAGES.ICE_SCAN) && (
              <button
                className="action-button primary"
                onClick={() => setStage(STAGES.ICE_SCAN)}
                disabled={stage === STAGES.ICE_SCAN || !sceneReady}
              >
                {stage === STAGES.ICE_SCAN ? "Detecting" : "Detect Ice"}
              </button>
            )}

            {(stage === STAGES.ICE_RESULTS || stage === STAGES.LANDING_SCAN) && (
              <button
                className="action-button primary"
                onClick={() => setStage(STAGES.LANDING_SCAN)}
                disabled={stage === STAGES.LANDING_SCAN}
              >
                {stage === STAGES.LANDING_SCAN ? "Finding" : "Find Landing Sites"}
              </button>
            )}

            {stage === STAGES.LANDING_RESULTS && (
              <button className="action-button primary" disabled>
                Selecting
              </button>
            )}

            {stage === STAGES.LANDING_DESCENT && (
              <button className="action-button primary" disabled>
                Landing
              </button>
            )}

            {(stage === STAGES.LANDED || stage === STAGES.PATH_READY) && (
              <button
                className="action-button primary"
                onClick={() => setStage(STAGES.PATH_READY)}
                disabled={stage === STAGES.PATH_READY || routeBuildState !== "ready"}
              >
                {stage === STAGES.PATH_READY || routeBuildState === "building"
                  ? `Preparing ${Math.round(routeBuildProgress)}%`
                  : "Create Rover Path"}
              </button>
            )}

            {(stage === STAGES.PATH_READY || stage === STAGES.TRAVERSE || stage === STAGES.HOPPER) && (
              <button
                className="action-button primary"
                onClick={() => setStage(STAGES.TRAVERSE)}
                disabled={stage !== STAGES.PATH_READY || routeBuildState !== "ready"}
              >
                {stage === STAGES.TRAVERSE || stage === STAGES.HOPPER
                  ? "Traversing"
                  : "Start Autonomous Traverse"}
              </button>
            )}
          </div>
        </div>
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

      {visibleFindings.length > 0 && (
        <section className="mission-panel mission-panel-bottom-right">
          <div className="findings-stack">
            {visibleFindings.map((finding) => (
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
      )}

      <section className="viewer-stage">
        <MoonScene
          stage={stage}
          selectedLandingSite={selectedLandingSite}
          landingSites={landingSites}
          iceCandidates={iceCandidates}
          traverseHazards={traverseHazards}
          onTraverseComplete={() => setStage(STAGES.COMPLETE)}
          onSceneReady={setSceneReady}
          onRouteBuildStateChange={setRouteBuildState}
          onRouteBuildProgressChange={setRouteBuildProgress}
        />
      </section>
    </main>
  );
}
