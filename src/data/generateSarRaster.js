// SAMUDRA — SAR scene *visualization* raster
//
// generateSarScene.js already runs the (mock) detector and reports
// length/width/orientation/location numbers — but never renders anything,
// since nothing in the UI used to draw a raster. This module is purely for
// display: it builds a synthetic grayscale speckle texture (same style of
// math as generateSarScene.js: exponential speckle + a darkened elliptical
// blob with harmonic-perturbed edges) sized to comfortably contain the
// slick, the rejected look-alike, and any nearby AIS suspect vessels, and
// returns both the pixel raster and the vector geometry (polygon outlines,
// vessel points, scale) needed to draw the two-panel A/B viewer.
//
// It does NOT feed back into detection — it's downstream-only, driven by
// the numbers Section3 already has (data.slick, data._sarGroundTruth,
// data.candidates), so it can't ever contradict them.

import { createRng, deriveSeed } from './rng';

const METERS_PER_DEG_LAT = 111320;
const GRID_SIZE = 260; // raster resolution (px) — display canvas upsamples this
const MAX_VESSELS_SHOWN = 4;
const MIN_EXTENT_KM = 2.2;
const MAX_EXTENT_KM = 8; // scene stays framed around the slick, not zoomed out to chase distant AIS suspects
const DESPECKLE_RADIUS = 2; // box-filter (multi-look) radius, px

function metersPerDegLon(lat) {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

// lat/lon -> east/north offset in meters from a center point (flat-earth
// approximation — fine at the <50km scales this operates over).
function toEastNorthM(center, lat, lon) {
  const north = (lat - center.lat) * METERS_PER_DEG_LAT;
  const east = (lon - center.lon) * metersPerDegLon(center.lat);
  return { east, north };
}

function distanceKm(center, lat, lon) {
  const { east, north } = toEastNorthM(center, lat, lon);
  return Math.sqrt(east * east + north * north) / 1000;
}

// Irregular-ellipse "shape" — same construction as generateSarScene.js's
// makeBlob/blobRadiusAt, but working in meters (world ENU frame: east=+x,
// north=+y) instead of a fixed pixel grid, so it's resolution-independent.
function makeShape(rng, { lengthM, widthM, orientationDeg }) {
  const semiMajorM = lengthM / 2;
  const semiMinorM = widthM / 2;
  const orientationRad = (orientationDeg * Math.PI) / 180;
  const harmonics = Array.from({ length: 3 }, () => ({
    freq: rng.randInt(2, 5),
    amp: rng.randFloat(0.08, 0.22, 3),
    phase: rng.randFloat(0, Math.PI * 2, 3),
  }));
  return { semiMajorM, semiMinorM, orientationRad, harmonics };
}

function radiusAtAngle(shape, angleFromCenter) {
  const a = shape.semiMajorM;
  const b = shape.semiMinorM;
  const t = angleFromCenter - shape.orientationRad;
  let r = (a * b) / Math.sqrt((b * Math.cos(t)) ** 2 + (a * Math.sin(t)) ** 2);
  for (const h of shape.harmonics) r *= 1 + h.amp * Math.sin(h.freq * angleFromCenter + h.phase);
  return r;
}

function insideShape(shape, east, north) {
  const dist = Math.hypot(east, north);
  if (dist === 0) return true;
  const angle = Math.atan2(north, east);
  return dist <= radiusAtAngle(shape, angle);
}

// World ENU meters (relative to scene center) -> raster pixel coords.
// North is up on screen, so a +north offset must move UP (subtract).
function toPx(east, north, gridSize, metersPerPx) {
  return {
    x: gridSize / 2 + east / metersPerPx,
    y: gridSize / 2 - north / metersPerPx,
  };
}

function shapeBoundaryPx(shape, centerEast, centerNorth, gridSize, metersPerPx, points = 72) {
  const ring = [];
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * Math.PI * 2;
    const r = radiusAtAngle(shape, theta);
    const east = centerEast + r * Math.cos(theta);
    const north = centerNorth + r * Math.sin(theta);
    ring.push(toPx(east, north, gridSize, metersPerPx));
  }
  return ring;
}

function pickScaleBarKm(extentKm) {
  const target = extentKm * 0.6; // full displayed width is 2*extentKm
  const steps = [1, 2, 5, 10, 15, 20, 25, 50];
  return steps.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), steps[0]);
}

