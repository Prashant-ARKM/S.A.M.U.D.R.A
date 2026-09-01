// SAMUDRA — Step 6: Vessel Identification & AIS Attribution
//
// Mock workflow:
// Step 4 probable origin + release window
//   -> synthetic historical AIS tracks from the Step 2 lookback window
//   -> closest approach / temporal overlap
//   -> spatial + temporal + trajectory + behaviour scoring
//   -> ranked suspects.
//
// The AIS data is synthetic, but each vessel has a real multi-point
// time-ordered track. Scores are derived from that track and the Step 4
// reconstruction; they are not random.
//
// Interface:
// identifyVessels({ origin, releaseTimeWindow, aisSource, seed })
// -> { candidates, filteredOutCount, tracksConsidered }

import { createRng, deriveSeed } from './rng';

const VESSEL_NAMES = [
  'MT Pacific Voyager',
  'MV Sagar Ratna',
  'MT Neptune Star',
  'MV Dharma Samudra',
  'MT Ocean Herald',
  'MV Mumbai Spirit',
  'MT Vindhya',
  'MV Arabian Pioneer',
  'MT Konkan Trader',
];

const VESSEL_TYPES = [
  'Crude Tanker',
  'Product Tanker',
  'Chemical Tanker',
  'Bulk Carrier',
  'LNG Carrier',
];

const TRACK_COUNT = 9;
const MAX_CANDIDATES = 5;
const MAX_RADIUS_KM = 45;
const MAX_TIME_DIFF_HOURS = 30;
const POINT_INTERVAL_HOURS = 2;
const TRACK_POINTS = 37;

// Evidence-score decay constants.
//
// The previous scoring was linear (1 - mismatch/range), which meant a
// vessel sitting exactly on the origin, exactly inside the release window,
// or on an exactly-matching heading scored a literal 1.0 — implying
// impossible sensor-perfect certainty. Real AIS positions, timestamps, and
// headings always carry a residual measurement floor, so each mismatch
// term below is shifted by that floor before an exponential decay is
// applied. The result is deterministic, monotonic, bounded in (0, 1), and
// can never reach exactly 1.0 even for a "perfect" match — without any
// arbitrary cosmetic subtraction.
const AIS_POSITION_FLOOR_KM = 0.05; // ~50m: typical AIS/GPS horizontal fix accuracy
const AIS_TIME_FLOOR_HOURS = 0.1; // ~6min: AIS reporting interval / hindcast time resolution
const HEADING_FLOOR_DEG = 1.5; // gyrocompass/AIS course-over-ground resolution floor
const SPATIAL_DECAY_MIN_SCALE_KM = 1; // guards against a near-zero reconstruction uncertainty collapsing the decay scale
const TEMPORAL_DECAY_SCALE_HOURS = MAX_TIME_DIFF_HOURS / 3;
const TRAJECTORY_DECAY_SCALE_DEG = 60;

const KM_PER_DEG_LAT = 111.32;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const toFixedNumber = (v, digits = 2) => Number(Number(v).toFixed(digits));

