import SectionCard from './SectionCard';

const SOURCE_ICONS = {
  sar: '📡',
  ais: '🚢',
  ocean: '🌊',
  wind: '🌬',
  met: '🌤',
};

const REAL_SOURCE_MAP = {
  sar: 'Copernicus / Sentinel Hub',
  ais: 'AIS provider (Spire, MarineTraffic)',
  ocean: 'Copernicus Marine Service (CMEMS)',
  wind: 'ECMWF / GFS',
  met: 'ECMWF / IMD',
};

const STATUS_STYLES = {
  Ready: { text: 'text-[#287A5D]', dot: 'bg-[#287A5D]', chip: 'bg-[#E7F3ED] border-[#BEDDCB]' },
  'Partial Coverage': { text: 'text-[#B77B18]', dot: 'bg-[#B77B18]', chip: 'bg-[#FFFBEB] border-[#FDE68A]' },
  Unavailable: { text: 'text-[#C7464F]', dot: 'bg-[#C7464F]', chip: 'bg-red-50 border-red-200' },
};

export default function Section2_DataIngestion({ data, status }) {
  if (!data) return <SectionCard number={2} title="Multi-Source Data Ingestion" status="Pending"><div className="h-20" /></SectionCard>;

  const readyCount = data.sources.filter((src) => src.status === 'Ready').length;

  return (
    <SectionCard
      number={2}
      title="Multi-Source Data Ingestion"
      status={status}
      realDataNote="Each panel below would be a live API pull, not synthetic — the real source for each is named under its dataset ID."
    >
      <p className="mb-3 text-xs text-[#607580]">
        Retrieved &amp; coverage-validated for {data.incidentId} — {readyCount}/{data.sources.length} ready for analysis
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {data.sources.map((src) => {
          const style = STATUS_STYLES[src.status] || { text: 'text-[#607580]', dot: 'bg-gray-400', chip: 'bg-gray-50 border-gray-200' };
          const metaEntries = Object.entries(src.metadata || {}).slice(0, 2);
          return (
            <div key={src.key} className="rounded-lg border border-[#D3DEE4] bg-white p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EDF3F6] text-xl">
                  {SOURCE_ICONS[src.key]}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#172A35]">{src.name}</p>
                  <p className="truncate text-[10px] text-[#8497A3]">{REAL_SOURCE_MAP[src.key]}</p>
                </div>
              </div>

              <div className={`mt-2.5 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold ${style.chip} ${style.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {src.status}
                <span className="mono ml-auto text-[10px] font-normal text-[#8497A3]">{src.coverage}%</span>
              </div>

              <div className="mt-2.5 space-y-1 border-t border-[#EDF3F6] pt-2">
                {metaEntries.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8497A3]">{k}</span>
                    <span className="mono font-semibold text-[#172A35]">{v}</span>
                  </div>
                ))}
              </div>

              <p className="mono mt-2 truncate text-[9px] text-[#8497A3]" title={src.datasetId}>{src.datasetId}</p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}