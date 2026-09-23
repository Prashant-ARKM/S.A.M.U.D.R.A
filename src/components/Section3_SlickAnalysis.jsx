import { useEffect, useMemo, useRef, useState } from 'react';
import SectionCard from './SectionCard';
import { generateSarRaster } from '../data/generateSarRaster';

const CANVAS_PX = 520; // physical canvas resolution (square)

// Draws the shared grayscale base raster into a canvas at CANVAS_PX,
// nearest-neighbour source at raster.gridSize upsampled with smoothing so
// the speckle texture stays soft rather than blocky.
function paintBase(ctx, raster) {
  const { gray, gridSize } = raster;
  const off = document.createElement('canvas');
  off.width = gridSize;
  off.height = gridSize;
  const offCtx = off.getContext('2d');
  const imgData = offCtx.createImageData(gridSize, gridSize);
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i];
    imgData.data[i * 4] = v;
    imgData.data[i * 4 + 1] = v;
    imgData.data[i * 4 + 2] = v;
    imgData.data[i * 4 + 3] = 255;
  }
  offCtx.putImageData(imgData, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
  ctx.drawImage(off, 0, 0, CANVAS_PX, CANVAS_PX);
}

// Same as paintBase but for the EO sensor's RGB raster (true-colour optical
// instead of grayscale radar backscatter).
function paintBaseRGB(ctx, raster) {
  const { rgb, gridSize } = raster;
  const off = document.createElement('canvas');
  off.width = gridSize;
  off.height = gridSize;
  const offCtx = off.getContext('2d');
  const imgData = offCtx.createImageData(gridSize, gridSize);
  for (let i = 0; i < gridSize * gridSize; i++) {
    imgData.data[i * 4] = rgb[i * 3];
    imgData.data[i * 4 + 1] = rgb[i * 3 + 1];
    imgData.data[i * 4 + 2] = rgb[i * 3 + 2];
    imgData.data[i * 4 + 3] = 255;
  }
  offCtx.putImageData(imgData, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
  ctx.drawImage(off, 0, 0, CANVAS_PX, CANVAS_PX);
}

function paintPolygon(ctx, points, scale, { fill, stroke, dash, lineWidth = 1.5 }) {
  if (!points || !points.length) return;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = p.x * scale;
    const y = p.y * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function paintVesselGlow(ctx, x, y, r, color) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function SarPanel({ raster, mode, showLookalike, acquisitionLabel }) {
  const canvasRef = useRef(null);
  const scale = CANVAS_PX / raster.gridSize;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    paintBase(ctx, raster);

    // Vessel returns are part of the raw scene — draw in both panels.
    raster.vessels.forEach((v) => {
      const x = v.px.x * scale;
      const y = v.px.y * scale;
      paintVesselGlow(ctx, x, y, 9, v.rank === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,241,150,0.9)');
    });

    if (mode === 'detected') {
      paintPolygon(ctx, raster.slickPolygonPx, scale, {
        fill: 'rgba(220,38,38,0.32)',
        stroke: '#F87171',
        lineWidth: 1.75,
      });
      if (showLookalike && raster.lookalikePolygonPx) {
        paintPolygon(ctx, raster.lookalikePolygonPx, scale, {
          stroke: '#B77B18',
          dash: [5, 4],
          lineWidth: 1.5,
        });
      }
      // crosshair + rank marker on vessel contacts
      raster.vessels.forEach((v) => {
        const x = v.px.x * scale;
        const y = v.px.y * scale;
        ctx.strokeStyle = v.rank === 0 ? '#FDE68A' : 'rgba(253,230,138,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 7, y);
        ctx.lineTo(x + 7, y);
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x, y + 7);
        ctx.stroke();
      });
    }
  }, [raster, mode, showLookalike, scale]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[#1F2937] bg-black">
      <canvas ref={canvasRef} width={CANVAS_PX} height={CANVAS_PX} className="h-full w-full" />

      {/* Timestamp chip */}
      <div className="mono absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-[#D3DEE4]">
        {acquisitionLabel}
      </div>

      {/* North arrow */}
      <div className="absolute right-2 top-2 flex flex-col items-center rounded bg-black/60 px-1.5 py-1 text-[#D3DEE4]">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l6 18-6-4-6 4z" /></svg>
        <span className="mono text-[9px] leading-none">N</span>
      </div>

      {/* Scale bar */}
      <div className="mono absolute bottom-2 left-2 flex flex-col items-start gap-0.5 rounded bg-black/60 px-1.5 py-1 text-[9px] text-[#D3DEE4]">
        <div
          className="relative h-1.5 border-b border-[#D3DEE4]"
          style={{ width: `${((raster.scaleBarKm * 1000) / raster.metersPerPx / raster.gridSize) * 100}%`, minWidth: 24 }}
        >
          <span className="absolute left-0 top-0 h-full border-l border-[#D3DEE4]" />
          <span className="absolute right-0 top-0 h-full border-r border-[#D3DEE4]" />
        </div>
        <span>{raster.scaleBarKm} km</span>
      </div>
    </div>
  );
}

