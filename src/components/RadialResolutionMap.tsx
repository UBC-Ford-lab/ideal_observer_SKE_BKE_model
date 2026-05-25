import React, { useEffect, useMemo, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { ScannerParams, huToMu } from '../lib/calculations';
import {
  RadialMapConfig,
  ResolutionMap,
  EffectiveResolutionMap,
  resolutionMap,
  effectiveMap,
  crossoverPolylines,
  bilinearSample,
  detectorNyquist,
} from '../lib/radialMap';

interface RadialResolutionMapProps {
  params: ScannerParams;
  contrast: number;
  roseThreshold: number;
  phantomR: number;
  setPhantomR: (v: number) => void;
  arcDeg: number;
  setArcDeg: (v: number) => void;
  arcCenterDeg: number;
  setArcCenterDeg: (v: number) => void;
  sod: number;
  setSod: (v: number) => void;
  showCrowther: boolean;
  objCx: number;
  setObjCx: (v: number) => void;
  objCy: number;
  setObjCy: (v: number) => void;
  objR: number;
  setObjR: (v: number) => void;
}

const GRID_N = 60;
const GAMMA = 0.3;
const CONTOUR_LEVELS = [0.5, 1, 2, 3, 5, 10];
const COLORBAR_TICKS = [0.5, 1, 2, 3, 5, 7, 10, 15, 20];

// matplotlib `turbo`, sampled at 33 stops (every 1/32). The paper figures
// use matplotlib.cm.turbo via PowerNorm; Plotly does have a named 'Turbo'
// but pinning the palette here guarantees an exact match across plotly.js
// versions and gives smoother interpolation than the default ~9 stops.
const TURBO_STOPS: Array<[number, string]> = [
  [0.0000, 'rgb(48,18,59)'],
  [0.03125, 'rgb(54,33,95)'],
  [0.0625, 'rgb(61,49,127)'],
  [0.09375, 'rgb(66,65,156)'],
  [0.125, 'rgb(70,82,183)'],
  [0.15625, 'rgb(70,97,203)'],
  [0.1875, 'rgb(68,113,221)'],
  [0.21875, 'rgb(63,129,234)'],
  [0.25, 'rgb(54,144,243)'],
  [0.28125, 'rgb(43,160,250)'],
  [0.3125, 'rgb(33,174,254)'],
  [0.34375, 'rgb(28,189,253)'],
  [0.375, 'rgb(27,201,248)'],
  [0.40625, 'rgb(28,212,238)'],
  [0.4375, 'rgb(31,222,225)'],
  [0.46875, 'rgb(38,231,205)'],
  [0.5, 'rgb(54,237,182)'],
  [0.53125, 'rgb(77,242,155)'],
  [0.5625, 'rgb(106,245,124)'],
  [0.59375, 'rgb(135,246,94)'],
  [0.625, 'rgb(162,244,67)'],
  [0.65625, 'rgb(186,238,42)'],
  [0.6875, 'rgb(206,228,28)'],
  [0.71875, 'rgb(222,218,26)'],
  [0.75, 'rgb(233,206,33)'],
  [0.78125, 'rgb(242,191,40)'],
  [0.8125, 'rgb(247,174,42)'],
  [0.84375, 'rgb(248,153,38)'],
  [0.875, 'rgb(244,128,29)'],
  [0.90625, 'rgb(235,100,19)'],
  [0.9375, 'rgb(220,73,12)'],
  [0.96875, 'rgb(199,48,8)'],
  [1.0, 'rgb(165,41,26)'],
];

// Power-norm forward transform: maps a real lp/mm value to [0, 1] in display
// space, matching matplotlib's PowerNorm(gamma=GAMMA, vmin, vmax).
function powerNormForward(v: number, vmin: number, vmax: number): number {
  if (vmax <= vmin) return 0;
  const t = (v - vmin) / (vmax - vmin);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(t, GAMMA);
}

function transformGrid(
  z: (number | null)[][],
  vmin: number,
  vmax: number
): (number | null)[][] {
  return z.map((row) =>
    row.map((v) => (v == null ? null : powerNormForward(Math.min(Math.max(v, vmin), vmax), vmin, vmax)))
  );
}

// Plotly's built-in 'Turbo' colorscale matches matplotlib.cm.turbo.
const TURBO_COLORSCALE = TURBO_STOPS;

// Build colorbar ticks in transformed space, labelled with real lp/mm + µm.
function buildColorbar(vmin: number, vmax: number) {
  const ticks = COLORBAR_TICKS.filter((v) => v >= vmin && v <= vmax);
  return {
    tickvals: ticks.map((v) => powerNormForward(v, vmin, vmax)),
    ticktext: ticks.map((v) => `${v < 1 ? v.toFixed(1) : v.toFixed(0)} lp/mm  (${(1000 / (2 * v)).toFixed(0)} µm)`),
  };
}

// Outline points for a circle centred at (cx, cy) with radius r.
function circleOutline(cx: number, cy: number, r: number, n: number = 200) {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI;
    x.push(cx + r * Math.cos(t));
    y.push(cy + r * Math.sin(t));
  }
  return { x, y };
}

