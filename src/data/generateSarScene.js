// SAMUDRA — Step 1: Synthetic SAR Scene + Detection
//
// Previously, slick dimensions and oil/look-alike classification were each
// generated as independent random numbers. That's backwards for a detection
// system: in reality a detector looks at *pixels* and reports what it finds.
//
// This module simulates that properly:
//   1. build a synthetic SAR scene — ocean backscatter + speckle noise, an
//      irregular oil slick patch, and a separate look-alike patch (both
//      drawn from a hidden "ground truth", not shown to the UI)
//   2. run a simple mock detector over that scene (threshold + connected
//      components + image moments) to derive the reported slick shape and
//      classification confidence
//
// The detector only ever looks at the noisy scene, not the ground truth, so
// its output is an *estimate* — occasionally imperfect, just like a real
// detector — while the ground truth is kept on the result for later
// validation instead of being exposed to any component.
//
// Interface: analyzeSarScene(seed) -> { slick, classification, groundTruth }
// Kept isolated from generateIncident.js so a real Sentinel-1 product +
// real detector could replace this module later without any downstream
// stage (Section3 etc.) needing to change, as long as the same shape is
// returned.

import { createRng } from './rng';

const GRID = 100; // 100x100 px synthetic tile
const PIXEL_METERS = 40; // ~40m/px, in line with medium-res SAR GRD products
const OCEAN_BASE = 1.0; // baseline backscatter level (arbitrary units)
const MIN_COMPONENT_PX = 15; // ignore speckle specks smaller than this

// ── Ground truth blob definition ──────────────────────────────────────────
// An irregular blob is an ellipse whose radius-at-angle is perturbed by a
// few random sine harmonics, so its boundary looks organic rather than a
// perfect ellipse.
function makeBlob(rng, { cx, cy, lengthM, widthM, orientationDeg, reduction, patchy }) {
  const semiMajorPx = lengthM / 2 / PIXEL_METERS;
  const semiMinorPx = widthM / 2 / PIXEL_METERS;
  const orientationRad = (orientationDeg * Math.PI) / 180;
  const harmonics = Array.from({ length: 3 }, () => ({
    freq: rng.randInt(2, 5),
    amp: rng.randFloat(0.08, 0.22, 3),
    phase: rng.randFloat(0, Math.PI * 2, 3),
  }));
  return { cx, cy, semiMajorPx, semiMinorPx, orientationRad, harmonics, reduction, patchy, lengthM, widthM, orientationDeg };
}

function blobRadiusAt(blob, angleFromCenter) {
  const a = blob.semiMajorPx;
  const b = blob.semiMinorPx;
  const t = angleFromCenter - blob.orientationRad;
  let r = (a * b) / Math.sqrt((b * Math.cos(t)) ** 2 + (a * Math.sin(t)) ** 2);
  for (const h of blob.harmonics) r *= 1 + h.amp * Math.sin(h.freq * angleFromCenter + h.phase);
  return r;
}

function insideBlob(blob, x, y) {
  const dx = x - blob.cx;
  const dy = y - blob.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return true;
  const angle = Math.atan2(dy, dx);
  return dist <= blobRadiusAt(blob, angle);
}

// ── Step 1a: build the synthetic scene ────────────────────────────────────
function buildScene(rng, blobs) {
  const scene = new Float64Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      // Multiplicative speckle noise (exponential, mean 1) — standard way to
      // approximate single-look SAR speckle over uniform ocean clutter.
      const speckle = -Math.log(1 - rng.rand());
      let value = OCEAN_BASE * speckle;
      for (const blob of blobs) {
        if (insideBlob(blob, x, y)) {
          value *= blob.reduction;
          // Patchy blobs (look-alikes: wind streaks, biogenic slicks) have
          // random gaps that let ocean brightness show through — this is
          // what makes them texturally different from a real oil slick.
          if (blob.patchy && rng.rand() < 0.22) value = OCEAN_BASE * speckle;
        }
      }
      scene[y * GRID + x] = value;
    }
  }
  return scene;
}

// A real SAR pipeline despeckles (multi-looks / filters) an image before
// segmenting it — raw single-pixel speckle is too noisy to threshold
// directly. A small box filter does the same job here: it averages out
// pixel-level noise so the detector responds to the blob's actual darkening
// rather than to lucky/unlucky individual speckle values.
function boxFilter(scene, radius) {
  const out = new Float64Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          sum += scene[ny * GRID + nx];
          count++;
        }
      }
      out[y * GRID + x] = sum / count;
    }
  }
  return out;
}

