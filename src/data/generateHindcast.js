// SAMUDRA — Step 4: Backward Spill Reconstruction (Hindcast)
//
// Flow: observed slick -> work backwards through environmental conditions
// (ocean current + wind, from Step 2) -> probable origin + release window.
//
// This is a lightweight stand-in for what a real OpenDrift/OpenOil backward
// run would do: take the surface drift velocity (current + a wind "windage"
// fraction, the standard way wind affects floating oil) and integrate it
// backward in time from the detected slick position to estimate where and
// when the release happened, with uncertainty growing over the hindcast
// duration.
//
// Interface: reconstructOrigin({ slickLocation, acquisitionTime, oilConfidence,
// oceanSource, windSource, seed }) -> { origin, releaseTimeWindow,
// backwardPath, particles, uncertaintyRadiusM, confidence }
// particles is a small ensemble of independently-jittered backward paths
// (same physics, perturbed forcing) whose spread IS the uncertainty area —
// this is what a real particle-tracking hindcast (OpenDrift/OpenOil) does.
// Kept isolated so a real OpenDrift integration could replace it later
// without changing generateIncident.js's call site or any component.

import { createRng, deriveSeed } from './rng';

const METERS_PER_DEG_LAT = 111320;
const KT_TO_MPS = 0.514444;
const WINDAGE_FACTOR = 0.03; // ~3% of wind speed added to drift, standard rule of thumb for oil

function metersPerDegLon(lat) {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

// "12.3 kt" / "0.83 m/s" -> 12.3 / 0.83
function parseNumber(str) {
  return parseFloat(String(str).replace(/[^\d.-]/g, ''));
}

// heading (deg, clockwise from N, "flowing/blowing toward") -> {x: east, y: north} unit components
function headingToVector(deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad), y: Math.cos(rad) };
}

