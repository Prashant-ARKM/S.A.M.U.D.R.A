import { Fragment } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import SectionCard from './SectionCard';

const TRACK_COLORS = ['#0EA5B7', '#7c3aed', '#D97706', '#DC2626', '#16A34A'];

// Compact 72h behaviour timeline per vessel — AIS gap (red), loitering
// (amber), and a speed-anomaly marker (purple diamond) laid on one bar so
// the three red flags called out in the problem statement are visible at
// a glance instead of buried in a plain numeric column.
function BehaviorTimeline({ v }) {
  const t = v.timeline;
  if (!t) return <span className="text-[#9CA3AF]">—</span>;
  const total = t.totalHours || 72;
  const pct = (h) => Math.min(100, Math.max(0, (h / total) * 100));
  const hasFlags = t.darkDurationHours > 0 || t.loiterDurationHours > 0 || t.speedAnomalyAtHours != null;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-2.5 w-28 rounded-full bg-[#F3F4F6]">
        {t.darkDurationHours > 0 && (
          <span
            title={`AIS Gap: ${t.darkDurationHours}h dark`}
            className="absolute top-0 h-full rounded-full bg-[#DC2626]"
            style={{ left: `${pct(t.darkStartHours)}%`, width: `${Math.max(3, pct(t.darkDurationHours))}%` }}
          />
        )}
        {t.loiterDurationHours > 0 && (
          <span
            title={`Loitering: ${t.loiterDurationHours}h near origin`}
            className="absolute top-0 h-full rounded-full bg-[#D97706]/80"
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
      {!hasFlags && <span className="text-[9px] text-[#9CA3AF]">No red flags</span>}
    </div>
  );
}

export default function Section6_VesselIdentification({ data, status }) {
  if (!data) return <SectionCard number={6} title="Vessel Identification" status="Pending"><div className="h-20" /></SectionCard>;

  const { origin, candidates, coordinates, filteredOutCount, tracksConsidered } = data;

  return (
    <SectionCard number={6} title="Vessel Identification" status={status}>
      <p className="mb-3 text-xs text-[#6B7280]">
        {tracksConsidered} AIS contacts reconstructed near the probable origin — {filteredOutCount} filtered out (outside plausible radius/time window), {candidates.length} remaining suspects.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Map */}
        <div>
          <div className="h-[300px] overflow-hidden rounded-lg border border-[#E2E5EA]">
            <MapContainer
              center={[origin.lat, origin.lon]}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
              attributionControl={true}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                attribution="Labels © Esri"
              />
              {/* Origin */}
              <CircleMarker
                center={[origin.lat, origin.lon]}
                radius={8}
                pathOptions={{ color: '#0EA5B7', fillColor: '#0EA5B7', fillOpacity: 0.8, weight: 2 }}
              >
                <Popup><span className="mono text-xs">Probable Origin</span></Popup>
              </CircleMarker>
              {/* Slick */}
              <CircleMarker
                center={[coordinates.lat, coordinates.lon]}
                radius={6}
                pathOptions={{ color: '#D97706', fillColor: '#D97706', fillOpacity: 0.8 }}
              >
                <Popup><span className="mono text-xs">Slick Detected</span></Popup>
              </CircleMarker>
              {/* Vessel candidates */}
              {candidates.map((v, i) => (
                <Fragment key={v.imo}>
                  <Polyline
                    positions={v.track.map((p) => [p.lat, p.lon])}
                    pathOptions={{ color: TRACK_COLORS[i], weight: 2, opacity: 0.6, dashArray: '6 4' }}
                  />
                  <CircleMarker
                    center={[v.lat, v.lon]}
                    radius={5}
                    pathOptions={{ color: TRACK_COLORS[i], fillColor: TRACK_COLORS[i], fillOpacity: 0.9, weight: 1 }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <p className="font-semibold">{v.name}</p>
                        <p className="mono">{v.imo}</p>
                        <p className="mono">{v.lat.toFixed(4)}°N, {v.lon.toFixed(4)}°E</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                </Fragment>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E2E5EA] text-left text-[#6B7280]">
                <th className="pb-2 pr-2">Vessel</th>
                <th className="pb-2 pr-2">Type</th>
                <th className="pb-2 pr-2">IMO</th>
                <th className="pb-2 pr-2 text-right">Dist (km)</th>
                <th className="pb-2">Behaviour Timeline (72h)</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((v, i) => (
                <tr key={v.imo} className="border-b border-[#F3F4F6]">
                  <td className="py-2 pr-2 font-semibold" style={{ color: TRACK_COLORS[i] }}>
                    {i === 0 ? '★ ' : ''}{v.name}
                  </td>
                  <td className="py-2 pr-2 text-[#374151]">{v.type}</td>
                  <td className="mono py-2 pr-2 text-[#6B7280]">{v.imo}</td>
                  <td className="mono py-2 pr-2 text-right text-[#374151]">{v.distFromOrigin}</td>
                  <td className="py-2"><BehaviorTimeline v={v} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#6B7280]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#DC2626]" /> AIS Gap</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#D97706]/80" /> Loitering</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rotate-45 border border-white bg-[#7c3aed]" /> Speed Anomaly</span>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}