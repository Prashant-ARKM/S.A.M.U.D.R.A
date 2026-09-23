// SAMUDRA — Slick Age Estimation
//
// Real spill responders use the Bonn Agreement Oil Appearance Code — a
// standard colour/sheen scale (silvery sheen -> rainbow -> metallic ->
// dark true-colour) — to visually estimate oil film thickness. Combined
// with the observed area, that gives an estimated volume; combined with a
// Fay-style spreading relation (thinner films imply more elapsed
// spreading/weathering time), that gives an estimated spill age.
//
// This is a deliberately bounded simplification of Fay's full multi-regime
// spreading law (gravity-inertia / gravity-viscous / surface-tension-
// viscous) — enough to give a realistic hour-scale age per appearance
// code without the raw cubic-root physics blowing up for very thin films,
// same spirit as this codebase's other simplified physical stand-ins
// (windage fraction, linear area-growth rate).
//
// Deliberately independent of Step 4 (drift-based release-time window) —
// the point is to cross-check two unrelated methods, not derive one from
// the other.
//
// Interface: estimateSpillAge({ seed, slick, releaseTimeWindow,
// acquisitionTime }) -> { appearanceCode, appearanceLabel,
// thicknessRangeMm, thicknessUsedMm, estimatedVolumeM3, ageHours,
// ageRangeHours, weatheringStage, hindcastAgeHours, agreesWithHindcast }

import { createRng, deriveSeed } from './rng';

const APPEARANCE_CODES = [
  { code: 1, label: 'Sheen (Silvery)', thicknessRangeMm: [0.00004, 0.0003], spreadConstant: 25000 },
  { code: 2, label: 'Rainbow', thicknessRangeMm: [0.0003, 0.005], spreadConstant: 45000 },
  { code: 3, label: 'Metallic', thicknessRangeMm: [0.005, 0.05], spreadConstant: 75000 },
  { code: 4, label: 'Discontinuous True Colour', thicknessRangeMm: [0.05, 0.2], spreadConstant: 120000 },
  { code: 5, label: 'Continuous True Colour', thicknessRangeMm: [0.2, 1.0], spreadConstant: 180000 },
  { code: 6, label: 'Dark / Black-Brown', thicknessRangeMm: [1.0, 3.0], spreadConstant: 260000 },
];
const APPEARANCE_WEIGHTS = [0.12, 0.22, 0.26, 0.22, 0.12, 0.06]; // mid codes (2–4) most typical of a SAR-flagged slick

function weatheringStage(ageHours) {
  if (ageHours < 6) return 'Fresh';
  if (ageHours < 24) return 'Recent';
  if (ageHours < 72) return 'Weathered';
  return 'Heavily Weathered';
}

export function estimateSpillAge({ seed, slick, releaseTimeWindow, acquisitionTime }) {
  const rng = createRng(deriveSeed(seed, 'spill-age'));

  const roll = rng.rand();
  let cum = 0;
  let picked = APPEARANCE_CODES[2];
  for (let i = 0; i < APPEARANCE_CODES.length; i++) {
    cum += APPEARANCE_WEIGHTS[i];
    if (roll <= cum) {
      picked = APPEARANCE_CODES[i];
      break;
    }
  }

  const jitter = 1 + rng.randFloat(-0.15, 0.15, 3);
  const spreadConstant = picked.spreadConstant * jitter;

  const areaM2 = slick.area;
  const ageHours = Math.max(2, areaM2 / spreadConstant);
  const ageRangeHours = [Math.max(1, ageHours * 0.78), ageHours * 1.3];

  const thicknessUsedMm = picked.thicknessRangeMm[0] + rng.rand() * (picked.thicknessRangeMm[1] - picked.thicknessRangeMm[0]);
  const estimatedVolumeM3 = areaM2 * (thicknessUsedMm / 1000);

  // Cross-check against Step 4's independently drift-derived release
  // window — do a thinning-based method and a current/wind-drift-based
  // method land on roughly the same timing?
  const releaseCenterMs = (new Date(releaseTimeWindow.start).getTime() + new Date(releaseTimeWindow.end).getTime()) / 2;
  const hindcastAgeHours = (new Date(acquisitionTime).getTime() - releaseCenterMs) / 3600000;
  const agreesWithHindcast = hindcastAgeHours >= ageRangeHours[0] * 0.6 && hindcastAgeHours <= ageRangeHours[1] * 1.6;

  return {
    appearanceCode: picked.code,
    appearanceLabel: picked.label,
    thicknessRangeMm: picked.thicknessRangeMm,
    thicknessUsedMm: parseFloat(thicknessUsedMm.toFixed(5)),
    estimatedVolumeM3: parseFloat(estimatedVolumeM3.toFixed(2)),
    ageHours: parseFloat(ageHours.toFixed(1)),
    ageRangeHours: [parseFloat(ageRangeHours[0].toFixed(1)), parseFloat(ageRangeHours[1].toFixed(1))],
    weatheringStage: weatheringStage(ageHours),
    hindcastAgeHours: parseFloat(hindcastAgeHours.toFixed(1)),
    agreesWithHindcast,
  };
}