// Build the scan-arc indicator just outside the phantom.
function scanArcOutline(c: RadialMapConfig) {
  const arcRadius = c.R * 1.08;
  const x: number[] = [];
  const y: number[] = [];
  const steps = 120;
  const len = c.arcEndRad - c.arcStartRad;
  for (let i = 0; i <= steps; i++) {
    const t = c.arcStartRad + (i / steps) * len;
    x.push(arcRadius * Math.cos(t));
    y.push(arcRadius * Math.sin(t));
  }
  return { x, y };
}

// ---------- 2D heatmap renderer ---------------------------------------------
interface HeatmapOptions {
  showObjectBoundary: boolean;
  showCrossover?: EffectiveResolutionMap;
}

function renderHeatmap2D(
  el: HTMLDivElement,
  data: ResolutionMap,
  c: RadialMapConfig,
  vmin: number,
  vmax: number,
  opts: HeatmapOptions
) {
  const zDisp = transformGrid(data.z, vmin, vmax);
  const colorbar = buildColorbar(vmin, vmax);

  const phantom = circleOutline(0, 0, c.R);
  const arc = scanArcOutline(c);
  const cx = c.objCx ?? 0;
  const cy = c.objCy ?? 0;
  const rObj = c.objR ?? c.R;
  const objBoundary = circleOutline(cx, cy, rObj);

  // Radial reference rings at 10/20/30/40 mm (those that fit inside R).
  const ringTraces: any[] = [];
  for (const rAnn of [10, 20, 30, 40]) {
    if (rAnn >= c.R) continue;
    const ring = circleOutline(0, 0, rAnn);
    ringTraces.push({
      type: 'scatter',
      mode: 'lines',
      x: ring.x,
      y: ring.y,
      line: { color: 'rgba(255,255,255,0.35)', width: 0.5, dash: 'dot' },
      hoverinfo: 'skip',
      showlegend: false,
    });
  }

  const traces: any[] = [
    {
      type: 'heatmap',
      z: zDisp,
      x: data.x,
      y: data.y,
      // customdata carries the real lp/mm value so hover shows actual data.
      customdata: data.z,
      zmin: 0,
      zmax: 1,
      colorscale: TURBO_COLORSCALE,
      colorbar: {
        thickness: 12,
        len: 0.85,
        tickfont: { size: 9 },
        tickvals: colorbar.tickvals,
        ticktext: colorbar.ticktext,
        x: 1.02,
        xanchor: 'left',
      },
      hovertemplate:
        'x = %{x:.2f} mm<br>y = %{y:.2f} mm<br>res = %{customdata:.3f} lp/mm<extra></extra>',
      connectgaps: false,
      zsmooth: 'best',
    },
    // Iso-resolution contour lines at the explicit paper levels — one trace
    // per level since Plotly's `contour` only supports evenly-spaced ranges.
    ...CONTOUR_LEVELS.filter((lvl) => lvl >= vmin && lvl <= vmax).map((lvl) => ({
      type: 'contour',
      z: data.z,
      x: data.x,
      y: data.y,
      autocontour: false,
      contours: {
        coloring: 'none',
        showlines: true,
        showlabels: true,
        start: lvl,
        end: lvl,
        size: 1,
        labelfont: { size: 8, color: '#222' },
        labelformat: `${lvl} lp/mm`,
      },
      line: { color: '#222', width: 0.7, smoothing: 0 },
      showscale: false,
      hoverinfo: 'skip',
    })),
    ...ringTraces,
    {
      type: 'scatter',
      mode: 'lines',
      x: phantom.x,
      y: phantom.y,
      line: { color: '#1f2937', width: 1.5 },
      hoverinfo: 'skip',
      showlegend: false,
    },
    {
      type: 'scatter',
      mode: 'lines',
      x: arc.x,
      y: arc.y,
      line: { color: '#1d4ed8', width: 3 },
      hoverinfo: 'skip',
      showlegend: false,
    },
    // COR marker (white +).
    {
      type: 'scatter',
      mode: 'markers',
      x: [0],
      y: [0],
      marker: { symbol: 'cross-thin', color: 'white', size: 12, line: { color: 'white', width: 2 } },
      hoverinfo: 'skip',
      showlegend: false,
    },
  ];

  // Object boundary (cyan), only when distinct from phantom or when explicitly requested.
  if (opts.showObjectBoundary) {
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: objBoundary.x,
      y: objBoundary.y,
      line: { color: '#00bcd4', width: 1.5 },
      hoverinfo: 'skip',
      showlegend: false,
    });
  }

  // Crossover polyline (white dashed) on the overlay panel.
  if (opts.showCrossover) {
    const polys = crossoverPolylines(opts.showCrossover);
    const cxs: (number | null)[] = [];
    const cys: (number | null)[] = [];
    for (const seg of polys) {
      cxs.push(seg[0].x, seg[1].x, null);
      cys.push(seg[0].y, seg[1].y, null);
    }
    if (cxs.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: cxs,
        y: cys,
        line: { color: 'white', width: 2, dash: 'dash' },
        hoverinfo: 'skip',
        showlegend: false,
      });
    }
  }

  Plotly.react(
    el,
    traces,
    {
      // Generous top + right margin so colorbar title and tick labels never
      // overlap the panel header (which is now a React H4 above the div).
      margin: { l: 55, r: 90, t: 10, b: 50 },
      showlegend: false,
      xaxis: {
        title: { text: 'x (mm)', font: { size: 11 } },
        scaleanchor: 'y',
        scaleratio: 1,
        zeroline: false,
        tickfont: { size: 10 },
      },
      yaxis: {
        title: { text: 'y (mm)', font: { size: 11 } },
        zeroline: false,
        tickfont: { size: 10 },
      },
      font: { family: 'ui-monospace, monospace', size: 11 },
      autosize: true,
    } as any,
    { displaylogo: false, responsive: true } as any
  );
}

