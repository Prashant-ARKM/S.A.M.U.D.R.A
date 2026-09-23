import SectionCard from './SectionCard';

export default function Section1_IncidentTrigger({ data, status }) {
  if (!data) return <SectionCard number={1} title="Incident Trigger" status="Pending"><div className="h-20" /></SectionCard>;

  const isConfirmed = data.status === 'Confirmed by Automated Detection' || data.status.startsWith('Confirmed');

  return (
    <SectionCard
      number={1}
      title="Incident Trigger"
      status={status}
      realDataNote="In production, this metadata comes straight from the Sentinel-1 SAR product's own header (satellite, orbit, scene ID) — the region/coordinates come from geolocating the flagged pixels, not from a lookup table."
    >
      <div className="overflow-hidden rounded-lg border border-[#FDE68A]">
        {/* Headline row — this IS the alert, everything else is supporting detail */}
        <div className="flex items-start justify-between gap-3 bg-[#FFFBEB] px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#B77B18] text-base text-white">⚠</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#B77B18]">New Incident Detected</span>
                {data.source === 'reported' && (
                  <span className="rounded-full border border-[#BFDCEA] bg-[#EAF4FA] px-2 py-0.5 text-[10px] font-semibold text-[#12344A]">
                    📍 Reported Zone
                  </span>
                )}
              </div>
              <h3 className="mono text-lg font-bold leading-tight text-[#172A35]">{data.incidentId}</h3>
              {data.reportNotes && (
                <p className="mt-0.5 max-w-md text-xs italic text-[#607580]">"{data.reportNotes}"</p>
              )}
            </div>
          </div>
          <span className="mono shrink-0 text-xs text-[#607580]">
            {new Date(data.timestamp).toLocaleString('en-US', { hour12: false })}
          </span>
        </div>

        {/* Key facts — the four things that actually matter at a glance */}
        <div className="grid grid-cols-2 gap-px bg-[#FDE68A] sm:grid-cols-4">
          <div className="bg-white px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Location</span>
            <p className="mono text-base font-semibold text-[#167EAD]">{data.coordinates.lat}°N, {data.coordinates.lon}°E</p>
          </div>
          <div className="bg-white px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Region</span>
            <p className="text-base font-semibold text-[#172A35]">{data.region}</p>
          </div>
          <div className="bg-white px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Detection</span>
            <p className={`text-base font-semibold ${isConfirmed ? 'text-[#287A5D]' : 'text-[#B77B18]'}`}>
              {isConfirmed ? 'Confirmed' : 'Pending Review'}
            </p>
          </div>
          <div className="bg-white px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Anomaly Confidence</span>
            <p className="text-base font-semibold text-[#B77B18]">{Math.round(data.anomalyConfidence * 100)}%</p>
          </div>
        </div>

        {/* Technical detail — deliberately quieter, secondary to the alert above */}
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 bg-[#EDF3F6] px-4 py-2.5 text-[11px]">
          <span className="text-[#8497A3]">Satellite <span className="mono text-[#607580]">{data.satellite}</span></span>
          <span className="text-[#8497A3]">Scene ID <span className="mono text-[#607580]">{data.sceneId}</span></span>
          <span className="text-[#8497A3]">Acquired <span className="mono text-[#607580]">{new Date(data.acquisitionTime).toLocaleString('en-US', { hour12: false })}</span></span>
        </div>
      </div>
    </SectionCard>
  );
}