// ── Step 1b: mock detector — threshold + connected components ────────────
function floodFill(scene, visited, startIdx, threshold) {
  const pixels = [];
  const stack = [startIdx];
  visited[startIdx] = 1;
  while (stack.length) {
    const idx = stack.pop();
    pixels.push(idx);
    const x = idx % GRID;
    const y = Math.floor(idx / GRID);
    const neighbors = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const nIdx = ny * GRID + nx;
      if (!visited[nIdx] && scene[nIdx] < threshold) {
        visited[nIdx] = 1;
        stack.push(nIdx);
      }
    }
  }
  return pixels;
}

function detectComponents(scene) {
  let sum = 0;
  for (let i = 0; i < scene.length; i++) sum += scene[i];
  const mean = sum / scene.length;
  let variance = 0;
  for (let i = 0; i < scene.length; i++) variance += (scene[i] - mean) ** 2;
  variance /= scene.length;
  const std = Math.sqrt(variance);
  // Despeckling above sharply reduces background noise std, so the darkened
  // blob region (mean shifted down by its reduction factor) separates
  // cleanly from ocean at a modest number of std-deviations below the mean.
  const threshold = mean - 1.1 * std;

  const visited = new Uint8Array(scene.length);
  const components = [];
  for (let i = 0; i < scene.length; i++) {
    if (!visited[i] && scene[i] < threshold) {
      const pixels = floodFill(scene, visited, i, threshold);
      if (pixels.length >= MIN_COMPONENT_PX) components.push(pixels);
    }
  }
  return { components, oceanVariance: variance };
}

// Derives shape (length/width/orientation/area/perimeter) and an internal
// texture score from a connected pixel region, using image moments — the
// same underlying math real segmentation pipelines use to turn a mask into
// a reported ellipse.
function measureComponent(scene, pixels) {
  let sx = 0, sy = 0;
  for (const idx of pixels) {
    sx += idx % GRID;
    sy += Math.floor(idx / GRID);
  }
  const cx = sx / pixels.length;
  const cy = sy / pixels.length;

  let sxx = 0, syy = 0, sxy = 0, valSum = 0;
  for (const idx of pixels) {
    const x = (idx % GRID) - cx;
    const y = Math.floor(idx / GRID) - cy;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    valSum += scene[idx];
  }
  sxx /= pixels.length;
  syy /= pixels.length;
  sxy /= pixels.length;
  const meanVal = valSum / pixels.length;
  let varVal = 0;
  for (const idx of pixels) varVal += (scene[idx] - meanVal) ** 2;
  varVal /= pixels.length;

  // Eigen-decomposition of the 2x2 covariance matrix -> principal axes.
  const trace = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (trace / 2) ** 2 - det));
  const eigA = trace / 2 + disc;
  const eigB = Math.max(0.01, trace / 2 - disc);
  const orientationRad = 0.5 * Math.atan2(2 * sxy, sxx - syy);

  const semiMajorPx = 2 * Math.sqrt(eigA);
  const semiMinorPx = 2 * Math.sqrt(eigB);
  const lengthM = Math.round(semiMajorPx * 2 * PIXEL_METERS);
  const widthM = Math.round(semiMinorPx * 2 * PIXEL_METERS);
  let orientationDeg = Math.round(((orientationRad * 180) / Math.PI + 180) % 180);
  if (orientationDeg === 0) orientationDeg = 180;

  const areaM2 = Math.round((lengthM * widthM * Math.PI) / 4);
  const perimeterM = Math.round(
    Math.PI *
      (3 * (lengthM / 2 + widthM / 2) -
        Math.sqrt((3 * lengthM / 2 + widthM / 2) * (lengthM / 2 + 3 * widthM / 2)))
  );

  return {
    lengthM,
    widthM,
    orientationDeg,
    areaM2,
    perimeterM,
    pixelCount: pixels.length,
    textureVariance: varVal,
    centroidPx: { x: cx, y: cy },
  };
}

// ── Step 1c: classification from detected texture ─────────────────────────
// Smooth, low-variance dark regions read as oil; patchier/noisier ones read
// as look-alikes. This ties the confidence scores to what the detector
// actually measured on the scene, not an independent random draw.
function classifyFromTexture(component, oceanVariance) {
  const relVar = oceanVariance > 0 ? component.textureVariance / oceanVariance : 0;
  const patchiness = Math.min(1.4, relVar);

  let oil = Math.max(0.08, 1 - patchiness * 0.65);
  let lookalike = Math.max(0.04, patchiness * 0.55);
  let clean = 0.05;
  let unknown = 0.04;

  const total = oil + lookalike + clean + unknown;
  oil /= total;
  lookalike /= total;
  clean /= total;
  unknown /= total;

  return {
    oil: parseFloat(oil.toFixed(2)),
    lookalike: parseFloat(lookalike.toFixed(2)),
    clean: parseFloat(clean.toFixed(2)),
    unknown: parseFloat(Math.max(0, 1 - (oil + lookalike + clean)).toFixed(2)),
    confidence: parseFloat(oil.toFixed(2)),
    // Explicit look-alike rejection step: the detector confirms the region
    // as oil only when oil scores higher than look-alike; otherwise it's
    // rejected as a probable look-alike (wind streak, biogenic film, etc.).
    rejectedAsLookalike: lookalike > oil,
  };
}

