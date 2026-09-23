import SectionCard from './SectionCard';

export default function Section5_ForwardDriftTrace({ data, status, onViewMap }) {
  if (!data) return <SectionCard number={5} title="Forward Drift Trace" status="Pending"><div className="h-20" /></SectionCard>;

  const { ensembleTrajectories, forecastHorizonHours, forecastUncertaintyRadiusM, forecastConfidence } = data;
  const confidencePct = Math.round(forecastConfidence * 100);

  return (
    <SectionCard number={5} title="Forward Drift Trace" status={status}>
      <button
        onClick={onViewMap}
        className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#BFDCEA] bg-[#EAF4FA] px-4 py-2.5 text-left hover:bg-[#DCEEF7] transition-colors"
      >
        <span className="text-xs font-semibold text-[#12344A]">🗺️ View forward drift forecast on the Investigation Map ↑</span>
        <span className="text-xs text-[#167EAD]">Open →</span>
      </button>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Trajectories</span>
          <p className="mono mt-1 text-sm text-[#167EAD]">{ensembleTrajectories.length}</p>
        </div>
        <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Forecast Horizon</span>
          <p className="mono mt-1 text-sm text-[#167EAD]">{forecastHorizonHours} hours</p>
        </div>
        <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Resolution</span>
          <p className="mono mt-1 text-sm text-[#167EAD]">1 hour</p>
        </div>
        <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Forecast Confidence</span>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2.5 flex-1 rounded-full bg-white">
              <div className="h-full rounded-full bg-[#22A5C7]" style={{ width: `${confidencePct}%` }} />
            </div>
            <span className="mono text-xs text-[#22A5C7]">±{(forecastUncertaintyRadiusM / 1000).toFixed(1)} km</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-[#8497A3]">
        Forward Lagrangian particle tracking using ensemble wind &amp; current fields, seeded at the reconstructed origin. Spread indicates confidence envelope.
      </p>
    </SectionCard>
  );
}