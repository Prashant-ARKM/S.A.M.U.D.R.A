// SAMUDRA — Central mock data generator
// All downstream sections consume one object from generateIncident()

import { ingestDataSources } from './generateIngestion';
import { analyzeSarScene } from './generateSarScene';
import { reconstructOrigin } from './generateHindcast';
import { estimateSpillAge } from './generateSpillAge';
import { forecastForward } from './generateForecast';
import { identifyVessels } from './generateVesselAttribution';
import { fuseEvidence } from './generateEvidenceFusion';
import { generateEoValidation } from './generateEoValidation';
import { simulateCounterfactuals } from './generateCounterfactual';
import { deriveSeed } from './rng';

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Real, long-operational SAR satellites — used only to make the mock scene
// metadata look plausible. No live data is ever fetched from them.
const SAR_SATELLITES = [
  { name: 'Sentinel-1A', code: 'S1A', operator: 'ESA / Copernicus', band: 'C-band' },
  { name: 'RADARSAT-2', code: 'RS2', operator: 'MDA / CSA', band: 'C-band' },
  { name: 'TerraSAR-X', code: 'TSX', operator: 'DLR / Airbus', band: 'X-band' },
  { name: 'COSMO-SkyMed', code: 'CSK', operator: 'ASI', band: 'X-band' },
  { name: 'ICEYE-X', code: 'ICX', operator: 'ICEYE', band: 'X-band' },
];

const MARITIME_REGIONS = [
  'Arabian Sea — Mumbai High Offshore Block',
  'Arabian Sea — Western Continental Shelf (India)',
  'Arabian Sea — Bombay High Field Vicinity',
  'North Arabian Sea — Indian EEZ Sector 4',
];

