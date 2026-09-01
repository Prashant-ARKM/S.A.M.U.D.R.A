// SAMUDRA — shared seeded RNG utility
// Every mock-data module derives its values from a seed instead of calling
// Math.random() directly, so results stay deterministic and reproducible
// for a given incident/seed rather than being independently random.

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bundles a seeded stream with the small helpers every generator needs.
export function createRng(seed) {
  const rand = mulberry32(seed);
  return {
    rand,
    randInt: (min, max) => Math.floor(rand() * (max - min + 1)) + min,
    randFloat: (min, max, dec = 3) => parseFloat((rand() * (max - min) + min).toFixed(dec)),
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
  };
}

// Deterministically derives a new 32-bit seed from an existing seed + a tag
// string, so different pipeline stages (detection, ingestion, ...) each get
// their own coherent-but-distinct stream from the same root incident seed,
// instead of reusing one stream or falling back to independent randomness.
export function deriveSeed(seed, tag) {
  let h = seed | 0;
  for (let i = 0; i < tag.length; i++) {
    h = (Math.imul(h, 31) + tag.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
