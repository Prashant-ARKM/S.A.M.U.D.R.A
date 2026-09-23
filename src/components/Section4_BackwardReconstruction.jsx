import SectionCard from './SectionCard';

export default function Section4_BackwardReconstruction({ data, status, onViewMap }) {
  if (!data) return <SectionCard number={4} title="Backward Source Reconstruction" status="Pending"><div className="h-20" /></SectionCard>;

  const { origin, coordinates, region, reconstructionConfidence } = data;
  const fmt = (d) => new Date(d).toLocaleString('en-US', { hour12: false });
  const confidencePct = Math.round(reconstructionConfidence * 100);

  return (
    <SectionCard number={4} title="Backward Source Reconstruction" status={status}>
      <button
        onClick={onViewMap}
        className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#BFDCEA] bg-[#EAF4FA] px-4 py-2.5 text-left hover:bg-[#DCEEF7] transition-colors"
      >
        <span className="text-xs font-semibold text-[#12344A]">🗺️ View backward reconstruction on the Investigation Map ↑</span>
        <span className="text-xs text-[#167EAD]">Open →</span>
      </button>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Incident Location</span>
          <p className="mono mt-1 text-sm text-[#172A35]">{coordinates.lat}°N, {coordinates.lon}°E</p>
          <p className="text-xs text-[#8497A3]">{region}</p>
        </div>
        <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Probable Origin</span>
          <p className="mono mt-1 text-sm text-[#167EAD]">{origin.lat}°N, {origin.lon}°E</p>
        </div>
        <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Release Time Window</span>
          <p className="mono mt-1 text-xs text-[#172A35]">From: {fmt(data.releaseTimeWindow.start)}</p>
          <p className="mono text-xs text-[#172A35]">To: {fmt(data.releaseTimeWindow.end)}</p>
        </div>
        <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Confidence</span>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2.5 flex-1 rounded-full bg-white">
              <div className="h-full rounded-full bg-[#167EAD]" style={{ width: `${confidencePct}%` }} />
            </div>
            <span className="mono text-xs text-[#167EAD]">{confidencePct}%</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-[#8497A3]">
        Probability density cloud derived from backward particle tracking with oceanographic forcing data.
      </p>
    </SectionCard>
  );
}