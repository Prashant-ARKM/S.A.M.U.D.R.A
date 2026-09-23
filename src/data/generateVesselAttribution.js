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
  speedAnomaly,
  loiterHours,
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
  const slowSpeedKnots = toFixedNumber(speedKnots * 0.22, 1);

  for (let i = 0; i < TRACK_POINTS; i += 1) {
    const timeMs = startMs + i * stepMs;

    const hoursFromClosest =
      (timeMs - closestTimeMs) / 3600000;

    // Position always follows the nominal cruise speed, so the track path
    // itself stays continuous — behavioural anomalies below only affect
    // the *reported speed value* and, for loitering, a local cluster, not
    // a physically re-integrated slower trajectory (this is a display
    // mock, not a kinematics simulator).
    const travelKmPerHour = speedKnots * 1.852;

    const inLoiterWindow =
      loiterHours > 0 &&
      Math.abs(hoursFromClosest) <= loiterHours / 2;

    let alongTrackKm = hoursFromClosest * travelKmPerHour;
    if (inLoiterWindow) alongTrackKm = 0; // pinned near the closest-approach point while loitering

    const point = destination(
      closestPoint.lat,
      closestPoint.lon,
      bearing,
      alongTrackKm
    );

    const jitterBearing = bearing + 90;

    const jitterKm = inLoiterWindow
      ? Math.sin(i * 1.6 + rng.rand() * 0.3) * 1.1 // wider circling jitter while loitering
      : Math.sin(i * 0.73 + rng.rand() * 0.2) * 0.35;

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

    let pointSpeed = speedKnots;
    if (inLoiterWindow) pointSpeed = rng.randFloat(0.8, 2.2, 1);
    else if (speedAnomaly && Math.abs(hoursFromClosest) <= stepHours * 1.01) pointSpeed = slowSpeedKnots;

    if (!inDarkPeriod) {
      track.push(
        makeTrackPoint(
          timeMs,
          jittered.lat,
          jittered.lon,
          ((heading % 360) + 360) % 360,
          pointSpeed
        )
      );
    }
  }

  const observedWindowHours = (TRACK_POINTS - 1) * stepHours;
  const closestFromStartHours = (closestTimeMs - startMs) / 3600000;

  return {
    name,
    type,
    imo,
    track,
    darkPeriodHours:
      darkDurationHours || 0,
    darkStartHours: darkStartHours ?? null,
    speedAnomaly: !!speedAnomaly,
    speedAnomalyFromKnots: speedAnomaly ? speedKnots : null,
    speedAnomalyToKnots: speedAnomaly ? slowSpeedKnots : null,
    loiterHours: loiterHours || 0,
    // Behaviour-flag positions, all expressed as hours-from-observation-
    // window-start, so the UI can lay them directly onto one timeline.
    timeline: {
      totalHours: observedWindowHours,
      darkStartHours: darkStartHours ?? null,
      darkDurationHours: darkDurationHours || 0,
      loiterStartHours: loiterHours > 0 ? clampHours(closestFromStartHours - loiterHours / 2, observedWindowHours) : null,
      loiterDurationHours: loiterHours || 0,
      speedAnomalyAtHours: speedAnomaly ? clampHours(closestFromStartHours, observedWindowHours) : null,
    },
  };
}

