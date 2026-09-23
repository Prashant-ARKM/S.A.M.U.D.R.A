// SAMUDRA — SAR scene *visualization* raster
//
// generateSarScene.js already runs the (mock) detector and reports
// length/width/orientation/location numbers — but never renders anything.
// This module is purely for display: it takes the shared scene geometry
// (sceneGeometry.js) and paints the SAR "sensor" on top — exponential
// speckle noise, despeckled, with the slick/look-alike darkened and
// vessels as bright point returns.
//
// It does NOT feed back into detection — it's downstream-only, driven by
// the numbers Section3 already has (data.slick, data._sarGroundTruth,
// data.candidates), so it can't ever contradict them.

import { createRng, deriveSeed } from './rng';
import { buildSceneFrame, insideShape } from './sceneGeometry';

const GRID_SIZE = 260; // raster resolution (px) — display canvas upsamples this
const DESPECKLE_RADIUS = 2; // box-filter (multi-look) radius, px

export function generateSarRaster({ seed, slick, lookalike, candidates = [] }) {
  const frame = buildSceneFrame({ seed, slick, lookalike, candidates, gridSize: GRID_SIZE });
  const { gridSize, metersPerPx, slickShape, slickCenterEN, lookalikeShape, lookalikeCenterEN, vessels } = frame;
  const rng = createRng(deriveSeed(seed, 'sar-sensor'));

  // ── Build the raw speckle raster (single-look, still noisy) ─────────
  const SLICK_REDUCTION = 0.36;
  const LOOKALIKE_REDUCTION = 0.58;
  const raw = new Float64Array(gridSize * gridSize);
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const east = (col - gridSize / 2) * metersPerPx;
      const north = (gridSize / 2 - row) * metersPerPx;

      const speckle = -Math.log(1 - rng.rand()); // exponential, mean 1
      let value = speckle;

      if (insideShape(slickShape, east - slickCenterEN.east, north - slickCenterEN.north)) {
        value *= SLICK_REDUCTION;
      }
      if (lookalikeShape && insideShape(lookalikeShape, east - lookalikeCenterEN.east, north - lookalikeCenterEN.north)) {
        value *= LOOKALIKE_REDUCTION;
        if (rng.rand() < 0.22) value = speckle; // patchy — biogenic/wind-streak texture
      }
      raw[row * gridSize + col] = value;
    }
  }

  // ── Despeckle (multi-look box filter) ────────────────────────────────
  // Raw single-look speckle is genuinely that noisy pixel-to-pixel — real
  // SAR products are always averaged down before display, or it just
  // reads as static. Averaging over a small window is that step.
  const filtered = new Float64Array(gridSize * gridSize);
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      let sum = 0;
      let count = 0;
      for (let dy = -DESPECKLE_RADIUS; dy <= DESPECKLE_RADIUS; dy++) {
        for (let dx = -DESPECKLE_RADIUS; dx <= DESPECKLE_RADIUS; dx++) {
          const r = row + dy;
          const c = col + dx;
          if (r < 0 || c < 0 || r >= gridSize || c >= gridSize) continue;
          sum += raw[r * gridSize + c];
          count++;
        }
      }
      filtered[row * gridSize + col] = sum / count;
    }
  }

  // ── Display mapping ──────────────────────────────────────────────────
  // After averaging, values cluster much closer to their local mean (an
  // exponential(1) averaged over a ~25px window has std ≈ 0.2 instead of
  // 1), so the contrast window has to be narrow to still show anything —
  // wide open ocean around ~1.0, the slick's darkened region around ~0.36.
  const gray = new Uint8ClampedArray(gridSize * gridSize);
  const FLOOR = 0.28;
  const CEIL = 1.7;
  for (let i = 0; i < filtered.length; i++) {
    const norm = Math.min(1, Math.max(0, (filtered[i] - FLOOR) / (CEIL - FLOOR)));
    gray[i] = Math.round(255 * Math.pow(norm, 0.8));
  }

  // Stamp a bright core at each included vessel's position, on TOP of the
  // despeckled image (not before — the filter would just blur it away).
  // Real vessels are strong point/corner reflectors, the brightest thing
  // in an otherwise dim SAR ocean scene.
  for (const v of vessels) {
    const cx = Math.round(v.px.x);
    const cy = Math.round(v.px.y);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) continue;
        const brightness = dist < 1 ? 255 : 255 - dist * 55;
        gray[y * gridSize + x] = Math.max(gray[y * gridSize + x], brightness);
      }
    }
  }

  return { ...frame, gray };
}
