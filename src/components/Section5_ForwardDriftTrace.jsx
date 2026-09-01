import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Popup } from 'react-leaflet';
import SectionCard from './SectionCard';

const COLORS = [
  '#0EA5B7', '#0E7490', '#0891b2', '#06b6d4',
  '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4',
  '#7c3aed', '#8b5cf6', '#a78bfa',
];

export default function Section5_ForwardDriftTrace({ data, status }) {
  const totalSteps = data?.ensembleTrajectories?.[0]?.length ? data.ensembleTrajectories[0].length - 1 : 0;
  const [step, setStep] = useState(0);

  // Restart the animation whenever a new incident's forecast arrives.
  useEffect(() => {
    setStep(0);
  }, [data?.incidentId]);

  // Reveal the precomputed forward-ensemble hourly positions over time —
  // an actual simulation step-through, not a canned animation.
  useEffect(() => {
    if (!totalSteps) return;
    const id = setInterval(() => {
      setStep((s) => (s >= totalSteps ? 0 : s + 1));
    }, 250);
    return () => clearInterval(id);
  }, [totalSteps, data?.incidentId]);

  if (!data) return <SectionCard number={5} title="Forward Drift Trace" status="Pending"><div className="h-20" /></SectionCard>;

  const { origin, ensembleTrajectories, forecastHorizonHours, forecastUncertaintyRadiusM, forecastConfidence, areaGrowthRateM2PerHour, slick } = data;
  const hour = ensembleTrajectories[0][Math.min(step, ensembleTrajectories[0].length - 1)].hour;
  // Predicted slick extent at the current forecast hour — ensemble centroid
  // + area grown from the Step 3 detected slick area.
  const centroid = ensembleTrajectories.reduce(
    (acc, traj) => {
      const p = traj[Math.min(step, traj.length - 1)];
      return { lat: acc.lat + p.lat, lon: acc.lon + p.lon };
    },
    { lat: 0, lon: 0 }
  );
  centroid.lat /= ensembleTrajectories.length;
  centroid.lon /= ensembleTrajectories.length;
  const predictedAreaM2 = (slick?.area || 0) + areaGrowthRateM2PerHour * hour;
  const predictedRadiusM = Math.sqrt(predictedAreaM2 / Math.PI);
  const confidencePct = Math.round(forecastConfidence * 100);

  return (
    <SectionCard number={5} title="Forward Drift Trace" status={status}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative h-[320px] overflow-hidden rounded-lg border border-[#E2E5EA]">
            <div className="absolute right-2 top-2 z-[1000] rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-[#0E7490] shadow mono">
              T+{hour}h
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
              {/* Ensemble trajectories — trail grows and particle head advances each step */}
              {ensembleTrajectories.map((traj, i) => {
                const shown = traj.slice(0, step + 1);
                const current = traj[Math.min(step, traj.length - 1)];
                return (
                  <Polyline
                    key={i}
                    positions={shown.map((p) => [p.lat, p.lon])}
                    pathOptions={{
                      color: COLORS[i % COLORS.length],
                      weight: 1.5,
                      opacity: 0.7,
                    }}
                  >
                    <Popup>
                      <span className="mono text-xs">Particle {i + 1}<br />{current.lat}°N, {current.lon}°E</span>
                    </Popup>
                  </Polyline>
                );
              })}
              {/* Predicted slick extent at the current forecast hour */}
              <Circle
                center={[centroid.lat, centroid.lon]}
                radius={predictedRadiusM}
                pathOptions={{ color: '#D97706', fillColor: '#D97706', fillOpacity: 0.15, weight: 1.5 }}
              />
              {/* Uncertainty envelope at forecast horizon */}
              <Circle
                center={[centroid.lat, centroid.lon]}
                radius={forecastUncertaintyRadiusM}
                pathOptions={{ color: '#0EA5B7', fillColor: '#0EA5B7', fillOpacity: 0.05, weight: 1, dashArray: '4 4' }}
              />
              {/* Origin — Step 4 reconstructed release point */}
              <CircleMarker
                center={[origin.lat, origin.lon]}
                radius={7}
                pathOptions={{ color: '#D97706', fillColor: '#D97706', fillOpacity: 0.9, weight: 2 }}
              >
                <Popup>
                  <span className="mono text-xs">Origin Point<br />{origin.lat}°N, {origin.lon}°E</span>
                </Popup>
              </CircleMarker>
            </MapContainer>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Ensemble Parameters</span>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-[#374151]">Trajectories: <span className="mono text-[#0EA5B7]">{ensembleTrajectories.length}</span></p>
              <p className="text-xs text-[#374151]">Forecast: <span className="mono text-[#0EA5B7]">{forecastHorizonHours} hours</span></p>
              <p className="text-xs text-[#374151]">Resolution: <span className="mono text-[#0EA5B7]">1 hour</span></p>
            </div>
          </div>
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-3">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Forecast Confidence</span>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2.5 flex-1 rounded-full bg-[#F3F4F6]">
                <div className="h-full rounded-full bg-[#0D9488]" style={{ width: `${confidencePct}%` }} />
              </div>
              <span className="mono text-xs text-[#0D9488]">±{(forecastUncertaintyRadiusM / 1000).toFixed(1)} km</span>
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">At {forecastHorizonHours}h · confidence {confidencePct}%</p>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Forward Lagrangian particle tracking using ensemble wind & current fields, seeded at the reconstructed origin. Spread indicates confidence envelope.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}