// ---------- 3D surface renderer ---------------------------------------------
function renderSurface3D(
  el: HTMLDivElement,
  data: ResolutionMap,
  vmin: number,
  vmax: number,
  crossover?: EffectiveResolutionMap
) {
  // Plotly surface: real z (lp/mm) on the vertical axis; colour via surfacecolor
  // mapped through the power-norm transform.
  const surfaceColor: (number | null)[][] = transformGrid(data.z, vmin, vmax);

  const traces: any[] = [
    {
      type: 'surface',
      x: data.x,
      y: data.y,
      z: data.z,
      surfacecolor: surfaceColor,
      cmin: 0,
      cmax: 1,
      colorscale: TURBO_COLORSCALE,
      showscale: false,
      connectgaps: false,
      hovertemplate:
        'x = %{x:.2f} mm<br>y = %{y:.2f} mm<br>res = %{z:.3f} lp/mm<extra></extra>',
      contours: {
        z: { show: true, usecolormap: true, highlightcolor: '#fff', project: { z: true } },
      },
    },
  ];

  // Lift the crossover polyline onto the surface for the overlay 3D panel.
  if (crossover) {
    const polys = crossoverPolylines(crossover);
    const xs: (number | null)[] = [];
    const ys: (number | null)[] = [];
    const zs: (number | null)[] = [];
    for (const seg of polys) {
      for (const p of seg) {
        const zv = bilinearSample(data, p.x, p.y);
        xs.push(p.x);
        ys.push(p.y);
        zs.push(isFinite(zv) ? zv : null);
      }
      xs.push(null);
      ys.push(null);
      zs.push(null);
    }
    if (xs.length > 0) {
      traces.push({
        type: 'scatter3d',
        mode: 'lines',
        x: xs,
        y: ys,
        z: zs,
        line: { color: 'white', width: 5, dash: 'dash' },
        hoverinfo: 'skip',
        showlegend: false,
      });
    }
  }

  Plotly.react(
    el,
    traces,
    {
      margin: { l: 0, r: 0, t: 10, b: 0 },
      scene: {
        xaxis: { title: { text: 'x (mm)', font: { size: 10 } }, tickfont: { size: 9 } },
        yaxis: { title: { text: 'y (mm)', font: { size: 10 } }, tickfont: { size: 9 } },
        zaxis: { title: { text: 'res (lp/mm)', font: { size: 10 } }, tickfont: { size: 9 } },
        aspectmode: 'manual',
        aspectratio: { x: 1, y: 1, z: 0.6 },
        camera: { eye: { x: 1.6, y: 1.6, z: 1.0 } },
      },
      font: { family: 'ui-monospace, monospace', size: 11 },
      autosize: true,
    } as any,
    { displaylogo: false, responsive: true } as any
  );
}