function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat1 - lat2) * KM_PER_DEG_LAT;
  const dLon =
    (lon1 - lon2) *
    KM_PER_DEG_LAT *
    Math.cos((lat2 * Math.PI) / 180);

  return Math.sqrt(dLat ** 2 + dLon ** 2);
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const rad = (deg) => (deg * Math.PI) / 180;

  const y =
    Math.sin(rad(lon2 - lon1)) *
    Math.cos(rad(lat2));

  const x =
    Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.cos(rad(lon2 - lon1));

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function destination(lat, lon, bearing, distanceKmValue) {
  const bearingRad = (bearing * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  const dLat =
    (distanceKmValue * Math.cos(bearingRad)) /
    KM_PER_DEG_LAT;

  const lonScale =
    KM_PER_DEG_LAT *
    Math.max(0.25, Math.cos(latRad));

  const dLon =
    (distanceKmValue * Math.sin(bearingRad)) /
    lonScale;

  return {
    lat: lat + dLat,
    lon: lon + dLon,
  };
}

function makeTrackPoint(
  timeMs,
  lat,
  lon,
  headingDeg,
  speedKnots
) {
  return {
    time: new Date(timeMs).toISOString(),
    lat: toFixedNumber(lat, 5),
    lon: toFixedNumber(lon, 5),
    headingDeg: toFixedNumber(headingDeg, 1),
    speedKnots: toFixedNumber(speedKnots, 1),
  };
}

function buildTrack({
  name,
  type,
  imo,
  origin,
  startMs,
  releaseCenterMs,
  bearing,
  closestDistanceKm,
  closestOffsetHours,
  speedKnots,
  darkStartHours,
  darkDurationHours,
  rng,
}) {
  const stepHours = POINT_INTERVAL_HOURS;
  const stepMs = stepHours * 3600000;

  const closestTimeMs =
    releaseCenterMs +
    closestOffsetHours * 3600000;

  const closestPoint = destination(
    origin.lat,
    origin.lon,
    bearing + 180,
    closestDistanceKm
  );

  const track = [];

  for (let i = 0; i < TRACK_POINTS; i += 1) {
    const timeMs = startMs + i * stepMs;

    const hoursFromClosest =
      (timeMs - closestTimeMs) / 3600000;

    const travelKmPerHour =
      speedKnots * 1.852;

    const alongTrackKm =
      hoursFromClosest * travelKmPerHour;

    const point = destination(
      closestPoint.lat,
      closestPoint.lon,
      bearing,
      alongTrackKm
    );

    const jitterBearing = bearing + 90;

    const jitterKm =
      Math.sin(i * 0.73 + rng.rand() * 0.2) * 0.35;

    const jittered = destination(
      point.lat,
      point.lon,
      jitterBearing,
      jitterKm
    );

    const heading =
      bearing + rng.randFloat(-4, 4, 1);

    const hoursFromStart = i * stepHours;

    const inDarkPeriod =
      darkStartHours != null &&
      hoursFromStart >= darkStartHours &&
      hoursFromStart <
        darkStartHours + darkDurationHours;

    if (!inDarkPeriod) {
      track.push(
        makeTrackPoint(
          timeMs,
          jittered.lat,
          jittered.lon,
          ((heading % 360) + 360) % 360,
          speedKnots
        )
      );
    }
  }

  return {
    name,
    type,
    imo,
    track,
    darkPeriodHours:
      darkDurationHours || 0,
  };
}

function interpolateClosestApproach(
  track,
  origin
) {
  let best = null;

  for (let i = 0; i < track.length; i += 1) {
    const point = track[i];

    const distance = distanceKm(
      point.lat,
      point.lon,
      origin.lat,
      origin.lon
    );

    if (!best || distance < best.distanceKm) {
      best = {
        distanceKm: distance,
        point,
        index: i,
      };
    }
  }

  return best;
}

function timeDifferenceToReleaseHours(
  pointTime,
  releaseStartMs,
  releaseEndMs
) {
  const time =
    new Date(pointTime).getTime();

  if (
    time >= releaseStartMs &&
    time <= releaseEndMs
  ) {
    return 0;
  }

  if (time < releaseStartMs) {
    return (
      (releaseStartMs - time) /
      3600000
    );
  }

  return (
    (time - releaseEndMs) /
    3600000
  );
}

function evaluateTrack(
  vessel,
  origin,
  releaseTimeWindow,
  uncertaintyRadiusM
) {
  const releaseStartMs =
    new Date(
      releaseTimeWindow.start
    ).getTime();

  const releaseEndMs =
    new Date(
      releaseTimeWindow.end
    ).getTime();

  const closest =
    interpolateClosestApproach(
      vessel.track,
      origin
    );

  if (!closest) return null;

  const temporalDiffHours =
    timeDifferenceToReleaseHours(
      closest.point.time,
      releaseStartMs,
      releaseEndMs
    );

  const uncertaintyKm = Math.max(
    1,
    Number(uncertaintyRadiusM || 0) / 1000
  );

  // Spatial: exponential decay of distance-from-origin, e-folding over the
  // Step 4 reconstruction uncertainty radius itself (tighter reconstruction
  // -> stricter spatial matching). The AIS position floor keeps a
  // zero-distance match just under 1.0 rather than exactly at it.
  const spatialDecayScaleKm = Math.max(
    uncertaintyKm,
    SPATIAL_DECAY_MIN_SCALE_KM
  );
  const spatialScore = clamp(
    Math.exp(
      -(closest.distanceKm + AIS_POSITION_FLOOR_KM) /
        spatialDecayScaleKm
    ),
    0,
    1
  );

  const temporalScore = clamp(
    Math.exp(
      -(temporalDiffHours + AIS_TIME_FLOOR_HOURS) /
        TEMPORAL_DECAY_SCALE_HOURS
    ),
    0,
    1
  );

  const bearingToOrigin =
    bearingDeg(
      closest.point.lat,
      closest.point.lon,
      origin.lat,
      origin.lon
    );

  const headingDifference =
    angleDiff(
      closest.point.headingDeg,
      bearingToOrigin
    );

  const trajectoryScore = clamp(
    Math.exp(
      -(headingDifference + HEADING_FLOOR_DEG) /
        TRAJECTORY_DECAY_SCALE_DEG
    ),
    0,
    1
  );

  // AIS silence is evidence of reduced observability,
  // not proof of wrongdoing.
  const behaviouralScore = clamp(
    vessel.darkPeriodHours / 24,
    0,
    1
  );

  const composite =
    0.40 * spatialScore +
    0.25 * temporalScore +
    0.20 * trajectoryScore +
    0.15 * behaviouralScore;

  const withinOriginZone =
    closest.distanceKm <= uncertaintyKm;

  const plausible =
    closest.distanceKm <=
      MAX_RADIUS_KM &&
    temporalDiffHours <=
      MAX_TIME_DIFF_HOURS;

  return {
    name: vessel.name,
    type: vessel.type,
    imo: vessel.imo,

    lat: closest.point.lat,
    lon: closest.point.lon,

    distFromOrigin:
      toFixedNumber(
        closest.distanceKm,
        2
      ),

    closestApproachTime:
      closest.point.time,

    aisGapHours:
      toFixedNumber(
        vessel.darkPeriodHours,
        1
      ),

    spatialScore:
  toFixedNumber(
    spatialScore,
    4
  ),

temporalScore:
  toFixedNumber(
    temporalScore,
    4
  ),

behaviouralScore:
  toFixedNumber(
    behaviouralScore,
    4
  ),

sarMatchScore:
  toFixedNumber(
    trajectoryScore,
    4
  ),
    composite:
      toFixedNumber(
        composite,
        4
      ),

    withinOriginZone,

    temporalDifferenceHours:
      toFixedNumber(
        temporalDiffHours,
        2
      ),

    track: vessel.track,

    trackPointCount:
      vessel.track.length,

    plausible,
  };
}

export function identifyVessels({
  origin,
  releaseTimeWindow,
  aisSource,
  uncertaintyRadiusM,
  seed,
}) {
  const rng = createRng(
    deriveSeed(
      seed,
      'vessel-attribution'
    )
  );

  const windowStart =
    new Date(
      aisSource?.window?.start ??
        releaseTimeWindow.start
    ).getTime();

  const releaseStartMs =
    new Date(
      releaseTimeWindow.start
    ).getTime();

  const releaseEndMs =
    new Date(
      releaseTimeWindow.end
    ).getTime();

  const releaseCenterMs =
    (releaseStartMs +
      releaseEndMs) /
    2;

  const archetypes = [
    {
      role: 'strong-match',
      bearing: 35,
      closestDistanceKm: 5,
      closestOffsetHours: 0,
      speedKnots: 11,
      darkStartHours: null,
      darkDurationHours: 0,
    },

    {
      role: 'secondary-match',
      bearing: 120,
      closestDistanceKm: 13,
      closestOffsetHours: 5,
      speedKnots: 13,
      darkStartHours: null,
      darkDurationHours: 0,
    },

    {
      role: 'weak-match',
      bearing: 215,
      closestDistanceKm: 31,
      closestOffsetHours: -8,
      speedKnots: 10,
      darkStartHours: null,
      darkDurationHours: 0,
    },

    {
      role: 'ais-gap',
      bearing: 300,
      closestDistanceKm: 9,
      closestOffsetHours: 2,
      speedKnots: 12,
      darkStartHours: 22,
      darkDurationHours: 8,
    },

    {
      role: 'temporal-miss',
      bearing: 70,
      closestDistanceKm: 8,
      closestOffsetHours: 42,
      speedKnots: 9,
      darkStartHours: null,
      darkDurationHours: 0,
    },

    {
      role: 'spatial-miss',
      bearing: 165,
      closestDistanceKm: 62,
      closestOffsetHours: 0,
      speedKnots: 14,
      darkStartHours: null,
      darkDurationHours: 0,
    },

    {
      role: 'background',
      bearing: 250,
      closestDistanceKm: 78,
      closestOffsetHours: -22,
      speedKnots: 12,
      darkStartHours: null,
      darkDurationHours: 0,
    },

    {
      role: 'background',
      bearing: 10,
      closestDistanceKm: 95,
      closestOffsetHours: 18,
      speedKnots: 16,
      darkStartHours: null,
      darkDurationHours: 0,
    },

    {
      role: 'background',
      bearing: 190,
      closestDistanceKm: 70,
      closestOffsetHours: 55,
      speedKnots: 8,
      darkStartHours: null,
      darkDurationHours: 0,
    },
  ];

  const tracks =
    archetypes
      .slice(0, TRACK_COUNT)
      .map((spec, index) => {
        return buildTrack({
          ...spec,

          name:
            VESSEL_NAMES[index],

          type:
            VESSEL_TYPES[
              index %
                VESSEL_TYPES.length
            ],

          imo:
            `IMO ${rng.randInt(
              8000000,
              9999999
            )}`,

          origin,

          startMs:
            windowStart,

          releaseCenterMs,

          rng,
        });
      });

  const evaluated =
    tracks
      .map((track) =>
        evaluateTrack(
          track,
          origin,
          releaseTimeWindow,
          uncertaintyRadiusM
        )
      )
      .filter(Boolean);

  const plausible =
    evaluated
      .filter(
        (vessel) =>
          vessel.plausible
      )
      .sort(
        (a, b) =>
          b.composite -
          a.composite
      );

  const filteredOutCount =
    evaluated.length -
    plausible.length;

  const candidates =
    plausible.slice(
      0,
      MAX_CANDIDATES
    );

  return {
    candidates,
    filteredOutCount,
    tracksConsidered:
      tracks.length,
  };
}