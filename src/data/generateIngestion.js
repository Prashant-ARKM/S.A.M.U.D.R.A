// SAMUDRA — Step 2: Multi-Source Data Ingestion
//
// Flow: incident -> determine required coverage -> ingest mock datasets ->
// validate -> unified investigation-ready data package.
//
// Every value here is deterministically derived from the Step 1 incident's
// own seed, location, and timestamp (see rng.js) — never an independent
// Math.random() draw — so re-rendering the same incident always ingests the
// same coherent set of datasets.
//
// This module only knows about a plain { seed, timestamp, lat, lon, sceneId,
// acquisitionTime, satellite, satelliteDetails } shape, not the full
// incident object, so a future real Sentinel-1/AIS/Copernicus/met API
// integration can replace the "ingest" functions below without touching
// generateIncident.js or any component. ingestDataSources(incident) is the
// one function generateIncident.js calls.

import { createRng, deriveSeed } from './rng';

const SOURCE_TYPES = ['sar', 'ais', 'ocean', 'wind', 'met'];
const SEA_STATES = ['Calm', 'Smooth', 'Slight', 'Moderate'];

// ── helpers ──────────────────────────────────────────────────────────────

function isoDateStr(iso) {
  return iso.slice(0, 10).replace(/-/g, '');
}

function roundToNearestHours(iso, stepHours) {
  const ms = stepHours * 3600000;
  return new Date(Math.floor(new Date(iso).getTime() / ms) * ms).toISOString();
}

function hoursBefore(iso, hours) {
  return new Date(new Date(iso).getTime() - hours * 3600000).toISOString();
}

// Short deterministic location tag, e.g. "191N709E" — ties dataset IDs to
// the incident's own coordinates instead of being arbitrary strings.
function locationTag(lat, lon) {
  const latTag = Math.round(Math.abs(lat) * 10);
  const lonTag = Math.round(Math.abs(lon) * 10);
  return `${latTag}${lat >= 0 ? 'N' : 'S'}${lonTag}${lon >= 0 ? 'E' : 'W'}`;
}

// A simple bounding-box description around the incident, used as each
// source's spatial coverage footprint — small for the SAR scene itself,
// wider for regional model/reanalysis products.
function boundingBox(lat, lon, marginDeg) {
  const s = (lat - marginDeg).toFixed(2);
  const n = (lat + marginDeg).toFixed(2);
  const w = (lon - marginDeg).toFixed(2);
  const e = (lon + marginDeg).toFixed(2);
  return `${s}°–${n}°N, ${w}°–${e}°E`;
}

// ── Step: determine required coverage ─────────────────────────────────────
// Every maritime-anomaly incident needs the same five dataset types before
// analysis can proceed. Kept as a function (not a bare constant) so a future
// incident type could require a different data mix without changing the
// shape of the pipeline below.
function determineRequiredSources() {
  return SOURCE_TYPES;
}

// ── Step: ingest — one function per dataset type ──────────────────────────
// Each is shaped by the incident's own location/time so results stay
// coherent with Step 1, not bolted on independently.

function ingestSar(incident, rng) {
  return {
    key: 'sar',
    name: 'Sentinel-1 SAR',
    datasetId: incident.sceneId,
    spatialCoverage: `Scene footprint — ${boundingBox(incident.lat, incident.lon, 0.9)}`,
    temporalCoverage: 'Single pass (instantaneous acquisition)',
    observationTime: incident.acquisitionTime,
    coverage: 100,
    metadata: {
      Satellite: incident.satellite,
      Band: incident.satelliteDetails?.band ?? 'C-band',
      Polarization: 'VV + VH',
      Resolution: `${rng.randInt(3, 25)}m`,
    },
  };
}

