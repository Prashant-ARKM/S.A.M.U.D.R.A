// SAMUDRA — "Report a Spill" investigation entry point.
//
// Distinct from the automated Trigger Incident flow: here a human
// tip-off names a zone, and the system investigates it — which can
// genuinely come back clean. That "nothing there" outcome is the whole
// point of this module; it is never forced into a detection.
//
// Interface: investigateReport({ lat, lon, notes }) -> either
//   { falseAlarm: true, ...scan metadata }  or
//   { falseAlarm: false, ...full generateIncident() output, source: 'reported' }

import { createRng, deriveSeed } from './rng';
import { generateIncident } from './generateIncident';

const NEGATIVE_SCAN_CHANCE = 0.32; // ~1 in 3 reported zones show no SAR anomaly
const SCAN_SATELLITES = ['Sentinel-1A', 'RADARSAT-2', 'ICEYE-X2'];

export function investigateReport({ lat, lon, notes }) {
  const seed = Math.floor(Math.random() * 2147483647);
  const rng = createRng(deriveSeed(seed, 'report-scan'));

  const satellite = SCAN_SATELLITES[rng.randInt(0, SCAN_SATELLITES.length - 1)];
  const scanRadiusKm = rng.randInt(15, 30);
  const scanAreaKm2 = Math.round(Math.PI * scanRadiusKm * scanRadiusKm);
  const falseAlarm = rng.rand() < NEGATIVE_SCAN_CHANCE;

  if (falseAlarm) {
    return {
      seed,
      source: 'reported',
      falseAlarm: true,
      reportedLocation: { lat, lon },
      reportNotes: notes || null,
      timestamp: new Date().toISOString(),
      scanSatellite: satellite,
      scanRadiusKm,
      scanAreaKm2,
    };
  }

  const data = generateIncident({
    seed,
    anchorLat: lat,
    anchorLon: lon,
    source: 'reported',
    reportedLocation: { lat, lon },
    reportNotes: notes,
  });

  return { ...data, falseAlarm: false, scanSatellite: satellite, scanRadiusKm, scanAreaKm2 };
}