function clampHours(h, max) {
  return Math.min(max, Math.max(0, h));
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

function relJitter(rng, value, pct) {
  return value * (1 + rng.randFloat(-pct, pct, 3));
}

// Perturbs every scenario archetype's geometry (bearing, distance, timing,
// speed, and behaviour-flag durations) so no two triggered incidents place
// a vessel at literally identical numbers — while clamping distance/timing
// so a role never accidentally crosses the plausibility thresholds
// (MAX_RADIUS_KM / MAX_TIME_DIFF_HOURS) that define its intended outcome
// (a "strong match" should never jitter into implausible, and a
// "spatial-miss" should never accidentally jitter into plausible).
function jitterArchetype(rng, a) {
  const distance = Math.max(0.4, relJitter(rng, a.closestDistanceKm, 0.18));
  const offset = a.closestOffsetHours + rng.randFloat(-2.5, 2.5, 1);

  // Only the two archetypes whose base geometry itself already flexes
  // (strong/secondary-match, tightened when unknownSourceScenario is
  // active) need a safety clamp — everything else's jitter range was
  // chosen to never cross MAX_RADIUS_KM/MAX_TIME_DIFF_HOURS in the first
  // place.
  const clampedDistance = a.role === 'strong-match' || a.role === 'secondary-match'
    ? Math.min(distance, MAX_RADIUS_KM - 2)
    : distance;
  const clampedOffset = a.role === 'strong-match' || a.role === 'secondary-match'
    ? Math.max(-(MAX_TIME_DIFF_HOURS - 1), Math.min(MAX_TIME_DIFF_HOURS - 1, offset))
    : offset;

  return {
    ...a,
    bearing: (a.bearing + rng.randFloat(-10, 10, 1) + 360) % 360,
    closestDistanceKm: parseFloat(clampedDistance.toFixed(2)),
    closestOffsetHours: parseFloat(clampedOffset.toFixed(1)),
    speedKnots: parseFloat(Math.max(2, relJitter(rng, a.speedKnots, 0.15)).toFixed(1)),
    darkDurationHours: a.darkDurationHours > 0 ? parseFloat(Math.max(2, relJitter(rng, a.darkDurationHours, 0.3)).toFixed(1)) : 0,
    darkStartHours: a.darkStartHours != null ? Math.max(0, parseFloat((a.darkStartHours + rng.randFloat(-3, 3, 1)).toFixed(1))) : null,
    loiterHours: a.loiterHours > 0 ? parseFloat(Math.max(1, relJitter(rng, a.loiterHours, 0.25)).toFixed(1)) : 0,
  };
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

  // AIS silence, an abrupt slow-down right at closest approach, and
  // loitering near the origin window are the three behavioural red flags
  // called out in the problem statement — each is weighted by how
  // suspicious it is on its own, not just summed uncritically.
  const gapScore = clamp(vessel.darkPeriodHours / 24, 0, 1);
  const speedAnomalyScore = vessel.speedAnomaly ? 0.75 : 0;
  const loiterScore = clamp((vessel.loiterHours || 0) / 10, 0, 1);
  const behaviouralScore = clamp(
    0.5 * gapScore + 0.3 * speedAnomalyScore + 0.2 * loiterScore,
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

    speedAnomaly: vessel.speedAnomaly,
    speedAnomalyFromKnots: vessel.speedAnomalyFromKnots,
    speedAnomalyToKnots: vessel.speedAnomalyToKnots,
    loiterHours: toFixedNumber(vessel.loiterHours || 0, 1),
    timeline: vessel.timeline,

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

headingScore:
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

  // ~28% of incidents: no vessel genuinely matches well — the illegal
  // discharge vessel simply wasn't transmitting usable AIS, or this
  // wasn't a vessel source at all. Decided purely from the seed, so it's
  // reproducible, not from a real absence of data.
  const unknownSourceScenario = rng.rand() < 0.28;

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

  // Every archetype below also gets a seeded jitter pass (jitterArchetype)
  // before building tracks — without it, "strong-match" would land at
  // *exactly* the same 5km/0h geometry on every single triggered incident,
  // which reads as suspiciously repetitive rather than like independent
  // AIS tracks.
  const archetypes = [
    {
      role: 'strong-match',
      bearing: 35,
      closestDistanceKm: unknownSourceScenario ? rng.randFloat(28, 40, 1) : 5,
      closestOffsetHours: unknownSourceScenario ? rng.randFloat(11, 19, 1) : 0,
      speedKnots: 11,
      darkStartHours: null,
      darkDurationHours: 0,
      speedAnomaly: true, // sharp slow-down right at closest approach — classic discharge-maneuvering signature
      loiterHours: 0,
    },

    {
      role: 'secondary-match',
      bearing: 120,
      closestDistanceKm: unknownSourceScenario ? rng.randFloat(33, 44, 1) : 13,
      closestOffsetHours: unknownSourceScenario ? rng.randFloat(-21, -11, 1) : 5,
      speedKnots: 13,
      darkStartHours: null,
      darkDurationHours: 0,
      speedAnomaly: false,
      loiterHours: unknownSourceScenario ? 0 : 5, // circled near the origin for ~5h
    },

    {
      role: 'weak-match',
      bearing: 215,
      closestDistanceKm: 31,
      closestOffsetHours: -8,
      speedKnots: 10,
      darkStartHours: null,
      darkDurationHours: 0,
      speedAnomaly: false,
      loiterHours: 0,
    },

    {
      role: 'ais-gap',
      bearing: 300,
      closestDistanceKm: 9,
      closestOffsetHours: 2,
      speedKnots: 12,
      darkStartHours: 22,
      darkDurationHours: 8,
      speedAnomaly: false,
      loiterHours: 0,
    },

    {
      role: 'temporal-miss',
      bearing: 70,
      closestDistanceKm: 8,
      closestOffsetHours: 42,
      speedKnots: 9,
      darkStartHours: null,
      darkDurationHours: 0,
      speedAnomaly: false,
      loiterHours: 0,
    },

    {
      role: 'spatial-miss',
      bearing: 165,
      closestDistanceKm: 62,
      closestOffsetHours: 0,
      speedKnots: 14,
      darkStartHours: null,
      darkDurationHours: 0,
      speedAnomaly: false,
      loiterHours: 0,
    },

    {
      role: 'background',
      bearing: 250,
      closestDistanceKm: 78,
      closestOffsetHours: -22,
      speedKnots: 12,
      darkStartHours: null,
      darkDurationHours: 0,
      speedAnomaly: false,
      loiterHours: 0,
    },

    {
      role: 'background',
      bearing: 10,
      closestDistanceKm: 95,
      closestOffsetHours: 18,
      speedKnots: 16,
      darkStartHours: null,
      darkDurationHours: 0,
      speedAnomaly: false,
      loiterHours: 0,
    },

    {
      role: 'background',
      bearing: 190,
      closestDistanceKm: 70,
      closestOffsetHours: 55,
      speedKnots: 8,
      darkStartHours: null,
      darkDurationHours: 0,
      speedAnomaly: false,
      loiterHours: 0,
    },
  ];

  const tracks =
    archetypes
      .map((spec) => jitterArchetype(rng, spec))
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