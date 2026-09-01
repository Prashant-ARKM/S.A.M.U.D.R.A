import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import SectionCard from './SectionCard';

const COLORS = {
  spatial: '#0EA5B7',
  temporal: '#7c3aed',
  behavioural: '#D97706',
  sarMatch: '#16A34A',
};

function ScoreBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-[#6B7280]">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-[#F3F4F6]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="mono w-12 text-right text-xs text-[#374151]">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
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

export default function Section7_EvidenceFusion({ data, status }) {
  if (!data) return <SectionCard number={7} title="Evidence Fusion & Hypothesis" status="Pending"><div className="h-20" /></SectionCard>;

  const { rankedCandidates, mostProbableCandidate, fusionUncertainty } = data;

  const chartData = rankedCandidates.map((v) => ({
    name: v.name.split(' ').slice(-1)[0], // short name
    fullName: v.name,
    spatial: v.spatialScore,
    temporal: v.temporalScore,
    behavioural: v.behaviouralScore,
    sarMatch: v.sarMatchScore,
  }));

  return (
    <SectionCard number={7} title="Evidence Fusion & Hypothesis" status={status}>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Chart + ranked list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
              Relative Evidence Scores per Candidate — Weighted: 0.40·Spatial + 0.25·Temporal + 0.20·SAR/Trajectory + 0.15·Behavioural
            </span>
            <div className="mt-2 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="spatial" name="Spatial" fill={COLORS.spatial} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="temporal" name="Temporal" fill={COLORS.temporal} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="behavioural" name="Behavioural" fill={COLORS.behavioural} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="sarMatch" name="Trajectory / SAR" fill={COLORS.sarMatch} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ranked suspects — every surviving candidate, not just the top one */}
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Ranked Suspects</span>
            <div className="mt-2 space-y-2">
              {rankedCandidates.map((v, i) => (
                <div key={v.imo} className="rounded-lg border border-[#E2E5EA] bg-white p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#374151]">
                      #{i + 1} {v.name} <span className="mono font-normal text-[#9CA3AF]">{v.imo}</span>
                    </span>
                    <span className="mono text-xs font-semibold text-[#0EA5B7]">{(v.finalScore * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">{v.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Most Probable Candidate + uncertainty */}
        <div className="space-y-3">
          <div className="rounded-lg border border-[#A5F3FC] bg-[#ECFEFF] p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[#0EA5B7]">🎯</span>
              <span className="text-xs font-semibold text-[#0E7490] uppercase tracking-wider">Most Probable Candidate</span>
            </div>
            <p className="text-sm font-semibold text-[#1A1D23]">{mostProbableCandidate.name}</p>
            <p className="mono text-xs text-[#6B7280]">{mostProbableCandidate.imo}</p>

            <div className="mt-3 space-y-2">
              <ScoreBar label="Spatial" value={mostProbableCandidate.spatialScore} color={COLORS.spatial} />
              <ScoreBar label="Temporal" value={mostProbableCandidate.temporalScore} color={COLORS.temporal} />
              <ScoreBar label="Behavioural" value={mostProbableCandidate.behaviouralScore} color={COLORS.behavioural} />
              <ScoreBar label="Trajectory / SAR" value={mostProbableCandidate.sarMatchScore} color={COLORS.sarMatch} />
            </div>

            <div className="mt-3 rounded-lg border border-[#E2E5EA] bg-white p-2.5">
              <p className="text-xs text-[#6B7280]">
                Association score: <span className="mono font-semibold text-[#0EA5B7]">{(mostProbableCandidate.finalScore * 100).toFixed(1)}%</span>
              </p>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#6B7280]">
              <span className="font-semibold text-[#374151]">{mostProbableCandidate.name}</span> ranks highest because it is{' '}
              {mostProbableCandidate.reason} This is a statistically probable association, not a definitive attribution — the ranking
              reflects available evidence, not a finding of fault.
            </p>
          </div>

          <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 space-y-2">
            <p className="text-xs font-semibold text-[#B45309]">⚠ Uncertainty &amp; Limitations</p>
            <p className="text-xs text-[#92400E]">
              Backward reconstruction confidence: <span className="mono">{(fusionUncertainty.reconstructionConfidence * 100).toFixed(0)}%</span>{' '}
              (±{(fusionUncertainty.uncertaintyRadiusM / 1000).toFixed(1)} km origin uncertainty). Forward forecast confidence:{' '}
              <span className="mono">{(fusionUncertainty.forecastConfidence * 100).toFixed(0)}%</span>.
            </p>
            <p className="text-xs text-[#92400E]">
              AIS dataset coverage: <span className="mono">{fusionUncertainty.aisCoverage}%</span> ({fusionUncertainty.aisStatus}). Dark
              periods and coverage gaps mean some vessels may be under- or over-scored.
            </p>
            <p className="text-xs text-[#B45309]">
              Vessels without functioning or transmitting AIS are not captured by this analysis at all and cannot be ruled in or out.
            </p>
          </div>

          <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
            <p className="text-xs text-[#B45309]">
              <span className="font-semibold">⚠ Disclaimer:</span> This is an AI-generated decision-support hypothesis.
              It does not constitute legal evidence, regulatory compliance, or a determination of liability.
              All findings require independent verification by qualified investigators.
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}