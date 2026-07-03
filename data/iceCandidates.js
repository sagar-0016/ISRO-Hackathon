const MOON_RADIUS = 1.2719;

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

function withCartesian(candidate) {
  return {
    ...candidate,
    cartesian: toCartesian(candidate.latitude, candidate.longitude)
  };
}

export const iceCandidates = [
  { id: "spi-001", latitude: -89.3, longitude: 6, score: 0.94, tier: "high" },
  { id: "spi-002", latitude: -88.9, longitude: 28, score: 0.91, tier: "high" },
  { id: "spi-003", latitude: -88.5, longitude: 54, score: 0.93, tier: "high" },
  { id: "spi-004", latitude: -88.2, longitude: 82, score: 0.89, tier: "high" },
  { id: "spi-005", latitude: -88.8, longitude: 118, score: 0.87, tier: "high" },
  { id: "spi-006", latitude: -88.1, longitude: 146, score: 0.84, tier: "high" },
  { id: "spi-007", latitude: -87.8, longitude: 176, score: 0.86, tier: "high" },
  { id: "spi-008", latitude: -88.4, longitude: 212, score: 0.88, tier: "high" },
  { id: "spi-009", latitude: -88.0, longitude: 244, score: 0.85, tier: "high" },
  { id: "spi-010", latitude: -88.6, longitude: 278, score: 0.9, tier: "high" },
  { id: "spi-011", latitude: -88.9, longitude: 314, score: 0.92, tier: "high" },
  { id: "spi-012", latitude: -87.9, longitude: 338, score: 0.83, tier: "high" },
  { id: "spi-013", latitude: -86.5, longitude: 22, score: 0.78, tier: "medium" },
  { id: "spi-014", latitude: -86.2, longitude: 64, score: 0.75, tier: "medium" },
  { id: "spi-015", latitude: -86.8, longitude: 108, score: 0.81, tier: "medium" },
  { id: "spi-016", latitude: -86.1, longitude: 152, score: 0.74, tier: "medium" },
  { id: "spi-017", latitude: -86.7, longitude: 198, score: 0.76, tier: "medium" },
  { id: "spi-018", latitude: -86.0, longitude: 236, score: 0.72, tier: "medium" },
  { id: "spi-019", latitude: -86.4, longitude: 286, score: 0.77, tier: "medium" },
  { id: "spi-020", latitude: -86.9, longitude: 328, score: 0.79, tier: "medium" },
  { id: "spi-021", latitude: -84.9, longitude: 42, score: 0.63, tier: "low" },
  { id: "spi-022", latitude: -84.4, longitude: 126, score: 0.58, tier: "low" },
  { id: "spi-023", latitude: -84.8, longitude: 210, score: 0.61, tier: "low" },
  { id: "spi-024", latitude: -84.3, longitude: 302, score: 0.56, tier: "low" },
  { id: "spi-025", latitude: -82.7, longitude: 92, score: 0.47, tier: "low" },
  { id: "spi-026", latitude: -82.5, longitude: 268, score: 0.44, tier: "low" }
].map(withCartesian);