export function generateIncident(options = {}) {
  const seed = options.seed ?? Math.floor(Math.random() * 2147483647);
  const rng = mulberry32(seed);

  const rand = () => rng();
  const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const randFloat = (min, max, dec = 3) => parseFloat((rand() * (max - min) + min).toFixed(dec));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // Base coordinates — Arabian Sea, off Mumbai High / west coast shipping
  // lanes by default. A "Report a Spill" tip-off instead anchors here: a
  // small offset is still applied, because a human-reported position is
  // rarely pixel-exact against what the satellite actually resolves.
  const reported = options.anchorLat != null && options.anchorLon != null;
  const baseLat = reported ? options.anchorLat + randFloat(-0.03, 0.03) : randFloat(18.5, 19.8);
  const baseLon = reported ? options.anchorLon + randFloat(-0.03, 0.03) : randFloat(69.5, 71.5);

  const incidentId = `INC-${new Date().getFullYear()}-${String(randInt(1000, 9999))}`;
  const timestamp = new Date().toISOString();

  // ── Step 1: Incident Detection metadata ──
  // Satellite pass happens first; automated detection completes a few
  // minutes later once the SAR product is processed — timestamp stays "now",
  // acquisitionTime is derived backwards from it so the two stay consistent.
  const satellite = pick(SAR_SATELLITES);
  const passDirection = pick(['Ascending', 'Descending']);
  const incidenceAngle = randFloat(20, 45, 1);
  const processingLagMinutes = randInt(6, 22);
  const acquisitionTime = new Date(Date.now() - processingLagMinutes * 60000).toISOString();
  const orbitNumber = randInt(10000, 99999);
  const sceneId = `${satellite.code}_${passDirection.slice(0, 1)}${orbitNumber}_${acquisitionTime
    .replace(/[-:]/g, '')
    .slice(0, 15)}`;

  const region = reported ? 'Reported Zone — User-Flagged Coordinates' : pick(MARITIME_REGIONS);
  const anomalyDetected = true;

  // Slick shape + classification — derived from a synthetic SAR scene
  // (its own module: ./generateSarScene.js) rather than generated
  // independently, so the reported detection is actually the output of a
  // (mock) detector looking at pixels, with hidden ground truth kept for
  // later validation.
  const sarSeed = deriveSeed(seed, 'sar-scene');
  const { slick: detectedSlick, classification: detectedClassification, groundTruth: sarGroundTruth } =
    analyzeSarScene({ seed: sarSeed, lat: baseLat, lon: baseLon });

  // Step 1 status/confidence are derived from Step 3's real classification
  // output rather than an independent random draw, so the incident card
  // and the analysis card can never report contradictory confidence for
  // the same detection.
  const anomalyConfidence = detectedClassification.confidence;
  const detectionStatus =
    anomalyConfidence >= 0.75
      ? (reported ? 'Confirmed — Reported Zone Investigation' : 'Confirmed by Automated Detection')
      : 'Flagged — Pending Analyst Review';
  const anomalyStatus =
    anomalyConfidence >= 0.8 ? 'Probable Oil Slick — High Confidence' : 'Probable Oil Slick — Awaiting Confirmation';

  // Step 2 — Multi-Source Data Ingestion (its own module: ./generateIngestion.js).
  // Only the fields ingestion actually needs are passed in, so that module
  // stays swappable for a real API later without depending on this file's
  // internals.
  const sources = ingestDataSources({
    seed,
    timestamp,
    lat: baseLat,
    lon: baseLon,
    sceneId,
    acquisitionTime,
    satellite: satellite.name,
    satelliteDetails: { operator: satellite.operator, band: satellite.band, passDirection, incidenceAngle },
  });

  // Step 4 — Backward Spill Reconstruction (its own module:
  // ./generateHindcast.js). Works backward from the Step 3 slick location
  // using the Step 2 ocean/wind sources, rather than an independent guess.
  const oceanSource = sources.find((s) => s.key === 'ocean');
  const windSource = sources.find((s) => s.key === 'wind');
  const {
    origin: { lat: originLat, lon: originLon },
    releaseTimeWindow,
    backwardPath,
    particles: hindcastParticles,
    uncertaintyRadiusM,
    confidence: reconstructionConfidence,
  } = reconstructOrigin({
    slickLocation: detectedSlick.location,
    acquisitionTime,
    oilConfidence: detectedClassification.confidence,
    oceanSource,
    windSource,
    seed,
  });

  // Step 3c — Slick Age Estimation (its own module: ./generateSpillAge.js).
  // Independent of Step 4 by design — a thinning/appearance-based method,
  // cross-checked against (not derived from) the drift-based release
  // window above.
  const spillAge = estimateSpillAge({
    seed,
    slick: detectedSlick,
    releaseTimeWindow,
    acquisitionTime,
  });

  // Step 5 — Forward Spill Prediction (its own module: ./generateForecast.js).
  // Seeded at the Step 4 reconstructed origin using the same Step 2
  // ocean/wind sources — not an independent direction/spread.
  const {
    ensembleTrajectories,
    forecastHorizonHours,
    uncertaintyRadiusM: forecastUncertaintyRadiusM,
    confidence: forecastConfidence,
    areaGrowthRateM2PerHour,
  } = forecastForward({
    origin: { lat: originLat, lon: originLon },
    initialAreaM2: detectedSlick.area,
    oceanSource,
    windSource,
    seed,
  });

  // Step 6 — Vessel Identification & AIS Attribution (its own module:
  // ./generateVesselAttribution.js). Derived from the Step 4 origin/release
  // window and the Step 2 AIS dataset, not independent random suspects.
  const aisSource = sources.find((s) => s.key === 'ais');
  const { candidates, filteredOutCount, tracksConsidered } = identifyVessels({
  origin: { lat: originLat, lon: originLon },
  releaseTimeWindow,
  aisSource,
  uncertaintyRadiusM,
  seed,
});


  // Step 3b — Electro-Optical Validation (its own module:
  // ./generateEoValidation.js). Optional clear-sky cross-check on the same
  // Step 3 slick — only "available" when simulated daylight/cloud
  // conditions would realistically allow it.
  const eoValidation = generateEoValidation({
    seed,
    slick: detectedSlick,
    lookalike: sarGroundTruth.lookalike,
    candidates,
    classification: detectedClassification,
    sarAcquisitionTime: acquisitionTime,
  });

  // Step 7 — Evidence Fusion & Hypothesis (its own module:
  // ./generateEvidenceFusion.js). Combines the Step 6 candidate scores with
  // the Step 4 reconstruction confidence and Step 5 forecast confidence —
  // not independently generated.
  const { ranked: rankedCandidates, mostProbable: mostProbableCandidate, sourceStatus, closestLead, uncertainty: fusionUncertainty } = fuseEvidence({
    candidates,
    reconstructionConfidence,
    forecastConfidence,
    uncertaintyRadiusM,
    aisSource,
  });

  // Step 7b — Counterfactual Spill Simulation (its own module:
  // ./generateCounterfactual.js). Independent corroboration check on the
  // Step 7 ranking, not a re-scoring — forward-drifts each ranked
  // candidate's own AIS position and checks whether it would actually
  // reach the observed Step 3 slick.
  const counterfactuals = simulateCounterfactuals({
    rankedCandidates,
    observedSlick: detectedSlick.location,
    acquisitionTime,
    oceanSource,
    windSource,
    uncertaintyRadiusM,
    seed,
  });

  return {
    seed,
    incidentId,
    timestamp,
    coordinates: { lat: baseLat, lon: baseLon },
    source: reported ? 'reported' : 'auto',
    reportedLocation: reported ? { lat: options.anchorLat, lon: options.anchorLon } : null,
    reportNotes: options.reportNotes || null,

    // Step 1 — Incident Detection (also exposed flat below for easy
    // consumption by later stages: id, satellite, sceneId, latitude,
    // longitude, region, status, anomalyDetected)
    id: incidentId,
    latitude: baseLat,
    longitude: baseLon,
    region,
    satellite: satellite.name,
    satelliteDetails: { operator: satellite.operator, band: satellite.band, passDirection, incidenceAngle },
    sceneId,
    acquisitionTime,
    status: detectionStatus,
    anomalyDetected,
    anomalyStatus,
    anomalyConfidence,

    slick: detectedSlick,
    classification: detectedClassification,
    spillAge,
    // Hidden ground truth — not read by any component, kept only so a
    // later validation/scoring pass can compare the detector's estimate
    // above against what was actually planted in the synthetic scene.
    _sarGroundTruth: sarGroundTruth,
    eoValidation,
    sources,
    origin: { lat: originLat, lon: originLon },
    releaseTimeWindow,
    backwardPath,
    hindcastParticles,
    uncertaintyRadiusM,
    reconstructionConfidence,
    ensembleTrajectories,
    forecastHorizonHours,
    forecastUncertaintyRadiusM,
    forecastConfidence,
    areaGrowthRateM2PerHour,
    candidates,
    rankedCandidates,
    mostProbableCandidate,
    sourceStatus,
    closestLead,
    fusionUncertainty,
    counterfactuals,
    filteredOutCount,
    tracksConsidered,
  };
}