function EoPanel({ eo, acquisitionLabel }) {
  const canvasRef = useRef(null);
  const raster = eo.raster;
  const scale = raster ? CANVAS_PX / raster.gridSize : 1;

  useEffect(() => {
    if (!raster) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    paintBaseRGB(ctx, raster);
    raster.vessels.forEach((v) => {
      const x = v.px.x * scale;
      const y = v.px.y * scale;
      paintVesselGlow(ctx, x, y, 7, 'rgba(255,255,255,0.9)');
    });
    paintPolygon(ctx, raster.slickPolygonPx, scale, {
      stroke: eo.agreement ? '#F87171' : '#FDE68A',
      dash: eo.agreement ? [] : [5, 4],
      lineWidth: 1.75,
    });
  }, [raster, scale, eo.agreement]);

  if (!eo.available) {
    return (
      <div className="relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-[#1F2937] bg-[#0B0F14] px-4 text-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#607580" strokeWidth="1.5" className="opacity-70">
          <path d="M17.5 19H6.5A4.5 4.5 0 0 1 6.5 10a5.5 5.5 0 0 1 10.6-1.9A4 4 0 0 1 17.5 19z" />
        </svg>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#607580]">EO Unavailable</p>
        <p className="text-[10px] text-[#8497A3]">{eo.reason}</p>
        <p className="mono text-[9px] text-[#607580]">{eo.satellite}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[#1F2937] bg-black">
      <canvas ref={canvasRef} width={CANVAS_PX} height={CANVAS_PX} className="h-full w-full" />
      <div className="mono absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-[#D3DEE4]">
        {acquisitionLabel}
      </div>
      <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-[#D3DEE4]">
        {eo.satellite}
      </div>
      <div className={`absolute bottom-2 left-2 rounded px-1.5 py-0.5 text-[9px] font-semibold ${eo.agreement ? 'bg-red-900/70 text-red-200' : 'bg-amber-900/70 text-amber-200'}`}>
        {eo.agreement ? 'Confirms Oil Signature' : 'Inconclusive'}
      </div>
    </div>
  );
}

export default function Section3_SlickAnalysis({ data, status }) {
  const [showOverlay, setShowOverlay] = useState(false);

  const raster = useMemo(() => {
    if (!data) return null;
    return generateSarRaster({
      seed: data.seed,
      slick: data.slick,
      lookalike: data._sarGroundTruth?.lookalike,
      candidates: data.candidates || [],
    });
  }, [data]);

  if (!data || !raster) return <SectionCard number={3} title="Slick Analysis" status="Pending"><div className="h-20" /></SectionCard>;

  const acquisitionLabel = new Date(data.acquisitionTime).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
  }) + ' UTC';
  const eoAcquisitionLabel = data.eoValidation?.acquisitionTime
    ? new Date(data.eoValidation.acquisitionTime).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
      }) + ' UTC'
    : '';

  return (
    <SectionCard
      number={3}
      title="Slick Analysis"
      status={status}
      realDataNote="Panels A/B would be actual Sentinel-1 pixels run through a trained segmentation model (e.g. DeepLabV3+), not a rendered texture. Panel C would be a real Sentinel-2/Landsat frame, only usable when the sky was actually clear. Spill age would use the true pixel colour, not a random Bonn Code pick."
    >
      <div className="space-y-4">
        {/* SAR A/B/C panels — the primary evidence, given full width and room to breathe */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Sentinel-1 SAR — Detection Result</span>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#607580]">
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(e) => setShowOverlay(e.target.checked)}
                className="accent-[#167EAD]"
              />
              Show Rejected Look-Alike
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-[#8497A3] uppercase tracking-wider">A · Original SAR Scene</span>
              <SarPanel raster={raster} mode="raw" showLookalike={false} acquisitionLabel={acquisitionLabel} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-[#8497A3] uppercase tracking-wider">B · Detected Oil Slick (Overlay)</span>
              <SarPanel raster={raster} mode="detected" showLookalike={showOverlay} acquisitionLabel={acquisitionLabel} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-[#8497A3] uppercase tracking-wider">C · Electro-Optical Validation</span>
              <EoPanel eo={data.eoValidation} acquisitionLabel={eoAcquisitionLabel} />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[10px] text-[#607580]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#C7464F]" /> Detected Oil Slick</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white ring-1 ring-[#8497A3]" /> Vessel Contact (AIS)</span>
            {showOverlay && (
              <span className="flex items-center gap-1.5"><span className="h-0 w-3 border-t-2 border-dashed border-[#B77B18]" /> Rejected Look-Alike</span>
            )}
            {raster.excludedVesselCount > 0 && (
              <span className="ml-auto text-[#8497A3]">+{raster.excludedVesselCount} contact{raster.excludedVesselCount > 1 ? 's' : ''} outside scene extent</span>
            )}
          </div>
        </div>

        {/* Key measurements — a single glanceable strip, same pattern as the Incident alert */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#D3DEE4] bg-[#D3DEE4] sm:grid-cols-3 lg:grid-cols-6">
          <div className="bg-white px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Length</span>
            <p className="mono text-sm font-semibold text-[#172A35]">{data.slick.length} m</p>
          </div>
          <div className="bg-white px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Width</span>
            <p className="mono text-sm font-semibold text-[#172A35]">{data.slick.width} m</p>
          </div>
          <div className="bg-white px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Area</span>
            <p className="mono text-sm font-semibold text-[#172A35]">{data.slick.area.toLocaleString()} m²</p>
          </div>
          <div className="bg-white px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Orientation</span>
            <p className="mono text-sm font-semibold text-[#172A35]">{data.slick.orientation}°</p>
          </div>
          <div className="bg-white px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Top Classification</span>
            <p className="text-sm font-semibold text-[#167EAD]">Oil {(data.classification.oil * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-white px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">Estimated Age</span>
            <p className="mono text-sm font-semibold text-[#172A35]">{data.spillAge.ageHours}h</p>
          </div>
        </div>

        {/* Supporting detail — three cards side by side now that the images have their own full-width row above */}
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-4 space-y-2.5">
            <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Classification Confidence</span>
            <ConfidenceBar label="Oil" value={data.classification.oil} color="#167EAD" />
            <ConfidenceBar label="Look-Alike" value={data.classification.lookalike} color="#B77B18" />
            <ConfidenceBar label="Clean" value={data.classification.clean} color="#287A5D" />
            <ConfidenceBar label="Unknown" value={data.classification.unknown} color="#8497A3" />
            <div className="mt-1 border-t border-[#D3DEE4] pt-2 text-[10px]">
              {data.eoValidation?.available ? (
                <span className={data.eoValidation.agreement ? 'text-[#C7464F]' : 'text-[#B77B18]'}>
                  ● EO {data.eoValidation.agreement ? 'confirms' : 'inconclusive on'} oil signature ({data.eoValidation.satellite})
                </span>
              ) : (
                <span className="text-[#8497A3]">● EO unavailable — {data.eoValidation?.reason}</span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-4">
            <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Spill Age Estimate</span>
            <p className="mt-0.5 text-[10px] text-[#8497A3]">Bonn Code {data.spillAge.appearanceCode} — {data.spillAge.appearanceLabel}, independent of Step 4</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-[#8497A3]">Age Range</span>
                <p className="mono text-sm text-[#172A35]">{data.spillAge.ageRangeHours[0]}–{data.spillAge.ageRangeHours[1]}h</p>
              </div>
              <div>
                <span className="text-xs text-[#8497A3]">Weathering</span>
                <p className="text-sm text-[#172A35]">{data.spillAge.weatheringStage}</p>
              </div>
              <div>
                <span className="text-xs text-[#8497A3]">Est. Thickness</span>
                <p className="mono text-sm text-[#172A35]">{data.spillAge.thicknessUsedMm} mm</p>
              </div>
              <div>
                <span className="text-xs text-[#8497A3]">Est. Volume</span>
                <p className="mono text-sm text-[#172A35]">{data.spillAge.estimatedVolumeM3.toLocaleString()} m³</p>
              </div>
            </div>
            <div className={`mt-2 rounded border px-2 py-1 text-[10px] ${data.spillAge.agreesWithHindcast ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              {data.spillAge.agreesWithHindcast
                ? `✓ Corroborates Step 4 hindcast (~${data.spillAge.hindcastAgeHours}h)`
                : `~ Differs from Step 4 hindcast (~${data.spillAge.hindcastAgeHours}h) — worth re-checking`}
            </div>
          </div>

          <div className="rounded-lg border border-[#D3DEE4] bg-[#EDF3F6] p-4">
            <span className="text-xs font-semibold text-[#607580] uppercase tracking-wider">Perimeter</span>
            <p className="mono text-sm text-[#172A35]">{data.slick.perimeter} m</p>

            {raster.nearestVessels.length > 0 ? (
              <>
                <span className="mt-3 block text-xs font-semibold text-[#607580] uppercase tracking-wider">Nearest AIS Suspects</span>
                <p className="mt-0.5 text-[10px] text-[#8497A3]">From backward-drift reconstruction, not this SAR pass.</p>
                <ul className="mt-2 space-y-1.5">
                  {raster.nearestVessels.map((v) => {
                    const inFrame = raster.vessels.some((iv) => iv.imo === v.imo);
                    return (
                      <li key={v.imo} className="flex items-center justify-between text-xs">
                        <span className="text-[#172A35]">
                          {inFrame && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#FDE68A] ring-1 ring-[#B77B18]" />}
                          {v.name}
                        </span>
                        <span className="mono text-[#8497A3]">{v.distKm.toFixed(1)} km</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ConfidenceBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs text-[#607580]">{label}</span>
      <div className="h-2.5 flex-1 rounded-full bg-[#EDF3F6]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="mono w-12 text-right text-xs text-[#172A35]">{(value * 100).toFixed(1)}%</span>
    </div>
  );
}