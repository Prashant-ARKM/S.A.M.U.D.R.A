// SAMUDRA — Step 7: Evidence Fusion & Hypothesis
//
// Decision-support only — never a guilt declaration. Combines the Step 6
// per-candidate evidence scores with the Step 4 reconstruction confidence
// and Step 5 forecast confidence into one final association score per
// surviving candidate, ranks them, and reports the reasons + uncertainty
// explicitly rather than presenting a single verdict.
//
// Every score here is a function of existing Step 3–6 outputs — nothing is
// drawn independently.
//
// Interface: fuseEvidence({ candidates, reconstructionConfidence,
// forecastConfidence, uncertaintyRadiusM, aisSource }) -> { ranked,
// mostProbable, sourceStatus, closestLead, uncertainty }

// Below this final-score threshold, the evidence is too weak to call it an
// attribution — the highest-ranked candidate is still surfaced (as
// `closestLead`), but explicitly NOT as `mostProbable`. This is what makes
// an honest "source unknown" outcome possible instead of always forcing a
// pick.
const ATTRIBUTION_CONFIDENCE_THRESHOLD = 0.42;

function describeLevel(value, labels) {
  if (value >= 0.7) return labels[0];
  if (value >= 0.4) return labels[1];
  return labels[2];
}

function buildReason(c) {
  const proximity = describeLevel(c.spatialScore, ['close to', 'moderately near', 'far from']);
  const timing = describeLevel(c.temporalScore, ['tightly aligned with', 'roughly aligned with', 'loosely aligned with']);
  const heading = describeLevel(c.headingScore, ['heading consistent with', 'heading partly consistent with', 'heading inconsistent with']);
  return `${proximity} the reconstructed origin (${c.distFromOrigin}km), ${timing} the release window, with a ${c.aisGapHours}h AIS gap and ${heading} the spill bearing.`;
}

export function fuseEvidence({ candidates, reconstructionConfidence, forecastConfidence, uncertaintyRadiusM, aisSource }) {
  // Weak backward/forward reconstruction should temper confidence in ANY
  // vessel association, without overriding the AIS-evidence-based ranking
  // itself — a modest scaling factor, not a separate independent score.
  const avgReconstructionConfidence = (reconstructionConfidence + forecastConfidence) / 2;
  const fusionFactor = 0.85 + 0.15 * avgReconstructionConfidence;

  const ranked = candidates
    .map((c) => ({
      ...c,
      finalScore: parseFloat(Math.min(0.98, c.composite * fusionFactor).toFixed(4)),
      reason: buildReason(c),
    }))
    .sort((a, b) => b.finalScore - a.finalScore);

  const closestLead = ranked[0] || null;
  const sourceStatus = closestLead && closestLead.finalScore >= ATTRIBUTION_CONFIDENCE_THRESHOLD ? 'attributed' : 'unknown';
  const mostProbable = sourceStatus === 'attributed' ? closestLead : null;

  const uncertainty = {
    reconstructionConfidence,
    forecastConfidence,
    uncertaintyRadiusM,
    aisCoverage: aisSource?.coverage,
    aisStatus: aisSource?.status,
  };

  return { ranked, mostProbable, sourceStatus, closestLead, uncertainty };
}