export function reconstructOrigin({ slickLocation, acquisitionTime, oilConfidence, oceanSource, windSource, seed }) {
  const rng = createRng(deriveSeed(seed, 'hindcast'));

  const currentSpeed = parseNumber(oceanSource?.metadata?.['Current Speed']) || 0.3; // m/s
  const currentDir = parseNumber(oceanSource?.metadata?.['Current Dir.']) || 0; // deg
  const windSpeedKt = parseNumber(windSource?.metadata?.Speed) || 8; // kt
  const windDir = parseNumber(windSource?.metadata?.Direction) || 0; // deg
  const windSpeed = windSpeedKt * KT_TO_MPS; // m/s

  const cur = headingToVector(currentDir);
  const wnd = headingToVector(windDir);
  // Net surface drift velocity (m/s): current + windage fraction of wind.
  const driftX = currentSpeed * cur.x + WINDAGE_FACTOR * windSpeed * wnd.x;
  const driftY = currentSpeed * cur.y + WINDAGE_FACTOR * windSpeed * wnd.y;
  const driftSpeed = Math.sqrt(driftX ** 2 + driftY ** 2);

  // How long ago the release plausibly happened — real hindcasts run back
  // until the drift no longer explains the observed slick footprint; here
  // that's approximated as a plausible 8–36h window, seeded from the
  // incident so it's reproducible rather than an unrelated random draw.
  const elapsedHours = rng.randInt(8, 36);

  const lonPerM = metersPerDegLon(slickLocation.lat);
  const STEPS = 8;
  const PARTICLE_COUNT = 18;

  // Particle ensemble: each particle gets its own small perturbation of the
  // current/wind vectors and release timing (representing the same kind of
  // forcing uncertainty a real OpenDrift ensemble run explores), then is
  // integrated backward the same way the single path above was. The spread
  // of where these particles end up IS the uncertainty area/origin — not a
  // separately-invented number.
  const particles = Array.from({ length: PARTICLE_COUNT }, () => {
    const speedJitter = 1 + rng.randFloat(-0.25, 0.25, 2);
    const dirJitter = rng.randFloat(-20, 20, 1);
    const windSpeedJitter = 1 + rng.randFloat(-0.3, 0.3, 2);
    const windDirJitter = rng.randFloat(-25, 25, 1);
    const hoursJitter = rng.randInt(-6, 6);

    const pCur = headingToVector(currentDir + dirJitter);
    const pWnd = headingToVector(windDir + windDirJitter);
    const pDriftX = currentSpeed * speedJitter * pCur.x + WINDAGE_FACTOR * windSpeed * windSpeedJitter * pWnd.x;
    const pDriftY = currentSpeed * speedJitter * pCur.y + WINDAGE_FACTOR * windSpeed * windSpeedJitter * pWnd.y;
    const pElapsedHours = Math.max(4, elapsedHours + hoursJitter);
    const pDxM = -pDriftX * pElapsedHours * 3600; // backward: undo the forward drift
    const pDyM = -pDriftY * pElapsedHours * 3600;

    const path = Array.from({ length: STEPS + 1 }, (_, i) => {
      const frac = i / STEPS;
      return {
        hoursAgo: Math.round(frac * pElapsedHours),
        lat: parseFloat((slickLocation.lat + frac * pDyM / METERS_PER_DEG_LAT).toFixed(4)),
        lon: parseFloat((slickLocation.lon + frac * pDxM / lonPerM).toFixed(4)),
      };
    });
    return { path };
  });

  // Origin + uncertainty are derived straight from the particle cloud's
  // final (most-backward) positions, same as a real particle-tracking model
  // would report a probable-source centroid and spread.
  const endpoints = particles.map((p) => p.path[p.path.length - 1]);
  const originLat = parseFloat((endpoints.reduce((s, e) => s + e.lat, 0) / endpoints.length).toFixed(4));
  const originLon = parseFloat((endpoints.reduce((s, e) => s + e.lon, 0) / endpoints.length).toFixed(4));
  const rmsM =
    Math.sqrt(
      endpoints.reduce((s, e) => {
        const dyMe = (e.lat - originLat) * METERS_PER_DEG_LAT;
        const dxMe = (e.lon - originLon) * lonPerM;
        return s + dxMe ** 2 + dyMe ** 2;
      }, 0) / endpoints.length
    ) || 800;
  const uncertaintyRadiusM = Math.round(rmsM * 1.6);

  // The single "mean" backward path (kept for a simple reference line).
  const backwardPath = Array.from({ length: STEPS + 1 }, (_, i) => {
    const frac = i / STEPS;
    return {
      hoursAgo: Math.round(frac * elapsedHours),
      lat: parseFloat((slickLocation.lat + frac * (originLat - slickLocation.lat)).toFixed(4)),
      lon: parseFloat((slickLocation.lon + frac * (originLon - slickLocation.lon)).toFixed(4)),
    };
  });

  // Release time window: centered on the estimated release instant, with a
  // spread reflecting timing uncertainty (wider the longer the hindcast ran).
  const releaseCenter = new Date(new Date(acquisitionTime).getTime() - elapsedHours * 3600000);
  const spreadHours = Math.max(2, Math.round(elapsedHours * 0.25));
  const releaseTimeWindow = {
    start: new Date(releaseCenter.getTime() - spreadHours * 3600000).toISOString(),
    end: new Date(releaseCenter.getTime() + spreadHours * 3600000).toISOString(),
  };

  // Reconstruction confidence: higher when the Step 3 detection itself was
  // confident, and when the particle cloud converged tightly (low spread).
  const driftConfidenceFactor = Math.min(1, driftSpeed / 0.4);
  const spreadPenalty = Math.min(0.2, uncertaintyRadiusM / 40000);
  const confidence = parseFloat(
    Math.max(0.35, Math.min(0.95, 0.5 + 0.35 * oilConfidence + driftConfidenceFactor * 0.1 - spreadPenalty)).toFixed(2)
  );

  return {
    origin: { lat: originLat, lon: originLon },
    releaseTimeWindow,
    backwardPath,
    particles,
    uncertaintyRadiusM,
    confidence,
  };
}
