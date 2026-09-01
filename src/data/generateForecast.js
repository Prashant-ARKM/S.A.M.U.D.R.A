// SAMUDRA — Step 5: Forward Spill Prediction (Forecast)
//
// Flow: probable origin (Step 4) -> seed particles -> move forward through
// environmental conditions (Step 2 ocean/wind) -> predicted future slick
// movement.
//
// Mirrors generateHindcast.js's physics (current + wind "windage" drift) but
// integrates forward in time instead of backward, and is seeded at the
// Step 4 reconstructed origin rather than an independent random
// point/direction — same forcing data, same drift model, opposite time
// direction, exactly like a real forward OpenDrift/OpenOil run following a
// backward one.
//
// Interface: forecastForward({ origin, initialAreaM2, oceanSource, windSource,
// seed }) -> { ensembleTrajectories, forecastHorizonHours, uncertaintyRadiusM,
// confidence, areaGrowthRateM2PerHour }

import { createRng, deriveSeed } from './rng';

const METERS_PER_DEG_LAT = 111320;
const KT_TO_MPS = 0.514444;
const WINDAGE_FACTOR = 0.03; // same rule of thumb used for the backward hindcast
const FORECAST_HORIZON_HOURS = 48;
const PARTICLE_COUNT = 26;

function metersPerDegLon(lat) {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function parseNumber(str) {
  return parseFloat(String(str).replace(/[^\d.-]/g, ''));
}

function headingToVector(deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad), y: Math.cos(rad) };
}

export function forecastForward({ origin, initialAreaM2, oceanSource, windSource, seed }) {
  const rng = createRng(deriveSeed(seed, 'forecast'));

  const currentSpeed = parseNumber(oceanSource?.metadata?.['Current Speed']) || 0.3; // m/s
  const currentDir = parseNumber(oceanSource?.metadata?.['Current Dir.']) || 0; // deg
  const windSpeedKt = parseNumber(windSource?.metadata?.Speed) || 8; // kt
  const windDir = parseNumber(windSource?.metadata?.Direction) || 0; // deg
  const windSpeed = windSpeedKt * KT_TO_MPS; // m/s

  const lonPerM = metersPerDegLon(origin.lat);

  // Ensemble: each member's current/wind vectors are independently jittered
  // (same idea as the hindcast particle swarm) so the ensemble spread is a
  // real consequence of forcing uncertainty, not a separate invented number.
  const ensembleTrajectories = Array.from({ length: PARTICLE_COUNT }, () => {
    const speedJitter = 1 + rng.randFloat(-0.2, 0.2, 2);
    const dirJitter = rng.randFloat(-18, 18, 1);
    const windSpeedJitter = 1 + rng.randFloat(-0.25, 0.25, 2);
    const windDirJitter = rng.randFloat(-22, 22, 1);

    const cur = headingToVector(currentDir + dirJitter);
    const wnd = headingToVector(windDir + windDirJitter);
    const driftX = currentSpeed * speedJitter * cur.x + WINDAGE_FACTOR * windSpeed * windSpeedJitter * wnd.x;
    const driftY = currentSpeed * speedJitter * cur.y + WINDAGE_FACTOR * windSpeed * windSpeedJitter * wnd.y;

    return Array.from({ length: FORECAST_HORIZON_HOURS }, (_, h) => {
      const hours = h + 1;
      const dxM = driftX * hours * 3600;
      const dyM = driftY * hours * 3600;
      return {
        hour: hours,
        lat: parseFloat((origin.lat + dyM / METERS_PER_DEG_LAT).toFixed(4)),
        lon: parseFloat((origin.lon + dxM / lonPerM).toFixed(4)),
      };
    });
  });

  // Uncertainty at the forecast horizon: spread of where the ensemble ends
  // up, the same way the hindcast derives its uncertainty from particle
  // spread rather than a separate formula.
  const endpoints = ensembleTrajectories.map((t) => t[t.length - 1]);
  const meanLat = endpoints.reduce((s, e) => s + e.lat, 0) / endpoints.length;
  const meanLon = endpoints.reduce((s, e) => s + e.lon, 0) / endpoints.length;
  const rmsM =
    Math.sqrt(
      endpoints.reduce((s, e) => {
        const dyM = (e.lat - meanLat) * METERS_PER_DEG_LAT;
        const dxM = (e.lon - meanLon) * lonPerM;
        return s + dxM ** 2 + dyM ** 2;
      }, 0) / endpoints.length
    ) || 500;
  const uncertaintyRadiusM = Math.round(rmsM * 1.5);

  const nominalCur = headingToVector(currentDir);
  const nominalWnd = headingToVector(windDir);
  const driftSpeed = Math.sqrt(
    (currentSpeed * nominalCur.x + WINDAGE_FACTOR * windSpeed * nominalWnd.x) ** 2 +
      (currentSpeed * nominalCur.y + WINDAGE_FACTOR * windSpeed * nominalWnd.y) ** 2
  );
  const driftConfidenceFactor = Math.min(1, driftSpeed / 0.4);
  const spreadPenalty = Math.min(0.25, uncertaintyRadiusM / 50000);
  const confidence = parseFloat(
    Math.max(0.4, Math.min(0.92, 0.6 + driftConfidenceFactor * 0.15 - spreadPenalty)).toFixed(2)
  );

  // Oil spreads/weathers over time — a lightweight linear area-growth rate
  // anchored to the Step 3 detected slick area, not an independent guess.
  const areaGrowthRateM2PerHour = Math.round((initialAreaM2 || 400000) * 0.01); // ~1%/hour spreading

  return {
    ensembleTrajectories,
    forecastHorizonHours: FORECAST_HORIZON_HOURS,
    uncertaintyRadiusM,
    confidence,
    areaGrowthRateM2PerHour,
  };
}
