// SAMUDRA — Electro-Optical validation layer (Step 3, optional).
//
// EO imagery needs daylight + clear sky, unlike SAR — so it's modelled as
// an optional cross-check: a nearby-in-time optical pass is simulated,
// and only used if conditions would realistically allow it. When it is
// available, it either visually confirms the SAR detection (oil reads as
// a sheen) or doesn't — same honesty as the rest of the pipeline: this is
// a validation layer, not a second independent detector.

import { createRng, deriveSeed } from './rng';
import { generateEoRaster } from './generateEoRaster';

const EO_SATELLITES = ['Sentinel-2A', 'Sentinel-2B', 'Landsat 8', 'Landsat 9'];
const CLOUD_COVER_LIMIT = 35; // % — above this, optical is unusable
const SUN_ELEVATION_LIMIT = 8; // degrees — below this, effectively night

export function generateEoValidation({ seed, slick, lookalike, candidates = [], classification, sarAcquisitionTime }) {
  const rng = createRng(deriveSeed(seed, 'eo-validation'));

  const satellite = EO_SATELLITES[rng.randInt(0, EO_SATELLITES.length - 1)];
  const hourOffsetFromSar = rng.randFloat(-5, 5, 1); // nearest optical pass, different orbit to SAR
  const acquisitionTime = new Date(new Date(sarAcquisitionTime).getTime() + hourOffsetFromSar * 3600000).toISOString();

  // Available ~60% of the time — a deliberate demo-friendly rate, decided
  // purely from the seed (never from the real wall-clock time this is run
  // at, so it doesn't silently always fail if you happen to be testing at
  // night). When available, conditions are internally consistent (low
  // cloud + daytime); when not, exactly one real-world reason applies.
  const available = rng.rand() < 0.6;
  let cloudCoverPct;
  let sunElevationDeg;
  let reason = null;

  if (available) {
    cloudCoverPct = rng.randInt(0, CLOUD_COVER_LIMIT - 1);
    sunElevationDeg = rng.randInt(SUN_ELEVATION_LIMIT + 1, 62);
  } else if (rng.rand() < 0.5) {
    cloudCoverPct = rng.randInt(CLOUD_COVER_LIMIT, 100);
    sunElevationDeg = rng.randInt(SUN_ELEVATION_LIMIT + 1, 62);
    reason = `${cloudCoverPct}% cloud cover over scene`;
  } else {
    cloudCoverPct = rng.randInt(0, 100);
    sunElevationDeg = rng.randInt(-40, SUN_ELEVATION_LIMIT);
    reason = `Night pass — sun elevation ${sunElevationDeg}°`;
  }

  let raster = null;
  let agreement = null;
  if (available) {
    raster = generateEoRaster({ seed, slick, lookalike, candidates });
    // More likely to visually confirm when SAR itself is confident it's
    // oil — a smooth SAR signature usually does show up as a real sheen.
    agreement = rng.rand() < Math.max(0.55, classification.oil);
  }

  return {
    satellite,
    acquisitionTime,
    hourOffsetFromSar,
    cloudCoverPct,
    sunElevationDeg,
    available,
    reason,
    agreement, // true | false | null (null = not available)
    raster,
  };
}
