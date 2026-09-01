import SectionCard from './SectionCard';

const SOURCE_ICONS = {
  sar: '📡',
  ais: '🚢',
  ocean: '🌊',
  wind: '🌬',
  met: '🌤',
};

const STATUS_STYLES = {
  Ready: { text: 'text-[#059669]', dot: 'bg-[#059669]' },
  'Partial Coverage': { text: 'text-[#D97706]', dot: 'bg-[#D97706]' },
  Unavailable: { text: 'text-[#DC2626]', dot: 'bg-[#DC2626]' },
};

export default function Section2_DataIngestion({ data, status }) {
  if (!data) return <SectionCard number={2} title="Multi-Source Data Ingestion" status="Pending"><div className="h-20" /></SectionCard>;

  const readyCount = data.sources.filter((src) => src.status === 'Ready').length;

  return (
    <SectionCard number={2} title="Multi-Source Data Ingestion" status={status}>
      <p className="mb-3 text-xs text-[#6B7280]">
        Retrieved &amp; coverage-validated for {data.incidentId} — {readyCount}/{data.sources.length} ready for analysis
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data.sources.map((src) => {
          const style = STATUS_STYLES[src.status] || { text: 'text-[#6B7280]', dot: 'bg-gray-400' };
          return (
            <div
              key={src.key}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3 text-center"
            >
              <span className="text-2xl">{SOURCE_ICONS[src.key]}</span>
              <span className="text-xs font-semibold text-[#374151]">{src.name}</span>
              <span className="mono text-[10px] text-[#9CA3AF] break-all">{src.datasetId}</span>
              <span className="mono text-[10px] text-[#6B7280]">
                {new Date(src.observationTime).toLocaleTimeString('en-US', { hour12: false })} · {src.coverage}% cov.
              </span>
              <span className={`flex items-center gap-1 text-xs ${style.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {src.status}
              </span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
