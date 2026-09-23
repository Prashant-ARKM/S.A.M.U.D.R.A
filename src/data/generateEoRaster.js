// SAMUDRA — Electro-Optical (true-colour) scene *visualization* raster.
//
// Same physical slick/vessels as the SAR panel (shared via sceneGeometry's
// buildSceneFrame, seeded off the same root seed) — this module just paints
// a different sensor on top: passive optical reflectance instead of radar
// backscatter, so oil reads as a silvery/brownish sheen on blue water
// rather than a dark radar patch.

import { createRng, deriveSeed } from './rng';
import { buildSceneFrame, insideShape } from './sceneGeometry';

const GRID_SIZE = 260;

const OCEAN = [21, 68, 88];
const OCEAN_LIGHT = [54, 118, 134];
const SHEEN_SILVER = [200, 202, 192];
const SHEEN_BROWN = [163, 141, 108];

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function generateEoRaster({ seed, slick, lookalike, candidates = [] }) {
  const frame = buildSceneFrame({ seed, slick, lookalike, candidates, gridSize: GRID_SIZE });
  const { gridSize, metersPerPx, slickShape, slickCenterEN, lookalikeShape, lookalikeCenterEN, vessels } = frame;
  const rng = createRng(deriveSeed(seed, 'eo-sensor'));

  const rgb = new Uint8ClampedArray(gridSize * gridSize * 3);
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const east = (col - gridSize / 2) * metersPerPx;
      const north = (gridSize / 2 - row) * metersPerPx;

      let rgbPx = lerp3(OCEAN, OCEAN_LIGHT, rng.rand() * 0.55); // gentle sun-glint texture

      if (insideShape(slickShape, east - slickCenterEN.east, north - slickCenterEN.north)) {
        const sheen = rng.rand() < 0.5 ? SHEEN_SILVER : SHEEN_BROWN;
        rgbPx = lerp3(rgbPx, sheen, 0.5 + rng.rand() * 0.3);
      } else if (lookalikeShape && insideShape(lookalikeShape, east - lookalikeCenterEN.east, north - lookalikeCenterEN.north)) {
        // biogenic film / wind streak: a faint ripple, NOT a bright sheen —
        // this optical contrast (or lack of it) is exactly what makes EO a
        // useful cross-check against a SAR-only detection.
        rgbPx = lerp3(rgbPx, OCEAN, 0.25);
      }

      const idx = (row * gridSize + col) * 3;
      rgb[idx] = rgbPx[0];
      rgb[idx + 1] = rgbPx[1];
      rgb[idx + 2] = rgbPx[2];
    }
  }

  // Vessels: small bright hull/wake highlight.
  for (const v of vessels) {
    const cx = Math.round(v.px.x);
    const cy = Math.round(v.px.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
        const idx = (y * gridSize + x) * 3;
        rgb[idx] = 255;
        rgb[idx + 1] = 255;
        rgb[idx + 2] = 250;
      }
    }
  }

  return { ...frame, rgb };
}