// ----------------------------------------------------------------------------

export const RadialResolutionMap: React.FC<RadialResolutionMapProps> = ({
  params,
  contrast,
  roseThreshold,
  phantomR,
  setPhantomR,
  arcDeg,
  setArcDeg,
  arcCenterDeg,
  setArcCenterDeg,
  sod,
  setSod,
  showCrowther,
  objCx,
  setObjCx,
  objCy,
  setObjCy,
  objR,
  setObjR,
}) => {
  const noisePlotRef = useRef<HTMLDivElement>(null);
  const noise3dRef = useRef<HTMLDivElement>(null);
  const crowtherPlotRef = useRef<HTMLDivElement>(null);
  const crowther3dRef = useRef<HTMLDivElement>(null);
  const overlayPlotRef = useRef<HTMLDivElement>(null);
  const overlay3dRef = useRef<HTMLDivElement>(null);

  const config = useMemo<RadialMapConfig>(() => {
    const arcRad = (arcDeg * Math.PI) / 180;
    const arcCenterRad = (arcCenterDeg * Math.PI) / 180;
    return {
      R: phantomR,
      N0: params.N0,
      mu_bg: params.muBg,
      N_theta: params.nTheta,
      delta_a_obj: params.deltaA_obj,
      delta_mu: huToMu(contrast),
      d_prime_threshold: roseThreshold,
      arcStartRad: arcCenterRad - arcRad / 2,
      arcEndRad: arcCenterRad + arcRad / 2,
      SOD: sod,
      objCx,
      objCy,
      objR,
    };
  }, [params, contrast, roseThreshold, phantomR, arcDeg, arcCenterDeg, sod, objCx, objCy, objR]);

  useEffect(() => {
    if (!noisePlotRef.current) return;

    if (!showCrowther) {
      // Original noise-only view.
      const data = resolutionMap(config, GRID_N);
      const vmin = data.zMin;
      const vmax = Math.min(data.zMax, detectorNyquist(config));
      renderHeatmap2D(noisePlotRef.current, data, config, vmin, vmax, {
        showObjectBoundary: objCx !== 0 || objCy !== 0 || objR !== phantomR,
      });
      if (noise3dRef.current) {
        renderSurface3D(noise3dRef.current, data, vmin, vmax);
      }
      return;
    }

    // Crowther toggle on — compute all three and share a colour scale.
    const eff = effectiveMap(config, GRID_N);
    const crow: ResolutionMap = {
      x: eff.x,
      y: eff.y,
      z: eff.zCrowther,
      zMin: Infinity,
      zMax: -Infinity,
    };
    const noise: ResolutionMap = {
      x: eff.x,
      y: eff.y,
      z: eff.zNoise,
      zMin: Infinity,
      zMax: -Infinity,
    };
    for (let j = 0; j < eff.y.length; j++) {
      for (let i = 0; i < eff.x.length; i++) {
        const vc = eff.zCrowther[j][i];
        const vn = eff.zNoise[j][i];
        if (vc != null && isFinite(vc)) {
          if (vc < crow.zMin) crow.zMin = vc;
          if (vc > crow.zMax) crow.zMax = vc;
        }
        if (vn != null && isFinite(vn)) {
          if (vn < noise.zMin) noise.zMin = vn;
          if (vn > noise.zMax) noise.zMax = vn;
        }
      }
    }

    // Shared colour range across all three panels. Cap vmax at detector
    // Nyquist (matches paper convention — Crowther spike near r=0 saturates).
    const nyq = detectorNyquist(config);
    const vmin = Math.min(eff.zMin, noise.zMin, crow.zMin);
    const vmax = Math.min(Math.max(eff.zMax, noise.zMax, crow.zMax), nyq);

    renderHeatmap2D(noisePlotRef.current, noise, config, vmin, vmax, {
      showObjectBoundary: true,
    });
    if (crowtherPlotRef.current) {
      renderHeatmap2D(crowtherPlotRef.current, crow, config, vmin, vmax, {
        showObjectBoundary: false,
      });
    }
    if (overlayPlotRef.current) {
      renderHeatmap2D(overlayPlotRef.current, eff, config, vmin, vmax, {
        showObjectBoundary: true,
        showCrossover: eff,
      });
    }
    if (noise3dRef.current) {
      renderSurface3D(noise3dRef.current, noise, vmin, vmax);
    }
    if (crowther3dRef.current) {
      renderSurface3D(crowther3dRef.current, crow, vmin, vmax);
    }
    if (overlay3dRef.current) {
      renderSurface3D(overlay3dRef.current, eff, vmin, vmax, eff);
    }
  }, [config, showCrowther, objCx, objCy, objR, phantomR]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <label className="text-gray-700 block mb-1">Phantom radius R (mm)</label>
          <input
            type="number"
            value={phantomR}
            onChange={(e) => setPhantomR(Number(e.target.value))}
            step={1}
            min={1}
            className="w-full px-2 py-1 border border-gray-300 rounded"
          />
          <div className="text-gray-500 text-[10px] mt-0.5">defaults to L/2 from main panel</div>
        </div>
        <div>
          <label className="text-gray-700 block mb-1 flex items-center justify-between gap-2">
            <span>Arc coverage</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                value={arcDeg}
                onChange={(e) => setArcDeg(Number(e.target.value))}
                step={5}
                className="w-14 px-1 py-0.5 border border-gray-300 rounded text-right"
              />
              <span>°</span>
            </span>
          </label>
          <input
            type="range"
            min={10}
            max={360}
            step={5}
            value={arcDeg}
            onChange={(e) => setArcDeg(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-gray-500 text-[10px] mt-0.5">angular extent of the projection arc</div>
        </div>
        <div>
          <label className="text-gray-700 block mb-1 flex items-center justify-between gap-2">
            <span>Arc center</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                value={arcCenterDeg}
                onChange={(e) => setArcCenterDeg(Number(e.target.value))}
                step={5}
                className="w-14 px-1 py-0.5 border border-gray-300 rounded text-right"
              />
              <span>°</span>
            </span>
          </label>
          <input
            type="range"
            min={-180}
            max={180}
            step={5}
            value={arcCenterDeg}
            onChange={(e) => setArcCenterDeg(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-gray-500 text-[10px] mt-0.5">where the arc is centered (rotates the map)</div>
        </div>
        <div>
          <label className="text-gray-700 block mb-1">Source–isocentre D (mm)</label>
          <input
            type="number"
            value={sod}
            onChange={(e) => setSod(Number(e.target.value))}
            step={10}
            min={1}
            className="w-full px-2 py-1 border border-gray-300 rounded"
          />
          <div className="text-gray-500 text-[10px] mt-0.5">
            point-source distance; sets fan-beam chord &amp; magnification
          </div>
        </div>
      </div>

      {/* Object-model controls (only meaningful when Crowther overlay is on,
          but shown whenever they differ from defaults). */}
      {showCrowther && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono border-t pt-3">
          <div>
            <label className="text-gray-700 block mb-1">Object centre x (mm)</label>
            <input
              type="number"
              value={objCx}
              onChange={(e) => setObjCx(Number(e.target.value))}
              step={0.5}
              className="w-full px-2 py-1 border border-gray-300 rounded"
            />
            <div className="text-gray-500 text-[10px] mt-0.5">0 = centred at COR</div>
          </div>
          <div>
            <label className="text-gray-700 block mb-1">Object centre y (mm)</label>
            <input
              type="number"
              value={objCy}
              onChange={(e) => setObjCy(Number(e.target.value))}
              step={0.5}
              className="w-full px-2 py-1 border border-gray-300 rounded"
            />
            <div className="text-gray-500 text-[10px] mt-0.5">0 = centred at COR</div>
          </div>
          <div>
            <label className="text-gray-700 block mb-1">Object radius R_obj (mm)</label>
            <input
              type="number"
              value={objR}
              onChange={(e) => setObjR(Number(e.target.value))}
              step={1}
              min={0.1}
              className="w-full px-2 py-1 border border-gray-300 rounded"
            />
            <div className="text-gray-500 text-[10px] mt-0.5">defaults to phantom R</div>
          </div>
        </div>
      )}

      {/* Panels: 2D heatmap + 3D surface per row. Titles live in React HTML
          headers above each plot so they never collide with the Plotly
          colorbar or other in-chart annotations. */}
      <PanelRow
        title={showCrowther ? '(a) photon-noise resolution' : 'photon-noise resolution'}
        plotRef={noisePlotRef}
        plot3dRef={noise3dRef}
      />
      {showCrowther && (
        <>
          <PanelRow
            title={`(b) Crowther criterion — capped at detector Nyquist ${detectorNyquist(config).toFixed(1)} lp/mm`}
            plotRef={crowtherPlotRef}
            plot3dRef={crowther3dRef}
          />
          <PanelRow
            title="(c) effective = min(noise, Crowther) — white dashed: crossover"
            plotRef={overlayPlotRef}
            plot3dRef={overlay3dRef}
          />
        </>
      )}

      <div className="text-xs text-gray-600 italic leading-relaxed">
        Blue outer arc: scan-arc coverage (not to scale). White '+': centre of
        rotation. Dotted rings: 10/20/30/40 mm from COR.
        {showCrowther && (
          <>
            {' '}Cyan circle: object cylinder model used for the photon-noise chord.
            White dashed line on (c): crossover where photon-noise = Crowther limit
            (inside ≈ noise-dominated, outside ≈ angular-sampling-dominated).
          </>
        )}
      </div>
    </div>
  );
};

// One row = a panel title + the 2D heatmap (left) + the 3D surface (right).
const PanelRow: React.FC<{
  title: string;
  plotRef: React.RefObject<HTMLDivElement | null>;
  plot3dRef: React.RefObject<HTMLDivElement | null>;
}> = ({ title, plotRef, plot3dRef }) => (
  <div className="space-y-1">
    <h4 className="text-xs font-mono font-bold text-gray-800">{title}</h4>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div ref={plotRef} style={{ width: '100%', height: 480 }} />
      <div ref={plot3dRef} style={{ width: '100%', height: 480 }} />
    </div>
  </div>
);
