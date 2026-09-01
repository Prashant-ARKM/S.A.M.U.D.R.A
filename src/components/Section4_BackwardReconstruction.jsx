import { useEffect, useState, Fragment } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, Polyline, ScaleControl } from 'react-leaflet';
import SectionCard from './SectionCard';

export default function Section4_BackwardReconstruction({ data, status }) {
  const totalSteps = data?.hindcastParticles?.[0]?.path.length ? data.hindcastParticles[0].path.length - 1 : 0;
  const [step, setStep] = useState(0);

  // Restart the animation whenever a new incident (new particle set) arrives.
  useEffect(() => {
    setStep(0);
  }, [data?.incidentId]);

  // Advance through the precomputed backward-particle time steps — this is
  // just revealing already-simulated positions over time, not a canned
  // CSS/GIF animation.
  useEffect(() => {
    if (!totalSteps) return;
    const id = setInterval(() => {
      setStep((s) => (s >= totalSteps ? 0 : s + 1));
    }, 450);
    return () => clearInterval(id);
  }, [totalSteps, data?.incidentId]);

  if (!data) return <SectionCard number={4} title="Backward Source Reconstruction" status="Pending"><div className="h-20" /></SectionCard>;

  const { origin, coordinates, region, slick, hindcastParticles, uncertaintyRadiusM, reconstructionConfidence } = data;
  const fmt = (d) => new Date(d).toLocaleString('en-US', { hour12: false });
  const confidencePct = Math.round(reconstructionConfidence * 100);
  const r = uncertaintyRadiusM;
  // Backward time progression shown during the animation — the same
  // per-step "hoursAgo" already computed for the particle paths.
  const hoursAgo = hindcastParticles[0]?.path[Math.min(step, hindcastParticles[0].path.length - 1)]?.hoursAgo ?? 0;

  return (
    <SectionCard number={4} title="Backward Source Reconstruction" status={status}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative h-[300px] overflow-hidden rounded-lg border border-[#E2E5EA]">
            <div className="absolute right-2 top-2 z-[1000] rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-[#0E7490] shadow mono">
              T-{hoursAgo}h
            </div>
            <div className="absolute bottom-2 left-2 z-[1000] rounded-md bg-black/65 px-2 py-1 text-[10px] leading-4 text-white backdrop-blur-sm">
              <div><span className="inline-block h-2 w-2 rounded-full bg-[#D97706] mr-1" />Observed slick</div>
              <div><span className="inline-block h-2 w-2 rounded-full bg-[#0EA5B7] mr-1" />Backward particles</div>
              <div><span className="inline-block h-2 w-2 rounded-full bg-[#7DD3FC] mr-1" />Probable origin</div>
            </div>
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
              <ScaleControl position="bottomleft" imperial={false} />
              {/* Probability density rings — scaled from the reconstructed uncertainty radius */}
              <Circle
                center={[origin.lat, origin.lon]}
                radius={r * 3}
                pathOptions={{ color: '#0EA5B7', fillColor: '#0EA5B7', fillOpacity: 0.06, weight: 1, dashArray: '4 4' }}
              />
              <Circle
                center={[origin.lat, origin.lon]}
                radius={r * 2}
                pathOptions={{ color: '#0EA5B7', fillColor: '#0EA5B7', fillOpacity: 0.12, weight: 1, dashArray: '4 4' }}
              />
              <Circle
                center={[origin.lat, origin.lon]}
                radius={r}
                pathOptions={{ color: '#0EA5B7', fillColor: '#0EA5B7', fillOpacity: 0.22, weight: 1.5 }}
              />
              <Circle
                center={[origin.lat, origin.lon]}
                radius={r * 0.4}
                pathOptions={{ color: '#0E7490', fillColor: '#0E7490', fillOpacity: 0.4, weight: 2 }}
              />
              {/* Backward particle swarm — animated: each particle's trail grows and
                  the swarm converges toward the origin as `step` advances. */}
              {hindcastParticles.map((particle, i) => {
                const shown = particle.path.slice(0, step + 1);
                const current = particle.path[Math.min(step, particle.path.length - 1)];
                return (
                  <Fragment key={i}>
                    <Polyline
                      positions={shown.map((p) => [p.lat, p.lon])}
                      pathOptions={{ color: '#0E7490', weight: 1, opacity: 0.35 }}
                    />
                    <CircleMarker
                      center={[current.lat, current.lon]}
                      radius={2.5}
                      pathOptions={{ color: '#0E7490', fillColor: '#0EA5B7', fillOpacity: 0.9, weight: 1 }}
                    />
                  </Fragment>
                );
              })}
              {/* Slick detection point — the actual Step 3 detected location, not the initial anomaly point */}
              <CircleMarker
                center={[slick.location.lat, slick.location.lon]}
                radius={6}
                pathOptions={{ color: '#D97706', fillColor: '#D97706', fillOpacity: 0.8 }}
              >
                <Popup>
                  <span className="mono text-xs">Slick Detected<br />{slick.location.lat}°N, {slick.location.lon}°E</span>
                </Popup>
              </CircleMarker>
              {/* Origin marker */}
              <CircleMarker
                center={[origin.lat, origin.lon]}
                radius={8}
                pathOptions={{ color: '#0EA5B7', fillColor: '#0EA5B7', fillOpacity: 0.9, weight: 2 }}
              >
                <Popup>
                  <span className="mono text-xs">Probable Origin<br />{origin.lat}°N, {origin.lon}°E</span>
                </Popup>
              </CircleMarker>
            </MapContainer>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Incident Location</span>
            <p className="mono mt-1 text-sm text-[#374151]">{coordinates.lat}°N, {coordinates.lon}°E</p>
            <p className="text-xs text-[#9CA3AF]">{region}</p>
          </div>
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Probable Origin</span>
            <p className="mono mt-1 text-sm text-[#0EA5B7]">{origin.lat}°N, {origin.lon}°E</p>
          </div>
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Release Time Window</span>
            <p className="mono mt-1 text-xs text-[#374151]">From: {fmt(data.releaseTimeWindow.start)}</p>
            <p className="mono text-xs text-[#374151]">To: {fmt(data.releaseTimeWindow.end)}</p>
          </div>
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Confidence</span>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2.5 flex-1 rounded-full bg-[#F3F4F6]">
                <div className="h-full rounded-full bg-[#0EA5B7]" style={{ width: `${confidencePct}%` }} />
              </div>
              <span className="mono text-xs text-[#0EA5B7]">{confidencePct}%</span>
            </div>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Probability density cloud derived from backward particle tracking with oceanographic forcing data.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
