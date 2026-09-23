// SAMUDRA — shared scene geometry for visualization rasters (SAR + EO).
//
// Both sensors are looking at the SAME physical slick, so they must agree
// on where it is, its shape, and which vessels fall in-frame. This module
// is the single source of that geometry; generateSarRaster.js and
// generateEoRaster.js each take it and paint their own sensor's texture
// on top.

import { createRng, deriveSeed } from './rng';

const METERS_PER_DEG_LAT = 111320;
export const MAX_VESSELS_SHOWN = 4;
export const MIN_EXTENT_KM = 2.2;
export const MAX_EXTENT_KM = 8; // frame stays around the slick, not stretched to chase distant AIS suspects

function metersPerDegLon(lat) {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

// lat/lon -> east/north offset in meters from a center point (flat-earth
// approximation — fine at the <50km scales this operates over).
export function toEastNorthM(center, lat, lon) {
  const north = (lat - center.lat) * METERS_PER_DEG_LAT;
  const east = (lon - center.lon) * metersPerDegLon(center.lat);
  return { east, north };
}

export function distanceKm(center, lat, lon) {
  const { east, north } = toEastNorthM(center, lat, lon);
  return Math.sqrt(east * east + north * north) / 1000;
}

// Irregular-ellipse "shape": world ENU meters (east=+x, north=+y),
// resolution-independent so any raster grid/extent can render it.
export function makeShape(rng, { lengthM, widthM, orientationDeg }) {
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

export function radiusAtAngle(shape, angleFromCenter) {
  const a = shape.semiMajorM;
  const b = shape.semiMinorM;
  const t = angleFromCenter - shape.orientationRad;
  let r = (a * b) / Math.sqrt((b * Math.cos(t)) ** 2 + (a * Math.sin(t)) ** 2);
  for (const h of shape.harmonics) r *= 1 + h.amp * Math.sin(h.freq * angleFromCenter + h.phase);
  return r;
}

export function insideShape(shape, east, north) {
  const dist = Math.hypot(east, north);
  if (dist === 0) return true;
  const angle = Math.atan2(north, east);
  return dist <= radiusAtAngle(shape, angle);
}

// World ENU meters (relative to scene center) -> raster pixel coords.
// North is up on screen, so a +north offset must move UP (subtract).
export function toPx(east, north, gridSize, metersPerPx) {
  return {
    x: gridSize / 2 + east / metersPerPx,
    y: gridSize / 2 - north / metersPerPx,
  };
}

export function shapeBoundaryPx(shape, centerEast, centerNorth, gridSize, metersPerPx, points = 72) {
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

export function pickScaleBarKm(extentKm) {
  const target = extentKm * 0.6; // full displayed width is 2*extentKm
  const steps = [1, 2, 5, 10, 15, 20, 25, 50];
  return steps.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), steps[0]);
}

// Builds the shared frame: extent, the slick/look-alike shapes (in world
// ENU meters, seeded off a sensor-independent tag so SAR and EO agree on
// the physical slick boundary), and which vessels genuinely fall in-frame.
export function buildSceneFrame({ seed, slick, lookalike, candidates = [], gridSize }) {
  const center = slick.location;
  const shapeRng = createRng(deriveSeed(seed, 'scene-shape')); // shared across sensors — same physical slick

  const slickSpanKm = Math.max(slick.length, slick.width) / 1000;
  const extentKm = Math.min(MAX_EXTENT_KM, Math.max(MIN_EXTENT_KM, slickSpanKm * 1.1));
  const halfWidthM = extentKm * 1000;
  const metersPerPx = (halfWidthM * 2) / gridSize;

  const withDistance = candidates
    .map((v) => ({ v, distKm: distanceKm(center, v.lat, v.lon) }))
    .sort((a, b) => a.distKm - b.distKm);

  const vessels = [];
  let excludedVesselCount = 0;
  withDistance.forEach(({ v, distKm }) => {
    if (vessels.length < MAX_VESSELS_SHOWN && distKm <= extentKm * 0.92) {
      const { east, north } = toEastNorthM(center, v.lat, v.lon);
      vessels.push({ ...v, distKm, px: toPx(east, north, gridSize, metersPerPx), rank: vessels.length });
    } else {
      excludedVesselCount++;
    }
  });

  const slickShape = makeShape(shapeRng, { lengthM: slick.length, widthM: slick.width, orientationDeg: slick.orientation });
  const slickCenterEN = { east: 0, north: 0 };

  let lookalikeShape = null;
  let lookalikeCenterEN = null;
  let lookalikeInExtent = false;
  if (lookalike?.location) {
    lookalikeCenterEN = toEastNorthM(center, lookalike.location.lat, lookalike.location.lon);
    lookalikeShape = makeShape(shapeRng, {
      lengthM: lookalike.lengthM,
      widthM: lookalike.widthM,
      orientationDeg: lookalike.orientationDeg,
    });
    lookalikeInExtent = Math.hypot(lookalikeCenterEN.east, lookalikeCenterEN.north) < halfWidthM * 1.05;
  }

  return {
    gridSize,
    extentKm,
    metersPerPx,
    scaleBarKm: pickScaleBarKm(extentKm),
    slickShape,
    slickCenterEN,
    lookalikeShape,
    lookalikeCenterEN,
    lookalikeInExtent,
    slickPolygonPx: shapeBoundaryPx(slickShape, slickCenterEN.east, slickCenterEN.north, gridSize, metersPerPx),
    lookalikePolygonPx:
      lookalikeShape && lookalikeInExtent
        ? shapeBoundaryPx(lookalikeShape, lookalikeCenterEN.east, lookalikeCenterEN.north, gridSize, metersPerPx)
        : null,
    vessels,
    excludedVesselCount,
    nearestVessels: withDistance.slice(0, 5).map(({ v, distKm }) => ({ ...v, distKm })),
  };
}