function ingestHistoricalAis(incident, rng) {
  const lookbackHours = 72;
  // Receiver coverage is usually good; only occasionally (~15% of runs) does
  // it degrade into partial/unavailable territory, so the default demo
  // reliably proceeds while still showing a realistic failure mode sometimes.
  const degraded = rng.rand() < 0.15;
  const coverage = degraded ? rng.randFloat(55, 89, 1) : rng.randFloat(90, 99, 1);
  return {
    key: 'ais',
    name: 'Historical AIS',
    datasetId: `AIS-HIST-${locationTag(incident.lat, incident.lon)}-${isoDateStr(incident.timestamp)}`,
    spatialCoverage: `Regional — ${boundingBox(incident.lat, incident.lon, 1.5)}`,
    temporalCoverage: `${lookbackHours}h lookback window`,
    observationTime: incident.timestamp,
    window: { start: hoursBefore(incident.timestamp, lookbackHours), end: incident.timestamp },
    coverage,
    metadata: {
      Receivers: rng.randInt(6, 14),
      Records: rng.randInt(1800, 9600),
    },
  };
}

function ingestCopernicusOcean(incident, rng) {
  // Copernicus Marine Service is the one real-world provider behind both
  // "ocean" products (SST/chlorophyll context) and current/wave physics, so
  // both are folded into a single coherent dataset here.
  const observationTime = roundToNearestHours(incident.timestamp, 6); // CMEMS-style 6h analysis step
  return {
    key: 'ocean',
    name: 'Copernicus Ocean / Currents',
    datasetId: `CMEMS-PHY-ANALYSIS-${isoDateStr(observationTime)}`,
    spatialCoverage: `Regional — ${boundingBox(incident.lat, incident.lon, 2)}`,
    temporalCoverage: '6-hourly analysis field',
    observationTime,
    coverage: 100,
    metadata: {
      'Current Speed': `${rng.randFloat(0.1, 1.2, 2)} m/s`,
      'Current Dir.': `${rng.randInt(0, 359)}°`,
      'Wave Height': `${rng.randFloat(0.3, 2.5, 1)} m`,
      SST: `${rng.randFloat(24, 30, 1)}°C`,
    },
  };
}

function ingestWind(incident, rng) {
  const observationTime = roundToNearestHours(incident.timestamp, 3); // 3-hourly model step
  return {
    key: 'wind',
    name: 'Wind Field',
    datasetId: `GFS-WIND10M-${isoDateStr(observationTime)}`,
    spatialCoverage: `Regional — ${boundingBox(incident.lat, incident.lon, 2)}`,
    temporalCoverage: '3-hourly forecast field',
    observationTime,
    coverage: 100,
    metadata: {
      Speed: `${rng.randFloat(2, 18, 1)} kt`,
      Direction: `${rng.randInt(0, 359)}°`,
      Gusts: `${rng.randFloat(4, 24, 1)} kt`,
    },
  };
}

function ingestMeteorological(incident, rng) {
  const observationTime = roundToNearestHours(incident.timestamp, 3);
  return {
    key: 'met',
    name: 'Meteorological',
    datasetId: `SYNOPTIC-MET-${isoDateStr(observationTime)}`,
    spatialCoverage: `Regional — ${boundingBox(incident.lat, incident.lon, 2)}`,
    temporalCoverage: '3-hourly synoptic observation',
    observationTime,
    coverage: 100,
    metadata: {
      Pressure: `${rng.randInt(1004, 1014)} hPa`,
      Visibility: `${rng.randFloat(6, 10, 1)} km`,
      'Sea State': rng.pick(SEA_STATES),
    },
  };
}

const INGESTORS = {
  sar: ingestSar,
  ais: ingestHistoricalAis,
  ocean: ingestCopernicusOcean,
  wind: ingestWind,
  met: ingestMeteorological,
};

// ── Step: validate ──────────────────────────────────────────────────────
// AIS coverage genuinely varies with terrestrial/satellite receiver density,
// so it's the one source allowed to land in a partial or unavailable state.
// The satellite/model-derived sources are treated as always fully covering
// the incident's location, matching how those products actually work.
function validateCoverage(source) {
  let status;
  if (source.coverage >= 90) status = 'Ready';
  else if (source.coverage >= 70) status = 'Partial Coverage';
  else status = 'Unavailable';
  return { ...source, status };
}

// ── Public API ──────────────────────────────────────────────────────────
// incident -> determine required coverage -> ingest -> validate -> package
export function ingestDataSources(incident) {
  const rng = createRng(deriveSeed(incident.seed, 'ingestion'));
  const required = determineRequiredSources();
  return required.map((type) => validateCoverage(INGESTORS[type](incident, rng)));
}
