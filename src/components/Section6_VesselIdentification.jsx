const TRACK_COLORS = ['#167EAD', '#7c3aed', '#B77B18', '#C7464F', '#287A5D'];
import SectionCard from './SectionCard';

// Compact 72h behaviour timeline per vessel — AIS gap (red), loitering
// (amber), and a speed-anomaly marker (purple diamond) laid on one bar so
// the three red flags called out in the problem statement are visible at
// a glance instead of buried in a plain numeric column.
function BehaviorTimeline({ v }) {
  const t = v.timeline;
  if (!t) return <span className="text-[#8497A3]">—</span>;
  const total = t.totalHours || 72;
  const pct = (h) => Math.min(100, Math.max(0, (h / total) * 100));
  const hasFlags = t.darkDurationHours > 0 || t.loiterDurationHours > 0 || t.speedAnomalyAtHours != null;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-2.5 w-28 rounded-full bg-[#EDF3F6]">
        {t.darkDurationHours > 0 && (
          <span
            title={`AIS Gap: ${t.darkDurationHours}h dark`}
            className="absolute top-0 h-full rounded-full bg-[#C7464F]"
            style={{ left: `${pct(t.darkStartHours)}%`, width: `${Math.max(3, pct(t.darkDurationHours))}%` }}
          />
        )}
        {t.loiterDurationHours > 0 && (
          <span
            title={`Loitering: ${t.loiterDurationHours}h near origin`}
            className="absolute top-0 h-full rounded-full bg-[#B77B18]/80"
            style={{ left: `${pct(t.loiterStartHours)}%`, width: `${Math.max(3, pct(t.loiterDurationHours))}%` }}
          />
        )}
        {t.speedAnomalyAtHours != null && (
          <span
            title={`Speed dropped ${v.speedAnomalyFromKnots}kn → ${v.speedAnomalyToKnots}kn near closest approach`}
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-white bg-[#7c3aed]"
            style={{ left: `${pct(t.speedAnomalyAtHours)}%` }}
          />
        )}
      </div>
      {!hasFlags && <span className="text-[9px] text-[#8497A3]">No red flags</span>}
    </div>
  );
}

export default function Section6_VesselIdentification({ data, status, onViewMap }) {
  if (!data) return <SectionCard number={6} title="Vessel Identification" status="Pending"><div className="h-20" /></SectionCard>;

  const { candidates, filteredOutCount, tracksConsidered } = data;

  return (
    <SectionCard number={6} title="Vessel Identification" status={status}>
      <button
        onClick={onViewMap}
        className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#BFDCEA] bg-[#EAF4FA] px-4 py-2.5 text-left hover:bg-[#DCEEF7] transition-colors"
      >
        <span className="text-xs font-semibold text-[#12344A]">🗺️ View vessel tracks on the Investigation Map ↑</span>
        <span className="text-xs text-[#167EAD]">Open →</span>
      </button>

      <p className="mb-3 text-xs text-[#607580]">
        {tracksConsidered} AIS contacts reconstructed near the probable origin — {filteredOutCount} filtered out (outside plausible radius/time window), {candidates.length} remaining suspects.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#D3DEE4] text-left text-[#607580]">
              <th className="pb-2 pr-2">Vessel</th>
              <th className="pb-2 pr-2">Type</th>
              <th className="pb-2 pr-2">IMO</th>
              <th className="pb-2 pr-2 text-right">Dist (km)</th>
              <th className="pb-2">Behaviour Timeline (72h)</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((v, i) => (
              <tr key={v.imo} className="border-b border-[#EDF3F6]">
                <td className="py-2 pr-2 font-semibold" style={{ color: TRACK_COLORS[i] }}>
                  {i === 0 ? '★ ' : ''}{v.name}
                </td>
                <td className="py-2 pr-2 text-[#172A35]">{v.type}</td>
                <td className="mono py-2 pr-2 text-[#607580]">{v.imo}</td>
                <td className="mono py-2 pr-2 text-right text-[#172A35]">{v.distFromOrigin}</td>
                <td className="py-2"><BehaviorTimeline v={v} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#607580]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#C7464F]" /> AIS Gap</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#B77B18]/80" /> Loitering</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rotate-45 border border-white bg-[#7c3aed]" /> Speed Anomaly</span>
        </div>
      </div>
    </SectionCard>
  );
}