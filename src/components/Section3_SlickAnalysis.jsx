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
          stroke: '#D97706',
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
      <div className="mono absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-[#E5E7EB]">
        {acquisitionLabel}
      </div>

      {/* North arrow */}
      <div className="absolute right-2 top-2 flex flex-col items-center rounded bg-black/60 px-1.5 py-1 text-[#E5E7EB]">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l6 18-6-4-6 4z" /></svg>
        <span className="mono text-[9px] leading-none">N</span>
      </div>

      {/* Scale bar */}
      <div className="mono absolute bottom-2 left-2 flex flex-col items-start gap-0.5 rounded bg-black/60 px-1.5 py-1 text-[9px] text-[#E5E7EB]">
        <div
          className="relative h-1.5 border-b border-[#E5E7EB]"
          style={{ width: `${((raster.scaleBarKm * 1000) / raster.metersPerPx / raster.gridSize) * 100}%`, minWidth: 24 }}
        >
          <span className="absolute left-0 top-0 h-full border-l border-[#E5E7EB]" />
          <span className="absolute right-0 top-0 h-full border-r border-[#E5E7EB]" />
        </div>
        <span>{raster.scaleBarKm} km</span>
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

  return (
    <SectionCard number={3} title="Slick Analysis" status={status}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* SAR A/B panels */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Sentinel-1 SAR — Detection Result</span>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#6B7280]">
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(e) => setShowOverlay(e.target.checked)}
                className="accent-[#0EA5B7]"
              />
              Show Rejected Look-Alike
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">A · Original SAR Scene</span>
              <SarPanel raster={raster} mode="raw" showLookalike={false} acquisitionLabel={acquisitionLabel} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">B · Detected Oil Slick (Overlay)</span>
              <SarPanel raster={raster} mode="detected" showLookalike={showOverlay} acquisitionLabel={acquisitionLabel} />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[10px] text-[#6B7280]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#DC2626]" /> Detected Oil Slick</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white ring-1 ring-[#9CA3AF]" /> Vessel Contact (AIS)</span>
            {showOverlay && (
              <span className="flex items-center gap-1.5"><span className="h-0 w-3 border-t-2 border-dashed border-[#D97706]" /> Rejected Look-Alike</span>
            )}
            {raster.excludedVesselCount > 0 && (
              <span className="ml-auto text-[#9CA3AF]">+{raster.excludedVesselCount} contact{raster.excludedVesselCount > 1 ? 's' : ''} outside scene extent</span>
            )}
          </div>
        </div>

        {/* Classification + Stats */}
        <div className="space-y-4">
          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-4 space-y-2.5">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Classification Confidence</span>
            <ConfidenceBar label="Oil" value={data.classification.oil} color="#0EA5B7" />
            <ConfidenceBar label="Look-Alike" value={data.classification.lookalike} color="#D97706" />
            <ConfidenceBar label="Clean" value={data.classification.clean} color="#16A34A" />
            <ConfidenceBar label="Unknown" value={data.classification.unknown} color="#9CA3AF" />
          </div>

          <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-4">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Slick Properties</span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-[#9CA3AF]">Length</span>
                <p className="mono text-sm text-[#374151]">{data.slick.length} m</p>
              </div>
              <div>
                <span className="text-xs text-[#9CA3AF]">Width</span>
                <p className="mono text-sm text-[#374151]">{data.slick.width} m</p>
              </div>
              <div>
                <span className="text-xs text-[#9CA3AF]">Area</span>
                <p className="mono text-sm text-[#374151]">{data.slick.area} m²</p>
              </div>
              <div>
                <span className="text-xs text-[#9CA3AF]">Orientation</span>
                <p className="mono text-sm text-[#374151]">{data.slick.orientation}°</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-[#9CA3AF]">Perimeter</span>
                <p className="mono text-sm text-[#374151]">{data.slick.perimeter} m</p>
              </div>
            </div>
          </div>

          {raster.nearestVessels.length > 0 && (
            <div className="rounded-lg border border-[#E2E5EA] bg-[#F9FAFB] p-4">
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Nearest AIS Suspects</span>
              <p className="mt-0.5 text-[10px] text-[#9CA3AF]">From backward-drift reconstruction, not this SAR pass — see Vessel Identification below.</p>
              <ul className="mt-2 space-y-1.5">
                {raster.nearestVessels.map((v) => {
                  const inFrame = raster.vessels.some((iv) => iv.imo === v.imo);
                  return (
                    <li key={v.imo} className="flex items-center justify-between text-xs">
                      <span className="text-[#374151]">
                        {inFrame && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#FDE68A] ring-1 ring-[#D97706]" />}
                        {v.name}
                      </span>
                      <span className="mono text-[#9CA3AF]">{v.distKm.toFixed(1)} km</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function ConfidenceBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs text-[#6B7280]">{label}</span>
      <div className="h-2.5 flex-1 rounded-full bg-[#F3F4F6]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="mono w-12 text-right text-xs text-[#374151]">{(value * 100).toFixed(1)}%</span>
    </div>
  );
}