// ── Public API ──────────────────────────────────────────────────────────
// analyzeSarScene({ seed, lat, lon }) — lat/lon are the incident's own
// coordinates, used only to convert the detected mask's pixel-space
// centroid into a real slick location (mask center -> meters offset ->
// degrees), not to influence detection itself.
export function analyzeSarScene({ seed, lat, lon }) {
  const rng = createRng(seed);

  const trueSlick = makeBlob(rng, {
    cx: GRID / 2 + rng.randFloat(-15, 15, 1),
    cy: GRID / 2 + rng.randFloat(-10, 10, 1),
    lengthM: rng.randInt(800, 3500),
    widthM: rng.randInt(200, 900),
    orientationDeg: rng.randInt(10, 170),
    reduction: rng.randFloat(0.3, 0.5, 2),
    patchy: false,
  });

  const lookalikeAngle = rng.randFloat(0, Math.PI * 2, 3);
  const lookalikeDist = rng.randInt(28, 40);
  const trueLookalike = makeBlob(rng, {
    cx: trueSlick.cx + Math.cos(lookalikeAngle) * lookalikeDist,
    cy: trueSlick.cy + Math.sin(lookalikeAngle) * lookalikeDist,
    lengthM: rng.randInt(300, 1200),
    widthM: rng.randInt(150, 500),
    orientationDeg: rng.randInt(0, 180),
    reduction: rng.randFloat(0.45, 0.65, 2),
    patchy: true,
  });

  const scene = buildScene(rng, [trueSlick, trueLookalike]);
  const filtered = boxFilter(scene, 2); // despeckle before segmenting, as a real pipeline would
  const { components, oceanVariance } = detectComponents(filtered);
  components.sort((a, b) => b.length - a.length);

  const primary = components[0];
  const measured = measureComponent(filtered, primary);
  const classification = classifyFromTexture(measured, oceanVariance);

  // Detected mask centroid (pixels) -> real-world offset from the incident's
  // own coordinates -> the slick's actual location.
  const dxM = (measured.centroidPx.x - GRID / 2) * PIXEL_METERS;
  const dyM = (measured.centroidPx.y - GRID / 2) * PIXEL_METERS;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const slickLat = parseFloat((lat + dyM / metersPerDegLat).toFixed(4));
  const slickLon = parseFloat((lon + dxM / metersPerDegLon).toFixed(4));

  // Same pixel -> real-world conversion applied to the true look-alike blob
  // center, so its ground-truth location can be plotted alongside the
  // detected slick instead of only its shape being known.
  const laDxM = (trueLookalike.cx - GRID / 2) * PIXEL_METERS;
  const laDyM = (trueLookalike.cy - GRID / 2) * PIXEL_METERS;
  const lookalikeLat = parseFloat((lat + laDyM / metersPerDegLat).toFixed(4));
  const lookalikeLon = parseFloat((lon + laDxM / metersPerDegLon).toFixed(4));

  const groundTruth = {
    gridSize: GRID,
    pixelMeters: PIXEL_METERS,
    slick: { lengthM: trueSlick.lengthM, widthM: trueSlick.widthM, orientationDeg: trueSlick.orientationDeg },
    lookalike: {
      lengthM: trueLookalike.lengthM,
      widthM: trueLookalike.widthM,
      orientationDeg: trueLookalike.orientationDeg,
      location: { lat: lookalikeLat, lon: lookalikeLon },
    },
    detectedComponentCount: components.length,
  };

  return {
    slick: {
      length: measured.lengthM,
      width: measured.widthM,
      orientation: measured.orientationDeg,
      area: measured.areaM2,
      perimeter: measured.perimeterM,
      location: { lat: slickLat, lon: slickLon },
      // Lightweight descriptor of the detected mask/region — not a full
      // raster (nothing renders one), just enough to say "this is the
      // segmented region behind these numbers."
      mask: { pixelCount: measured.pixelCount, gridSize: GRID, pixelMeters: PIXEL_METERS },
    },
    classification,
    groundTruth,
  };
}