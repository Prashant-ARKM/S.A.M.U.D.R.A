// SAMUDRA — Counterfactual Spill Simulation
//
// "If THIS vessel really did release oil at its closest-approach position
// and time, would the same drift physics used in Step 4/5 actually carry
// it to the observed slick?" Reuses the exact same current+windage drift
// model as generateHindcast.js/generateForecast.js — forward instead of
// backward — starting from each ranked candidate's own AIS position,
// ending at the SAR acquisition time, and measures how close the result
// lands to the real detected slick.
//
// This is a corroboration check, not a re-scoring: it does NOT feed back
// into finalScore. A candidate can rank #1 on spatial/temporal/behavioural
// evidence and still fail this test (e.g. its own reported track doesn't
// physically explain the slick) — that contradiction is exactly the kind
// of thing worth surfacing, not hiding by averaging it into one number.
//
// Interface: simulateCounterfactuals({ rankedCandidates, observedSlick,
// acquisitionTime, oceanSource, windSource, uncertaintyRadiusM, seed })
// -> [{ imo, name, elapsedHours, predictedLocation, distanceFromObservedKm,
//       overlapScore, verdict, note }]

import { createRng, deriveSeed } from './rng';

const METERS_PER_DEG_LAT = 111320;
const KT_TO_MPS = 0.514444;
const WINDAGE_FACTOR = 0.03; // same rule-of-thumb as the hindcast/forecast modules

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

function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = ((lat1 - lat2) * METERS_PER_DEG_LAT) / 1000;
  const dLon = ((lon1 - lon2) * metersPerDegLon(lat2)) / 1000;
  return Math.sqrt(dLat ** 2 + dLon ** 2);
}

export function simulateCounterfactuals({
  rankedCandidates,
  observedSlick,
  acquisitionTime,
  oceanSource,
  windSource,
  uncertaintyRadiusM,
  seed,
}) {
  const rng = createRng(deriveSeed(seed, 'counterfactual'));

  const currentSpeed = parseNumber(oceanSource?.metadata?.['Current Speed']) || 0.3;
  const currentDir = parseNumber(oceanSource?.metadata?.['Current Dir.']) || 0;
  const windSpeedKt = parseNumber(windSource?.metadata?.Speed) || 8;
  const windDir = parseNumber(windSource?.metadata?.Direction) || 0;
  const windSpeed = windSpeedKt * KT_TO_MPS;

  const cur = headingToVector(currentDir);
  const wnd = headingToVector(windDir);
  const driftX = currentSpeed * cur.x + WINDAGE_FACTOR * windSpeed * wnd.x;
  const driftY = currentSpeed * cur.y + WINDAGE_FACTOR * windSpeed * wnd.y;

  const acquisitionMs = new Date(acquisitionTime).getTime();
  // Overlap tolerance scales with the same reconstruction uncertainty
  // already reported in Step 4 — a tighter hindcast demands a tighter
  // counterfactual match too.
  const scaleKm = Math.max(2, (uncertaintyRadiusM || 3000) / 1000);

  return rankedCandidates.map((c) => {
    const releaseMs = new Date(c.closestApproachTime).getTime();
    const elapsedHours = (acquisitionMs - releaseMs) / 3600000;

    if (elapsedHours <= 0) {
      return {
        imo: c.imo,
        name: c.name,
        elapsedHours: parseFloat(elapsedHours.toFixed(1)),
        predictedLocation: null,
        distanceFromObservedKm: null,
        overlapScore: 0,
        verdict: 'inconsistent',
        note: 'Closest AIS approach is after the SAR acquisition time — physically cannot be the release event.',
      };
    }

    const lonPerM = metersPerDegLon(c.lat);
    const dxM = driftX * elapsedHours * 3600;
    const dyM = driftY * elapsedHours * 3600;
    const jitter = 1 + rng.randFloat(-0.08, 0.08, 3); // small seeded forcing perturbation, not a fudge factor on the result

    const predictedLat = c.lat + (dyM * jitter) / METERS_PER_DEG_LAT;
    const predictedLon = c.lon + (dxM * jitter) / lonPerM;

    const distKm = distanceKm(predictedLat, predictedLon, observedSlick.lat, observedSlick.lon);
    const overlapScore = Math.max(0, Math.min(1, Math.exp(-distKm / scaleKm)));

    let verdict = 'inconsistent';
    if (overlapScore >= 0.55) verdict = 'consistent';
    else if (overlapScore >= 0.25) verdict = 'partial';

    return {
      imo: c.imo,
      name: c.name,
      elapsedHours: parseFloat(elapsedHours.toFixed(1)),
      predictedLocation: { lat: parseFloat(predictedLat.toFixed(4)), lon: parseFloat(predictedLon.toFixed(4)) },
      distanceFromObservedKm: parseFloat(distKm.toFixed(2)),
      overlapScore: parseFloat((overlapScore * 100).toFixed(1)),
      verdict, // 'consistent' | 'partial' | 'inconsistent'
      note: null,
    };
  });
}