export function generateSarRaster({ seed, slick, lookalike, candidates = [] }) {
  const center = slick.location;
  const rng = createRng(deriveSeed(seed, 'sar-viz'));

  // ── Extent: framed around the slick itself (like a real detection
  // chip), NOT stretched to fit distant AIS suspects — those were found
  // tens of km away via a separate backward-drift search, and were never
  // actually in this SAR pass. A vessel only appears on the raster if it
  // genuinely falls within this small frame; everything else is still
  // listed with its real distance, just not drawn on top of the image.
  const slickSpanKm = Math.max(slick.length, slick.width) / 1000;
  const extentKm = Math.min(MAX_EXTENT_KM, Math.max(MIN_EXTENT_KM, slickSpanKm * 1.1));
  const halfWidthM = extentKm * 1000;
  const metersPerPx = (halfWidthM * 2) / GRID_SIZE;

  const withDistance = candidates
    .map((v) => ({ v, distKm: distanceKm(center, v.lat, v.lon) }))
    .sort((a, b) => a.distKm - b.distKm);

  const includedVessels = [];
  let excludedVesselCount = 0;
  withDistance.forEach(({ v, distKm }) => {
    if (includedVessels.length < MAX_VESSELS_SHOWN && distKm <= extentKm * 0.92) {
      const { east, north } = toEastNorthM(center, v.lat, v.lon);
      includedVessels.push({ ...v, distKm, px: toPx(east, north, GRID_SIZE, metersPerPx), rank: includedVessels.length });
    } else {
      excludedVesselCount++;
    }
  });

  // ── Shapes (meters, ENU, relative to scene center = slick location) ──
  const slickShape = makeShape(rng, { lengthM: slick.length, widthM: slick.width, orientationDeg: slick.orientation });
  const slickCenterEN = { east: 0, north: 0 };

  let lookalikeShape = null;
  let lookalikeCenterEN = null;
  let lookalikeInExtent = false;
  if (lookalike?.location) {
    lookalikeCenterEN = toEastNorthM(center, lookalike.location.lat, lookalike.location.lon);
    lookalikeShape = makeShape(rng, {
      lengthM: lookalike.lengthM,
      widthM: lookalike.widthM,
      orientationDeg: lookalike.orientationDeg,
    });
    lookalikeInExtent = Math.hypot(lookalikeCenterEN.east, lookalikeCenterEN.north) < halfWidthM * 1.05;
  }

  // ── Build the raw speckle raster (single-look, still noisy) ─────────
  const SLICK_REDUCTION = 0.36;
  const LOOKALIKE_REDUCTION = 0.58;
  const raw = new Float64Array(GRID_SIZE * GRID_SIZE);
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const east = (col - GRID_SIZE / 2) * metersPerPx;
      const north = (GRID_SIZE / 2 - row) * metersPerPx;

      const speckle = -Math.log(1 - rng.rand()); // exponential, mean 1
      let value = speckle;

      if (insideShape(slickShape, east - slickCenterEN.east, north - slickCenterEN.north)) {
        value *= SLICK_REDUCTION;
      }
      if (lookalikeShape && insideShape(lookalikeShape, east - lookalikeCenterEN.east, north - lookalikeCenterEN.north)) {
        value *= LOOKALIKE_REDUCTION;
        if (rng.rand() < 0.22) value = speckle; // patchy — biogenic/wind-streak texture
      }
      raw[row * GRID_SIZE + col] = value;
    }
  }

  // ── Despeckle (multi-look box filter) ────────────────────────────────
  // Raw single-look speckle is genuinely that noisy pixel-to-pixel — real
  // SAR products are always averaged down before display, or it just
  // reads as static. Averaging over a small window is that step.
  const filtered = new Float64Array(GRID_SIZE * GRID_SIZE);
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      let sum = 0;
      let count = 0;
      for (let dy = -DESPECKLE_RADIUS; dy <= DESPECKLE_RADIUS; dy++) {
        for (let dx = -DESPECKLE_RADIUS; dx <= DESPECKLE_RADIUS; dx++) {
          const r = row + dy;
          const c = col + dx;
          if (r < 0 || c < 0 || r >= GRID_SIZE || c >= GRID_SIZE) continue;
          sum += raw[r * GRID_SIZE + c];
          count++;
        }
      }
      filtered[row * GRID_SIZE + col] = sum / count;
    }
  }

  // ── Display mapping ──────────────────────────────────────────────────
  // After averaging, values cluster much closer to their local mean (an
  // exponential(1) averaged over a ~25px window has std ≈ 0.2 instead of
  // 1), so the contrast window has to be narrow to still show anything —
  // wide open ocean around ~1.0, the slick's darkened region around ~0.36.
  const gray = new Uint8ClampedArray(GRID_SIZE * GRID_SIZE);
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
  for (const v of includedVessels) {
    const cx = Math.round(v.px.x);
    const cy = Math.round(v.px.y);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) continue;
        const brightness = dist < 1 ? 255 : 255 - dist * 55;
        gray[y * GRID_SIZE + x] = Math.max(gray[y * GRID_SIZE + x], brightness);
      }
    }
  }

  return {
    gray,
    gridSize: GRID_SIZE,
    extentKm,
    metersPerPx,
    scaleBarKm: pickScaleBarKm(extentKm),
    slickPolygonPx: shapeBoundaryPx(slickShape, slickCenterEN.east, slickCenterEN.north, GRID_SIZE, metersPerPx),
    lookalikePolygonPx:
      lookalikeShape && lookalikeInExtent
        ? shapeBoundaryPx(lookalikeShape, lookalikeCenterEN.east, lookalikeCenterEN.north, GRID_SIZE, metersPerPx)
        : null,
    slickCenterPx: { x: GRID_SIZE / 2, y: GRID_SIZE / 2 },
    vessels: includedVessels,
    excludedVesselCount,
    // Nearest AIS suspects regardless of whether they fall inside this
    // frame — for a sidebar list, since most won't have been in this SAR
    // pass at all (they're found separately, via backward-drift + AIS).
    nearestVessels: withDistance.slice(0, 5).map(({ v, distKm }) => ({ ...v, distKm })),
  };
}
