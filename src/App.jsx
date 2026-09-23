import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { generateIncident } from './data/generateIncident';
import { investigateReport } from './data/generateReportedScan';
import ReportSpillModal from './components/ReportSpillModal';
import CleanScanResult from './components/CleanScanResult';
import HowItWorksTour from './components/HowItWorksTour';
import InvestigationMap from './components/InvestigationMap';
import Section1_IncidentTrigger from './components/Section1_IncidentTrigger';
import Section2_DataIngestion from './components/Section2_DataIngestion';
import Section3_SlickAnalysis from './components/Section3_SlickAnalysis';
import Section4_BackwardReconstruction from './components/Section4_BackwardReconstruction';
import Section5_ForwardDriftTrace from './components/Section5_ForwardDriftTrace';
import Section6_VesselIdentification from './components/Section6_VesselIdentification';
import Section7_EvidenceFusion from './components/Section7_EvidenceFusion';

const STAGE_LABELS = [
  'Incident Trigger',
  'Multi-Source Data Ingestion',
  'Slick Analysis',
  'Backward Source Reconstruction',
  'Forward Drift Trace',
  'Vessel Identification',
  'Evidence Fusion',
];

const SHORT_STAGE_LABELS = [
  'INCIDENT',
  'INGESTION',
  'SLICK',
  'HINDCAST',
  'FORECAST',
  'VESSEL',
  'EVIDENCE',
];

const LOG_PREFIXES = [
  '[INCIDENT]',
  '[INGEST]',
  '[ANALYSIS]',
  '[RECON]',
  '[DRIFT]',
  '[VESSEL]',
  '[FUSION]',
];

/* ── Consistent outline icons for data sources ── */
function IconRadar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
      <path d="M4 6h.01" />
      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
      <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
      <path d="M12 18h.01" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconShip() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
      <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
      <path d="M12 1v4" />
    </svg>
  );
}

function IconDroplet() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
    </svg>
  );
}

function IconWaves() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  );
}

function IconCloud() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

const DATA_SOURCES = [
  { Icon: IconRadar, name: 'Sentinel-1 SAR', status: 'ready' },
  { Icon: IconShip, name: 'Historical AIS', status: 'ready' },
  { Icon: IconWaves, name: 'Ocean / Current', status: 'ready' },
  { Icon: IconCloud, name: 'Wind Field', status: 'ready' },
  { Icon: IconDroplet, name: 'Meteorological', status: 'ready' },
];

