import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import SectionCard from './SectionCard';

const COLORS = {
  spatial: '#0EA5B7',
  temporal: '#7c3aed',
  heading: '#16A34A',
  behavioural: '#D97706',
};
const RADAR_COLORS = ['#0EA5B7', '#7c3aed', '#D97706'];
const DIMENSIONS = ['Spatial', 'Temporal', 'Heading', 'Behavioural'];

function shortName(name) {
  return name.split(' ').slice(-1)[0];
}

// Circular progress ring — the dashboard-style stand-in for the old flat
// bar, used both for each candidate's overall score and for the four
// evidence sub-scores.
function ScoreRing({ value, size = 56, stroke = 6, color, label }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, value)));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.7s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="mono font-semibold" style={{ color, fontSize: size * 0.26 }}>
            {Math.round(value * 100)}
          </span>
        </div>
      </div>
      {label && <span className="text-center text-[10px] leading-tight text-[#6B7280]">{label}</span>}
    </div>
  );
}

const CustomRadarTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-[#E2E5EA] bg-white p-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-[#1A1D23]">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="mono">
          {entry.name}: {entry.value.toFixed(2)}
        </p>
      ))}
    </div>
  );
};

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
  if (!flags.length) return <span className="text-[10px] text-[#9CA3AF]">No red flags</span>;
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

  const radarData = DIMENSIONS.map((dim, i) => {
    const row = { dimension: dim };
    rankedCandidates.slice(0, 3).forEach((v) => {
      row[shortName(v.name)] = [v.spatialScore, v.temporalScore, v.headingScore, v.behaviouralScore][i];
    });
    return row;
  });

  return (
    <SectionCard number={7} title="Evidence Fusion & Hypothesis" status={status}>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Radar comparison + ranked cards */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
              Evidence Profile — Top {Math.min(3, rankedCandidates.length)} Candidates · Weighted 0.40·Spatial + 0.25·Temporal + 0.20·Heading + 0.15·Behavioural
            </span>
            <div className="mt-2 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#E2E5EA" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: '#6B7280', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 1]} tickCount={3} tick={{ fill: '#9CA3AF', fontSize: 9 }} axisLine={false} />
                  {rankedCandidates.slice(0, 3).map((v, i) => (
                    <Radar
                      key={v.imo}
                      name={v.name}
                      dataKey={shortName(v.name)}
                      stroke={RADAR_COLORS[i]}
                      fill={RADAR_COLORS[i]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip content={<CustomRadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ranked suspects — card grid, every surviving candidate */}
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Ranked Suspects</span>
              <span className="text-[10px] text-[#9CA3AF]">🔄 = counterfactual drift check</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {rankedCandidates.map((v, i) => (
                <div key={v.imo} className="flex items-start gap-3 rounded-lg border border-[#E2E5EA] bg-white p-3">
                  <div className="relative shrink-0">
                    <ScoreRing value={v.finalScore} size={52} stroke={5} color={i === 0 ? '#0EA5B7' : '#9CA3AF'} />
                    <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1D23] text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#374151]">{v.name}</p>
                    <p className="mono text-[10px] text-[#9CA3AF]">{v.imo}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <FlagIcons v={v} />
                      <CounterfactualChip cf={counterfactualByImo[v.imo]} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Most Probable Candidate + uncertainty */}
        <div className="space-y-3">
          {sourceStatus === 'attributed' ? (
            <div className="rounded-lg border border-[#A5F3FC] bg-[#ECFEFF] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[#0EA5B7]">🎯</span>
                <span className="text-xs font-semibold text-[#0E7490] uppercase tracking-wider">Most Probable Candidate</span>
              </div>

              <div className="flex items-center gap-3">
                <ScoreRing value={mostProbableCandidate.finalScore} size={72} stroke={7} color="#0EA5B7" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1A1D23]">{mostProbableCandidate.name}</p>
                  <p className="mono text-xs text-[#6B7280]">{mostProbableCandidate.imo}</p>
                  <div className="mt-1"><CounterfactualChip cf={counterfactualByImo[mostProbableCandidate.imo]} /></div>
                </div>
              </div>

              {counterfactualByImo[mostProbableCandidate.imo]?.verdict === 'inconsistent' && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2">
                  <p className="text-xs font-semibold text-red-700">⚠ Contradicting evidence</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-red-700">
                    This vessel ranks highest on AIS/spatial/temporal evidence, but the counterfactual drift check does NOT
                    reach the observed slick from its own reported position — the two methods disagree. Treat this ranking
                    with extra caution pending investigator review.
                  </p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-4 gap-1">
                <ScoreRing value={mostProbableCandidate.spatialScore} size={48} stroke={4} color={COLORS.spatial} label="Spatial" />
                <ScoreRing value={mostProbableCandidate.temporalScore} size={48} stroke={4} color={COLORS.temporal} label="Temporal" />
                <ScoreRing value={mostProbableCandidate.headingScore} size={48} stroke={4} color={COLORS.heading} label="Heading" />
                <ScoreRing value={mostProbableCandidate.behaviouralScore} size={48} stroke={4} color={COLORS.behavioural} label="Behaviour" />
              </div>

              <div className="mt-3 rounded-lg border border-[#E2E5EA] bg-white p-2.5">
                <p className="text-xs text-[#6B7280]">
                  Composite evidence: <span className="mono">{(mostProbableCandidate.composite * 100).toFixed(1)}%</span> × reconstruction-confidence adjustment
                </p>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  Association score: <span className="mono font-semibold text-[#0EA5B7]">{(mostProbableCandidate.finalScore * 100).toFixed(1)}%</span>
                </p>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-[#6B7280]">
                <span className="font-semibold text-[#374151]">{mostProbableCandidate.name}</span> ranks highest because it is{' '}
                {mostProbableCandidate.reason} This is a statistically probable association, not a definitive attribution — the ranking
                reflects available evidence, not a finding of fault.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[#6B7280]">❓</span>
                <span className="text-xs font-semibold text-[#374151] uppercase tracking-wider">Source Unknown</span>
              </div>
              <p className="text-xs leading-relaxed text-[#6B7280]">
                No candidate vessel meets the confidence threshold for attribution. This may mean the discharging vessel was not
                transmitting usable AIS at the time, or that this was not a vessel-sourced spill at all.
              </p>
              {closestLead && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#E2E5EA] bg-white p-2.5">
                  <ScoreRing value={closestLead.finalScore} size={48} stroke={5} color="#9CA3AF" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#9CA3AF]">Closest partial match — not attributed</p>
                    <p className="truncate text-sm font-semibold text-[#374151]">{closestLead.name}</p>
                    <p className="mono text-xs text-[#9CA3AF]">{closestLead.imo}</p>
                    <div className="mt-1"><CounterfactualChip cf={counterfactualByImo[closestLead.imo]} /></div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 space-y-2">
            <p className="text-xs font-semibold text-[#B45309]">⚠ Uncertainty &amp; Limitations</p>
            <p className="flex items-start gap-1.5 text-xs text-[#92400E]">
              <span>📉</span>
              <span>
                Backward reconstruction confidence: <span className="mono">{(fusionUncertainty.reconstructionConfidence * 100).toFixed(0)}%</span>{' '}
                (±{(fusionUncertainty.uncertaintyRadiusM / 1000).toFixed(1)} km origin uncertainty). Forward forecast confidence:{' '}
                <span className="mono">{(fusionUncertainty.forecastConfidence * 100).toFixed(0)}%</span>.
              </span>
            </p>
            <p className="flex items-start gap-1.5 text-xs text-[#92400E]">
              <span>📶</span>
              <span>
                AIS dataset coverage: <span className="mono">{fusionUncertainty.aisCoverage}%</span> ({fusionUncertainty.aisStatus}). Dark
                periods and coverage gaps mean some vessels may be under- or over-scored.
              </span>
            </p>
            <p className="flex items-start gap-1.5 text-xs text-[#B45309]">
              <span>🚫</span>
              <span>Vessels without functioning or transmitting AIS are not captured by this analysis at all and cannot be ruled in or out.</span>
            </p>
          </div>

          <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
            <p className="flex items-start gap-1.5 text-xs text-[#B45309]">
              <span>⚖️</span>
              <span>
                <span className="font-semibold">Disclaimer:</span> This is an AI-generated decision-support hypothesis.
                It does not constitute legal evidence, regulatory compliance, or a determination of liability.
                All findings require independent verification by qualified investigators.
              </span>
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}