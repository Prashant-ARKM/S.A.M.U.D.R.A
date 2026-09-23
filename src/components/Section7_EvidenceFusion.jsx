import SectionCard from './SectionCard';

const DIMENSIONS = [
  { key: 'spatialScore', label: 'Spatial — how close it was to the origin', color: '#167EAD' },
  { key: 'temporalScore', label: 'Temporal — how well the timing lines up', color: '#7c3aed' },
  { key: 'headingScore', label: 'Heading — whether its course matches', color: '#287A5D' },
  { key: 'behaviouralScore', label: 'Behaviour — AIS gaps, loitering, speed drops', color: '#B77B18' },
];

// Simple horizontal bar — same visual language as Section 3's
// Classification Confidence bars, reused here on purpose so the whole app
// only has one way of showing "a score out of 100%".
function Bar({ label, value, color, size = 'normal' }) {
  const big = size === 'big';
  return (
    <div className="flex items-center gap-2">
      <span className={`${big ? 'w-40 text-xs' : 'w-16 text-[11px]'} shrink-0 text-[#607580]`}>{label}</span>
      <div className={`${big ? 'h-3' : 'h-2'} flex-1 rounded-full bg-[#EDF3F6]`}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(2, value * 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className={`mono ${big ? 'w-12 text-xs' : 'w-9 text-[10px]'} shrink-0 text-right font-semibold text-[#172A35]`}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

const CF_STYLE = {
  consistent: { icon: '✓', className: 'bg-green-50 text-green-700 border-green-200' },
  partial: { icon: '~', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  inconsistent: { icon: '✗', className: 'bg-red-50 text-red-700 border-red-200' },
};

function CounterfactualChip({ cf }) {
  if (!cf) return null;
  const style = CF_STYLE[cf.verdict] || CF_STYLE.inconsistent;
  const title = cf.note
    ? cf.note
    : `Hypothetical release forward-drifted ${cf.elapsedHours}h landed ${cf.distanceFromObservedKm}km from the observed slick (${cf.overlapScore}% overlap).`;
  return (
    <span title={title} className={`mono inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${style.className}`}>
      🔄 {style.icon} {cf.overlapScore}%
    </span>
  );
}

// Small icon row for the behavioural red flags — same data Section 6's
// timeline bar uses, just condensed to glanceable icons here.
function FlagIcons({ v }) {
  const flags = [];
  if (v.aisGapHours > 0) flags.push({ icon: '📡', title: `AIS Gap: ${v.aisGapHours}h dark` });
  if (v.speedAnomaly) flags.push({ icon: '⚡', title: `Speed dropped ${v.speedAnomalyFromKnots}kn → ${v.speedAnomalyToKnots}kn` });
  if (v.loiterHours > 0) flags.push({ icon: '⚓', title: `Loitered ${v.loiterHours}h near origin` });
  if (!flags.length) return <span className="text-[10px] text-[#8497A3]">No red flags</span>;
  return (
    <div className="flex items-center gap-1">
      {flags.map((f, i) => (
        <span key={i} title={f.title} className="cursor-help text-sm leading-none">{f.icon}</span>
      ))}
    </div>
  );
}

export default function Section7_EvidenceFusion({ data, status }) {
  if (!data) return <SectionCard number={7} title="Evidence Fusion & Hypothesis" status="Pending"><div className="h-20" /></SectionCard>;

  const { rankedCandidates, mostProbableCandidate, sourceStatus, closestLead, fusionUncertainty, counterfactuals } = data;
  const counterfactualByImo = Object.fromEntries((counterfactuals || []).map((cf) => [cf.imo, cf]));
  const topPick = sourceStatus === 'attributed' ? mostProbableCandidate : closestLead;

  return (
    <SectionCard number={7} title="Evidence Fusion & Hypothesis" status={status}>
      {/* Headline verdict — one clear sentence before any numbers */}
      <div className={`rounded-lg border p-4 ${sourceStatus === 'attributed' ? 'border-[#BFDCEA] bg-[#EAF4FA]' : 'border-[#D3DEE4] bg-[#EDF3F6]'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#12344A]">
              {sourceStatus === 'attributed' ? '🎯 Most Probable Candidate' : '❓ Source Unknown'}
            </span>
            {topPick && (
              <>
                <h3 className="mt-1 text-lg font-bold text-[#172A35]">{topPick.name}</h3>
                <p className="mono text-xs text-[#607580]">{topPick.imo}</p>
              </>
            )}
          </div>
          {topPick && (
            <div className="text-right">
              <span className="mono text-2xl font-bold text-[#167EAD]">{(topPick.finalScore * 100).toFixed(0)}%</span>
              <p className="text-[10px] uppercase tracking-wider text-[#8497A3]">{sourceStatus === 'attributed' ? 'association score' : 'best available match'}</p>
            </div>
          )}
        </div>

        {sourceStatus !== 'attributed' && (
          <p className="mt-2 text-xs leading-relaxed text-[#607580]">
            No candidate clears the confidence bar needed to call this an attribution — the discharging vessel may not have
            been transmitting usable AIS, or this may not be a vessel-sourced spill at all.
            {topPick && ' The closest partial lead is shown above, but it is explicitly not attributed.'}
          </p>
        )}

        {topPick && counterfactualByImo[topPick.imo]?.verdict === 'inconsistent' && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2">
            <p className="text-xs font-semibold text-red-700">⚠ Contradicting evidence</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-red-700">
              This vessel ranks highest on AIS evidence, but an independent check — forward-drifting its own reported
              position — does NOT reach the observed slick. The two methods disagree; treat this ranking with caution.
            </p>
          </div>
        )}

        {topPick && (
          <>
            {/* Why this ranking — the four factors, as plain bars, in the exact weights used */}
            <div className="mt-4 space-y-2 rounded-lg border border-[#D3DEE4] bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Why it ranks here</p>
              {DIMENSIONS.map((d) => (
                <Bar key={d.key} label={d.label} value={topPick[d.key]} color={d.color} size="big" />
              ))}
              <p className="mt-1 text-[11px] leading-relaxed text-[#8497A3]">
                These four bars are combined by weight (Spatial counts most, then Temporal, Heading, Behaviour) into a
                single {(topPick.composite * 100).toFixed(0)}% evidence score, then scaled down slightly to reflect how
                confident Step 4's origin estimate itself was — giving the {(topPick.finalScore * 100).toFixed(0)}%
                shown above.
              </p>
            </div>
            <div className="mt-2">
              <CounterfactualChip cf={counterfactualByImo[topPick.imo]} />
            </div>
          </>
        )}
      </div>

      {/* Everyone else considered — simple, one bar each */}
      {rankedCandidates.length > 1 && (
        <div className="mt-4 rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#607580]">All Candidates Considered</span>
          <div className="mt-2 space-y-2">
            {rankedCandidates.map((v, i) => (
              <div key={v.imo} className={`flex items-center gap-3 rounded-lg border bg-white p-2.5 ${topPick && v.imo === topPick.imo ? 'border-[#167EAD]' : 'border-[#D3DEE4]'}`}>
                <span className="mono w-5 shrink-0 text-center text-[10px] font-bold text-[#8497A3]">{i + 1}</span>
                <div className="w-40 shrink-0">
                  <p className="truncate text-xs font-semibold text-[#172A35]">{v.name}</p>
                  <p className="mono text-[9px] text-[#8497A3]">{v.imo}</p>
                </div>
                <div className="flex-1">
                  <Bar label="" value={v.finalScore} color={i === 0 ? '#167EAD' : '#8497A3'} />
                </div>
                <FlagIcons v={v} />
                <CounterfactualChip cf={counterfactualByImo[v.imo]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uncertainty + disclaimer */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 space-y-2">
          <p className="text-xs font-semibold text-[#8C6112]">⚠ Uncertainty &amp; Limitations</p>
          <p className="flex items-start gap-1.5 text-xs text-[#6B460F]">
            <span>📉</span>
            <span>
              Backward reconstruction confidence: <span className="mono">{(fusionUncertainty.reconstructionConfidence * 100).toFixed(0)}%</span>{' '}
              (±{(fusionUncertainty.uncertaintyRadiusM / 1000).toFixed(1)} km origin uncertainty).
            </span>
          </p>
          <p className="flex items-start gap-1.5 text-xs text-[#6B460F]">
            <span>📶</span>
            <span>
              AIS dataset coverage: <span className="mono">{fusionUncertainty.aisCoverage}%</span> ({fusionUncertainty.aisStatus}).
              Dark periods and coverage gaps mean some vessels may be under- or over-scored.
            </span>
          </p>
          <p className="flex items-start gap-1.5 text-xs text-[#8C6112]">
            <span>🚫</span>
            <span>Vessels without functioning AIS are not captured by this analysis at all.</span>
          </p>
        </div>

        <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
          <p className="flex items-start gap-1.5 text-xs text-[#8C6112]">
            <span>⚖️</span>
            <span>
              <span className="font-semibold">Disclaimer:</span> This is an AI-generated decision-support hypothesis.
              It does not constitute legal evidence, regulatory compliance, or a determination of liability.
              All findings require independent verification by qualified investigators.
            </span>
          </p>
        </div>
      </div>
    </SectionCard>
  );
}