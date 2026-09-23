import { useEffect, useState, Fragment } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, Polyline, ScaleControl } from 'react-leaflet';

const FORECAST_COLORS = [
  '#167EAD', '#12344A', '#0891b2', '#06b6d4',
  '#22A5C7', '#14b8a6', '#2dd4bf', '#5eead4',
  '#7c3aed', '#8b5cf6', '#a78bfa',
];
const TRACK_COLORS = ['#167EAD', '#7c3aed', '#B77B18', '#C7464F', '#287A5D'];

const TABS = [
  { key: 'hindcast', label: '🔙 Backward Reconstruction' },
  { key: 'forecast', label: '🔮 Forward Drift' },
  { key: 'vessels', label: '🚢 Vessel Tracks' },
];

export default function InvestigationMap({ data, view, onViewChange }) {
  const hindcastTotalSteps = data?.hindcastParticles?.[0]?.path.length ? data.hindcastParticles[0].path.length - 1 : 0;
  const forecastTotalSteps = data?.ensembleTrajectories?.[0]?.length ? data.ensembleTrajectories[0].length - 1 : 0;
  const [hindcastStep, setHindcastStep] = useState(0);
  const [forecastStep, setForecastStep] = useState(0);

  useEffect(() => {
    setHindcastStep(0);
    setForecastStep(0);
  }, [data?.incidentId]);

  // Only the currently visible view's animation runs — no point advancing
  // a timeline nobody is looking at.
  useEffect(() => {
    if (view !== 'hindcast' || !hindcastTotalSteps) return;
    const id = setInterval(() => {
      setHindcastStep((s) => (s >= hindcastTotalSteps ? 0 : s + 1));
    }, 450);
    return () => clearInterval(id);
  }, [view, hindcastTotalSteps, data?.incidentId]);

  useEffect(() => {
    if (view !== 'forecast' || !forecastTotalSteps) return;
    const id = setInterval(() => {
      setForecastStep((s) => (s >= forecastTotalSteps ? 0 : s + 1));
    }, 250);
    return () => clearInterval(id);
  }, [view, forecastTotalSteps, data?.incidentId]);

  if (!data) return null;

  const { origin, coordinates, slick, hindcastParticles, uncertaintyRadiusM, ensembleTrajectories, forecastUncertaintyRadiusM, areaGrowthRateM2PerHour, candidates } = data;
  const r = uncertaintyRadiusM;

  const hoursAgo = hindcastParticles[0]?.path[Math.min(hindcastStep, hindcastParticles[0].path.length - 1)]?.hoursAgo ?? 0;

  const forecastHour = ensembleTrajectories[0][Math.min(forecastStep, ensembleTrajectories[0].length - 1)].hour;
  const centroid = ensembleTrajectories.reduce(
    (acc, traj) => {
      const p = traj[Math.min(forecastStep, traj.length - 1)];
      return { lat: acc.lat + p.lat, lon: acc.lon + p.lon };
    },
    { lat: 0, lon: 0 }
  );
  centroid.lat /= ensembleTrajectories.length;
  centroid.lon /= ensembleTrajectories.length;
  const predictedAreaM2 = (slick?.area || 0) + areaGrowthRateM2PerHour * forecastHour;
  const predictedRadiusM = Math.sqrt(predictedAreaM2 / Math.PI);

  return (
    <div className="rounded-lg border border-[#D3DEE4] bg-white p-4" data-section="map">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-[#172A35]">🗺️ Investigation Map</span>
        <span className="text-[10px] text-[#8497A3]">Shared workspace for Steps 04–06</span>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onViewChange(t.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === t.key ? 'bg-white text-[#12344A] shadow-sm' : 'text-[#607580] hover:bg-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative mt-2 h-[560px] overflow-hidden rounded-lg border border-[#D3DEE4]">
        {view === 'hindcast' && (
          <>
            <div className="absolute right-2 top-2 z-[1000] rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-[#12344A] shadow mono">
              T-{hoursAgo}h
            </div>
            <div className="absolute bottom-2 left-2 z-[1000] rounded-md bg-black/65 px-2 py-1 text-[10px] leading-4 text-white backdrop-blur-sm">
              <div><span className="inline-block h-2 w-2 rounded-full bg-[#B77B18] mr-1" />Observed slick</div>
              <div><span className="inline-block h-2 w-2 rounded-full bg-[#167EAD] mr-1" />Backward particles</div>
              <div><span className="inline-block h-2 w-2 rounded-full bg-[#7DD3FC] mr-1" />Probable origin</div>
            </div>
          </>
        )}
        {view === 'forecast' && (
          <div className="absolute right-2 top-2 z-[1000] rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-[#12344A] shadow mono">
            T+{forecastHour}h
          </div>
        )}

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

          {view === 'hindcast' && (
            <>
              <ScaleControl position="bottomleft" imperial={false} />
              <Circle center={[origin.lat, origin.lon]} radius={r * 3} pathOptions={{ color: '#167EAD', fillColor: '#167EAD', fillOpacity: 0.06, weight: 1, dashArray: '4 4' }} />
              <Circle center={[origin.lat, origin.lon]} radius={r * 2} pathOptions={{ color: '#167EAD', fillColor: '#167EAD', fillOpacity: 0.12, weight: 1, dashArray: '4 4' }} />
              <Circle center={[origin.lat, origin.lon]} radius={r} pathOptions={{ color: '#167EAD', fillColor: '#167EAD', fillOpacity: 0.22, weight: 1.5 }} />
              <Circle center={[origin.lat, origin.lon]} radius={r * 0.4} pathOptions={{ color: '#12344A', fillColor: '#12344A', fillOpacity: 0.4, weight: 2 }} />
              {hindcastParticles.map((particle, i) => {
                const shown = particle.path.slice(0, hindcastStep + 1);
                const current = particle.path[Math.min(hindcastStep, particle.path.length - 1)];
                return (
                  <Fragment key={i}>
                    <Polyline positions={shown.map((p) => [p.lat, p.lon])} pathOptions={{ color: '#12344A', weight: 1, opacity: 0.35 }} />
                    <CircleMarker center={[current.lat, current.lon]} radius={2.5} pathOptions={{ color: '#12344A', fillColor: '#167EAD', fillOpacity: 0.9, weight: 1 }} />
                  </Fragment>
                );
              })}
              <CircleMarker center={[slick.location.lat, slick.location.lon]} radius={6} pathOptions={{ color: '#B77B18', fillColor: '#B77B18', fillOpacity: 0.8 }}>
                <Popup><span className="mono text-xs">Slick Detected<br />{slick.location.lat}°N, {slick.location.lon}°E</span></Popup>
              </CircleMarker>
              <CircleMarker center={[origin.lat, origin.lon]} radius={8} pathOptions={{ color: '#167EAD', fillColor: '#167EAD', fillOpacity: 0.9, weight: 2 }}>
                <Popup><span className="mono text-xs">Probable Origin<br />{origin.lat}°N, {origin.lon}°E</span></Popup>
              </CircleMarker>
            </>
          )}

          {view === 'forecast' && (
            <>
              {ensembleTrajectories.map((traj, i) => {
                const shown = traj.slice(0, forecastStep + 1);
                const current = traj[Math.min(forecastStep, traj.length - 1)];
                return (
                  <Polyline key={i} positions={shown.map((p) => [p.lat, p.lon])} pathOptions={{ color: FORECAST_COLORS[i % FORECAST_COLORS.length], weight: 1.5, opacity: 0.7 }}>
                    <Popup><span className="mono text-xs">Particle {i + 1}<br />{current.lat}°N, {current.lon}°E</span></Popup>
                  </Polyline>
                );
              })}
              <Circle center={[centroid.lat, centroid.lon]} radius={predictedRadiusM} pathOptions={{ color: '#B77B18', fillColor: '#B77B18', fillOpacity: 0.15, weight: 1.5 }} />
              <Circle center={[centroid.lat, centroid.lon]} radius={forecastUncertaintyRadiusM} pathOptions={{ color: '#167EAD', fillColor: '#167EAD', fillOpacity: 0.05, weight: 1, dashArray: '4 4' }} />
              <CircleMarker center={[origin.lat, origin.lon]} radius={7} pathOptions={{ color: '#B77B18', fillColor: '#B77B18', fillOpacity: 0.9, weight: 2 }}>
                <Popup><span className="mono text-xs">Origin Point<br />{origin.lat}°N, {origin.lon}°E</span></Popup>
              </CircleMarker>
            </>
          )}

          {view === 'vessels' && (
            <>
              <CircleMarker center={[origin.lat, origin.lon]} radius={8} pathOptions={{ color: '#167EAD', fillColor: '#167EAD', fillOpacity: 0.8, weight: 2 }}>
                <Popup><span className="mono text-xs">Probable Origin</span></Popup>
              </CircleMarker>
              <CircleMarker center={[coordinates.lat, coordinates.lon]} radius={6} pathOptions={{ color: '#B77B18', fillColor: '#B77B18', fillOpacity: 0.8 }}>
                <Popup><span className="mono text-xs">Slick Detected</span></Popup>
              </CircleMarker>
              {candidates.map((v, i) => (
                <Fragment key={v.imo}>
                  <Polyline positions={v.track.map((p) => [p.lat, p.lon])} pathOptions={{ color: TRACK_COLORS[i], weight: 2, opacity: 0.6, dashArray: '6 4' }} />
                  <CircleMarker center={[v.lat, v.lon]} radius={5} pathOptions={{ color: TRACK_COLORS[i], fillColor: TRACK_COLORS[i], fillOpacity: 0.9, weight: 1 }}>
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
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}