function App() {
  const [incident, setIncident] = useState(null);
  const [activeStage, setActiveStage] = useState(-1);
  const [stageStatuses, setStageStatuses] = useState(
    Array(7).fill('Pending')
  );
  const [autoPlay, setAutoPlay] = useState(false);
  const [speed, setSpeed] = useState(2000);
  const [log, setLog] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [mapView, setMapView] = useState('hindcast');

  const goToMap = useCallback((view) => {
    setMapView(view);
    document.querySelector('[data-section="map"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const [logoHover, setLogoHover] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const logContainerRef = useRef(null);
  const autoPlayRef = useRef(null);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const appendLog = useCallback(
    (stageIdx, message) => {
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
      setLog((prev) => [
        ...prev,
        { ts, prefix: LOG_PREFIXES[stageIdx], message },
      ]);
    },
    []
  );

  useEffect(() => {
    // Scroll only the log's own internal container — never the page/window.
    // scrollIntoView() on a descendant can hijack the whole viewport when
    // the sidebar stacks below the main content on narrower screens, which
    // is exactly the "gets yanked to the log" bug this avoids.
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const triggerIncident = useCallback(() => {
    const data = generateIncident();
    setIncident(data);
    setActiveStage(-1);
    setStageStatuses(Array(7).fill('Pending'));
    setAutoPlay(false);
    setLog([]);
    setMenuOpen(false);
    appendLog(
      0,
      `New incident ${data.incidentId} — ${data.satellite} SAR pass over ${data.region} (scene ${data.sceneId}), coordinates ${data.coordinates.lat}°N, ${data.coordinates.lon}°E`
    );
  }, [appendLog]);

  const submitReport = useCallback(
    ({ lat, lon, notes }) => {
      const data = investigateReport({ lat, lon, notes });
      setIncident(data);
      setActiveStage(data.falseAlarm ? -1 : -1);
      setStageStatuses(Array(7).fill('Pending'));
      setAutoPlay(false);
      setLog([]);
      setMenuOpen(false);
      setReportModalOpen(false);
      if (data.falseAlarm) {
        appendLog(
          0,
          `Reported zone ${lat}°N, ${lon}°E investigated — ${data.scanSatellite} pass, ${data.scanAreaKm2.toLocaleString()} km² scanned, no anomaly found`
        );
      } else {
        appendLog(
          0,
          `Reported zone confirmed: incident ${data.incidentId} — ${data.satellite} SAR pass near ${lat}°N, ${lon}°E (scene ${data.sceneId})`
        );
      }
    },
    [appendLog]
  );

  const advanceStage = useCallback(() => {
    setActiveStage((prev) => {
      const next = prev + 1;
      if (next >= 7) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeStage < 0 || activeStage >= 7) return;

    setStageStatuses((prev) => {
      const next = [...prev];
      next[activeStage] = 'Processing';
      return next;
    });

    const timeout = setTimeout(() => {
      setStageStatuses((prev) => {
        const next = [...prev];
        next[activeStage] = 'Complete';
        return next;
      });
      appendLog(activeStage, `${STAGE_LABELS[activeStage]} — processing complete`);
    }, 800);

    return () => clearTimeout(timeout);
  }, [activeStage, appendLog]);

  useEffect(() => {
    if (autoPlay && activeStage < 6) {
      autoPlayRef.current = setTimeout(() => {
        setActiveStage((prev) => {
          if (prev >= 6) {
            setAutoPlay(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    }
    return () => clearTimeout(autoPlayRef.current);
  }, [autoPlay, activeStage, speed]);

  const reset = useCallback(() => {
    setIncident(null);
    setActiveStage(-1);
    setStageStatuses(Array(7).fill('Pending'));
    setAutoPlay(false);
    setLog([]);
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-[1100] border-b border-[#D3DEE4] bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-3 py-3 lg:px-5">
          {/* Logo */}
          <div
            className="relative flex items-center gap-2"
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#E7F3ED] border border-[#BEDDCB]">
              <span className="text-base">🛰</span>
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-bold tracking-wider text-[#12344A] mono select-none">
                S.A.M.U.D.R.A.
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#607580]">
                Maritime Pollution Intelligence
              </p>
            </div>

            {logoHover && (
              <div className="absolute top-full left-0 mt-2 w-64 rounded-lg border border-[#D3DEE4] bg-white px-3 py-2 text-[11px] text-[#607580] leading-relaxed shadow-sm z-50">
                Satellite AIS Maritime Unified Detection, Reconstruction &amp; Attribution
              </div>
            )}
          </div>

          {/* System status + clock */}
          <div className="mono hidden items-center gap-1.5 text-[11px] text-[#607580] md:flex">
            <span className="flex items-center gap-1 font-semibold text-[#287A5D]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#287A5D]" />
              SYSTEM ONLINE
            </span>
            <span className="text-[#D3DEE4]">·</span>
            <span>
              {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase()}
              {' · '}
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 relative" ref={menuRef}>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                disabled={!incident}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D3DEE4] bg-white text-[#607580] hover:bg-gray-50 disabled:opacity-40 transition-colors"
                title="Mission Control"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-[#D3DEE4] bg-white p-3 shadow-lg z-50">
                  <p className="mb-2 text-[10px] font-semibold text-[#8497A3] uppercase tracking-wider">Mission Control</p>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        if (autoPlay) {
                          setAutoPlay(false);
                        } else {
                          if (activeStage >= 6) return;
                          if (activeStage < 0) setActiveStage(0);
                          else setAutoPlay(true);
                        }
                      }}
                      disabled={!incident || activeStage >= 6}
                      className="w-full rounded-lg border border-[#D3DEE4] bg-white px-3 py-2 text-left text-xs text-[#172A35] hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      {autoPlay ? '⏸ Pause' : '▶ Auto-play'}
                    </button>
                    <button
                      onClick={advanceStage}
                      disabled={!incident || activeStage >= 6}
                      className="w-full rounded-lg border border-[#D3DEE4] bg-white px-3 py-2 text-left text-xs text-[#172A35] hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      ▶▶ Advance Stage
                    </button>
                    <button
                      onClick={() => { reset(); setMenuOpen(false); }}
                      className="w-full rounded-lg border border-[#D3DEE4] bg-white px-3 py-2 text-left text-xs text-[#172A35] hover:bg-gray-50 transition-colors"
                    >
                      ↻ Reset
                    </button>
                    <div className="border-t border-[#EDF3F6] pt-2 mt-1">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] text-[#607580]">Speed</span>
                        <input
                          type="range"
                          min={500}
                          max={5000}
                          step={250}
                          value={speed}
                          onChange={(e) => setSpeed(Number(e.target.value))}
                          className="flex-1 accent-[#167EAD]"
                        />
                        <span className="mono text-[10px] text-[#607580] w-10 text-right">{speed}ms</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setTourOpen(true)}
              className="rounded-lg border border-[#D3DEE4] bg-white px-4 py-2 text-xs font-semibold text-[#607580] hover:bg-gray-50 transition-colors"
            >
              ❓ How It Works
            </button>

            <button
              onClick={() => setReportModalOpen(true)}
              className="rounded-lg border border-[#D3DEE4] bg-white px-4 py-2 text-xs font-semibold text-[#172A35] hover:bg-gray-50 transition-colors"
            >
              📍 Report a Spill
            </button>

            <button
              onClick={triggerIncident}
              className="rounded-lg bg-[#167EAD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#125E80] transition-colors"
            >
              ⚡ Trigger Incident
            </button>
          </div>
        </div>

        {/* Pipeline stepper — reflects existing activeStage/stageStatuses state */}
        {incident && !incident.falseAlarm && (
          <div className="scrollbar-none flex items-center gap-1 overflow-x-auto border-t border-[#EDF3F6] px-3 py-2 lg:px-5">
            {SHORT_STAGE_LABELS.map((label, i) => {
              const st = stageStatuses[i];
              const isDone = st === 'Complete';
              const isCurrent = i === activeStage && !isDone;
              return (
                <div key={label} className="flex shrink-0 items-center gap-1">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold mono ${
                      isDone
                        ? 'bg-[#287A5D] text-white'
                        : isCurrent
                        ? 'border-2 border-[#167EAD] text-[#167EAD]'
                        : 'border border-[#D3DEE4] text-[#8497A3]'
                    }`}
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span
                    className={`mono text-[10px] font-semibold tracking-wide ${
                      isDone || isCurrent ? 'text-[#172A35]' : 'text-[#8497A3]'
                    }`}
                  >
                    {label}
                  </span>
                  {i < SHORT_STAGE_LABELS.length - 1 && <span className="mx-1 h-px w-4 shrink-0 bg-[#D3DEE4]" />}
                </div>
              );
            })}
          </div>
        )}
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* Main content */}
        <main className="flex-1">
          {!incident ? (
            /* ── Empty state ── */
            <div className="relative h-[calc(100vh-52px)] overflow-hidden">
              {/* Background map — CartoDB Positron, muted */}
              <div className="absolute inset-0 z-0">
                <MapContainer
                  center={[17.5, 68.5]}
                  zoom={6}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                  zoomControl={false}
                  dragging={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                  keyboard={false}
                  attributionControl={false}
                >
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}" />
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}" />
                </MapContainer>
                {/* Dimming scrim — matches page bg for calm atmosphere */}
                <div className="absolute inset-0 bg-[#F3F6F8]/[0.35]" />
              </div>

              {/* Foreground card — centered with elevation */}
              <div className="relative z-10 flex h-full items-center justify-center p-6">
                <div
                  className="w-full max-w-md rounded-lg border border-[#D3DEE4] bg-white p-6"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F3ED] border border-[#BEDDCB]">
                      <span className="text-xl">🛰</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[#172A35]">No Active Incident</h2>
                      <p className="text-xs text-[#607580]">Maritime monitoring system idle</p>
                    </div>
                  </div>

                  <p className="mb-6 text-sm leading-relaxed text-[#607580]">
                    Trigger a synthetic incident to see the full pipeline run automatically, or report a specific zone to have the system investigate it.
                  </p>

                  <button
                    onClick={triggerIncident}
                    className="mb-3 w-full rounded-lg bg-[#167EAD] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#125E80] transition-colors"
                  >
                    ⚡ Trigger Incident
                  </button>

                  <button
                    onClick={() => setReportModalOpen(true)}
                    className="mb-6 w-full rounded-lg border border-[#D3DEE4] bg-white px-4 py-2.5 text-sm font-semibold text-[#172A35] hover:bg-gray-50 transition-colors"
                  >
                    📍 Report a Spill
                  </button>

                  {/* System status */}
                  <div className="border-t border-[#EDF3F6] pt-4">
                    <p className="mb-2 text-[10px] font-semibold text-[#8497A3] uppercase tracking-wider">System Status</p>
                    <div className="space-y-2.5">
                      {DATA_SOURCES.map((src) => (
                        <div key={src.name} className="flex items-center gap-2.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#287A5D] shrink-0" />
                          <span className="text-[#167EAD] shrink-0"><src.Icon /></span>
                          <span className="text-xs font-medium text-[#172A35]">{src.name}</span>
                          <span className="ml-auto text-[10px] font-medium text-[#287A5D]">ready</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : incident.falseAlarm ? (
            <CleanScanResult data={incident} onReportAnother={() => setReportModalOpen(true)} />
          ) : (
            <div className="space-y-3 p-4">
              <Section1_IncidentTrigger data={incident} status={stageStatuses[0]} />
              <Section2_DataIngestion data={incident} status={stageStatuses[1]} />
              <Section3_SlickAnalysis data={incident} status={stageStatuses[2]} />
              <InvestigationMap data={incident} view={mapView} onViewChange={setMapView} />
              <Section4_BackwardReconstruction data={incident} status={stageStatuses[3]} onViewMap={() => goToMap('hindcast')} />
              <Section5_ForwardDriftTrace data={incident} status={stageStatuses[4]} onViewMap={() => goToMap('forecast')} />
              <Section6_VesselIdentification data={incident} status={stageStatuses[5]} onViewMap={() => goToMap('vessels')} />
              <Section7_EvidenceFusion data={incident} status={stageStatuses[6]} />
            </div>
          )}
        </main>

        {/* Investigation Log sidebar */}
        <aside className={`w-full border-t border-[#D3DEE4] bg-white lg:w-72 lg:border-t-0 lg:border-l xl:w-80 ${!incident ? 'log-panel-empty' : ''}`}>
          <div
            className={`flex h-80 flex-col lg:sticky lg:h-[calc(100vh-52px)] ${
              incident && !incident.falseAlarm ? 'lg:top-[89px] lg:h-[calc(100vh-89px)]' : 'lg:top-[52px]'
            }`}
          >
            <div className="border-b border-[#D3DEE4] px-4 py-2.5">
              <h3 className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Investigation Log</h3>
            </div>
            <div ref={logContainerRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {log.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#D1D5DB] mb-2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                    <path d="M10 9H8" />
                  </svg>
                  <p className="text-xs text-[#8497A3] leading-relaxed">
                    Log entries will appear<br />as stages complete…
                  </p>
                </div>
              )}
              {log.map((entry, i) => (
                <div key={i} className="text-[11px] leading-relaxed">
                  <span className="mono text-[#8497A3]">{entry.ts}</span>{' '}
                  <span className="mono font-semibold text-[#167EAD]">{entry.prefix}</span>{' '}
                  <span className="text-[#172A35]">{entry.message}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[#D3DEE4] px-4 py-2">
              <span className="mono text-[10px] text-[#8497A3]">{log.length} entries</span>
            </div>
          </div>
        </aside>
      </div>

      {reportModalOpen && (
        <ReportSpillModal onClose={() => setReportModalOpen(false)} onSubmit={submitReport} />
      )}

      {tourOpen && <HowItWorksTour onClose={() => setTourOpen(false)} />}
    </div>
  );
}

export default App;