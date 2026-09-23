import { MapContainer, TileLayer, Circle, Marker } from 'react-leaflet';
import L from 'leaflet';

const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#607580;border:2px solid white;box-shadow:0 0 0 3px rgba(107,114,128,0.3);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function CleanScanResult({ data, onReportAnother }) {
  const { reportedLocation, reportNotes, scanSatellite, scanRadiusKm, scanAreaKm2, timestamp } = data;

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl rounded-lg border border-[#D3DEE4] bg-white p-5" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF3F6] border border-[#D3DEE4]">
            <span className="text-xl">✅</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#172A35]">No Anomaly Detected</h2>
            <p className="text-xs text-[#607580]">Reported zone investigated — the SAR pass came back clean</p>
          </div>
        </div>

        <div className="h-[220px] overflow-hidden rounded-lg border border-[#D3DEE4]">
          <MapContainer
            center={[reportedLocation.lat, reportedLocation.lon]}
            zoom={9}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles © Esri"
            />
            <Circle
              center={[reportedLocation.lat, reportedLocation.lon]}
              radius={scanRadiusKm * 1000}
              pathOptions={{ color: '#607580', fillColor: '#607580', fillOpacity: 0.08, weight: 1.5, dashArray: '5 4' }}
            />
            <Marker position={[reportedLocation.lat, reportedLocation.lon]} icon={markerIcon} />
          </MapContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <span className="text-xs text-[#8497A3] uppercase tracking-wider">Reported At</span>
            <p className="mono text-sm text-[#172A35]">{reportedLocation.lat}°N, {reportedLocation.lon}°E</p>
          </div>
          <div>
            <span className="text-xs text-[#8497A3] uppercase tracking-wider">Scan Radius</span>
            <p className="mono text-sm text-[#172A35]">{scanRadiusKm} km</p>
          </div>
          <div>
            <span className="text-xs text-[#8497A3] uppercase tracking-wider">Area Scanned</span>
            <p className="mono text-sm text-[#172A35]">{scanAreaKm2.toLocaleString()} km²</p>
          </div>
          <div>
            <span className="text-xs text-[#8497A3] uppercase tracking-wider">Satellite Pass</span>
            <p className="mono text-sm text-[#172A35]">{scanSatellite}</p>
          </div>
        </div>

        {reportNotes && (
          <div className="mt-4 rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
            <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Reported Notes</span>
            <p className="mt-1 text-xs text-[#172A35]">{reportNotes}</p>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-3">
          <p className="text-xs leading-relaxed text-[#607580]">
            No dark, low-backscatter region consistent with an oil slick signature was found within the scanned area on this pass
            ({new Date(timestamp).toLocaleString('en-US', { hour12: false })}). This does not rule out a spill outside the scan
            radius, one too small to resolve, or one that has since dispersed — a clean result is not the same as a guarantee.
          </p>
        </div>

        <button
          onClick={onReportAnother}
          className="mt-4 w-full rounded-lg border border-[#D3DEE4] px-4 py-2.5 text-sm font-semibold text-[#172A35] hover:bg-gray-50"
        >
          📍 Report Another Zone
        </button>
      </div>
    </div>
  );
}
