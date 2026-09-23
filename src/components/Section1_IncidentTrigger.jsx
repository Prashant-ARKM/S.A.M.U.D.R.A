import SectionCard from './SectionCard';

export default function Section1_IncidentTrigger({ data, status }) {
  if (!data) return <SectionCard number={1} title="Incident Trigger" status="Pending"><div className="h-20" /></SectionCard>;

  return (
    <SectionCard number={1} title="Incident Trigger" status={status}>
      <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[#D97706]">⚠</span>
              <span className="text-sm font-semibold text-[#D97706] uppercase tracking-wider">SAR-Pass Alert</span>
              {data.source === 'reported' && (
                <span className="rounded-full border border-[#A5F3FC] bg-[#ECFEFF] px-2 py-0.5 text-[10px] font-semibold text-[#0E7490]">
                  📍 Reported Zone
                </span>
              )}
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#1A1D23] mono">{data.incidentId}</h3>
            {data.reportNotes && (
              <p className="mt-1 max-w-md text-xs italic text-[#6B7280]">"{data.reportNotes}"</p>
            )}
          </div>
          <span className="mono text-xs text-[#6B7280]">
            {new Date(data.timestamp).toLocaleString('en-US', { hour12: false })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <span className="text-xs text-[#6B7280] uppercase tracking-wider">Latitude</span>
            <p className="mono text-sm text-[#0EA5B7]">{data.coordinates.lat}°N</p>
          </div>
          <div>
            <span className="text-xs text-[#6B7280] uppercase tracking-wider">Longitude</span>
            <p className="mono text-sm text-[#0EA5B7]">{data.coordinates.lon}°E</p>
          </div>
          <div>
            <span className="text-xs text-[#6B7280] uppercase tracking-wider">Region</span>
            <p className="mono text-sm text-[#374151]">{data.region}</p>
          </div>
          <div>
            <span className="text-xs text-[#6B7280] uppercase tracking-wider">Satellite</span>
            <p className="mono text-sm text-[#374151]">{data.satellite}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#FDE68A] pt-4 sm:grid-cols-4">
          <div>
            <span className="text-xs text-[#6B7280] uppercase tracking-wider">Scene ID</span>
            <p className="mono text-xs text-[#374151] break-all">{data.sceneId}</p>
          </div>
          <div>
            <span className="text-xs text-[#6B7280] uppercase tracking-wider">Acquisition Time</span>
            <p className="mono text-xs text-[#374151]">
              {new Date(data.acquisitionTime).toLocaleString('en-US', { hour12: false })}
            </p>
          </div>
          <div>
            <span className="text-xs text-[#6B7280] uppercase tracking-wider">Detection Status</span>
            <p className={`mono text-xs ${data.status === 'Confirmed by Automated Detection' ? 'text-[#059669]' : 'text-[#D97706]'}`}>
              {data.status}
            </p>
          </div>
          <div>
            <span className="text-xs text-[#6B7280] uppercase tracking-wider">Anomaly Status</span>
            <p className="mono text-xs text-[#D97706]">{data.anomalyStatus} ({Math.round(data.anomalyConfidence * 100)}%)</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}