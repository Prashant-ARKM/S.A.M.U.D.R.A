import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const QUICK_ZONES = [
  { name: 'Mumbai High Offshore', lat: 19.2, lon: 71.5 },
  { name: 'Mumbai / JNPT Port Approach', lat: 18.95, lon: 72.95 },
  { name: 'Kandla Port, Gujarat', lat: 23.03, lon: 70.22 },
  { name: 'Mormugao Port, Goa', lat: 15.4, lon: 73.75 },
  { name: 'New Mangalore Port', lat: 12.87, lon: 74.8 },
  { name: 'Kochi Port', lat: 9.93, lon: 76.2 },
  { name: 'Chennai Port', lat: 13.08, lon: 80.3 },
  { name: 'Visakhapatnam Port', lat: 17.68, lon: 83.3 },
  { name: 'Paradip Port', lat: 20.3, lon: 86.7 },
  { name: 'Tuticorin Port', lat: 8.8, lon: 78.2 },
];

const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#C7464F;border:2px solid white;box-shadow:0 0 0 3px rgba(220,38,38,0.35);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function ClickCapture({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: parseFloat(e.latlng.lat.toFixed(4)), lon: parseFloat(e.latlng.lng.toFixed(4)) });
    },
  });
  return null;
}

export default function ReportSpillModal({ onClose, onSubmit }) {
  const [picked, setPicked] = useState(null);
  const [latText, setLatText] = useState('');
  const [lonText, setLonText] = useState('');
  const [notes, setNotes] = useState('');
  const [zoneQuery, setZoneQuery] = useState('');

  const filteredZones = useMemo(() => {
    if (!zoneQuery.trim()) return QUICK_ZONES;
    const q = zoneQuery.toLowerCase();
    return QUICK_ZONES.filter((z) => z.name.toLowerCase().includes(q));
  }, [zoneQuery]);

  function applyPick(loc) {
    setPicked(loc);
    setLatText(String(loc.lat));
    setLonText(String(loc.lon));
  }

  function applyManualCoords() {
    const lat = parseFloat(latText);
    const lon = parseFloat(lonText);
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      setPicked({ lat, lon });
    }
  }

  const canSubmit = picked !== null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#D3DEE4] bg-white"
        style={{ boxShadow: '0 4px 16px rgba(18,52,74,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#D3DEE4] bg-[#EDF3F6] px-5 py-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#12344A]">📍 Report a Spill — New Investigation</h2>
            <p className="mt-0.5 text-[11px] text-[#607580]">
              Flag a zone for investigation — the system scans it and reports what it actually finds, including a clean result.
            </p>
          </div>
          <button onClick={onClose} className="text-[#8497A3] hover:text-[#172A35]">✕</button>
        </div>

        <div className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Map picker */}
          <div>
            <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Click Map to Drop Pin</span>
            <div className="mt-1.5 h-[220px] overflow-hidden rounded-lg border border-[#D3DEE4]">
              <MapContainer center={[17.5, 74]} zoom={5} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles © Esri"
                />
                <ClickCapture onPick={applyPick} />
                {picked && <Marker position={[picked.lat, picked.lon]} icon={markerIcon} />}
              </MapContainer>
            </div>
          </div>

          {/* Manual entry + quick zones */}
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Or Enter Coordinates</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  placeholder="Lat, e.g. 19.05"
                  value={latText}
                  onChange={(e) => setLatText(e.target.value)}
                  onBlur={applyManualCoords}
                  className="w-full rounded-lg border border-[#D3DEE4] px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Lon, e.g. 71.20"
                  value={lonText}
                  onChange={(e) => setLonText(e.target.value)}
                  onBlur={applyManualCoords}
                  className="w-full rounded-lg border border-[#D3DEE4] px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Or Pick a Known Zone</span>
              <input
                type="text"
                placeholder="Search port/zone..."
                value={zoneQuery}
                onChange={(e) => setZoneQuery(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#D3DEE4] px-2.5 py-1.5 text-xs"
              />
              <div className="mt-1.5 max-h-[92px] space-y-0.5 overflow-y-auto">
                {filteredZones.map((z) => {
                  const active = picked && picked.lat === z.lat && picked.lon === z.lon;
                  return (
                    <button
                      key={z.name}
                      onClick={() => applyPick({ lat: z.lat, lon: z.lon })}
                      className={`block w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-50 ${active ? 'bg-[#EAF4FA] text-[#12344A]' : 'text-[#172A35]'}`}
                    >
                      {z.name} <span className="mono text-[#8497A3]">({z.lat}, {z.lon})</span>
                    </button>
                  );
                })}
                {filteredZones.length === 0 && <p className="px-2 py-1 text-xs text-[#8497A3]">No matches</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Fishing crew reported a sheen near the outer anchorage this morning..."
            rows={2}
            className="mt-1.5 w-full rounded-lg border border-[#D3DEE4] px-2.5 py-1.5 text-xs"
          />
        </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#D3DEE4] bg-[#EDF3F6] px-5 py-3">
          <span className="mono text-xs text-[#607580]">
            {picked ? `Selected: ${picked.lat}°N, ${picked.lon}°E` : 'No location selected yet'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-[#D3DEE4] px-4 py-2 text-xs font-semibold text-[#607580] hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={() => canSubmit && onSubmit({ lat: picked.lat, lon: picked.lon, notes })}
              disabled={!canSubmit}
              className="rounded-lg bg-[#167EAD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#125E80] disabled:cursor-not-allowed disabled:opacity-40"
            >
              🔍 Investigate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
