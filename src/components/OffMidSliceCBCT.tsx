import React, { useEffect, useMemo, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { ScannerParams, huToMu } from '../lib/calculations';
import { RadialMapConfig, resolutionAt3D } from '../lib/radialMap';

interface OffMidSliceCBCTProps {
  params: ScannerParams;
  contrast: number;
  roseThreshold: number;
  phantomR: number;
  arcDeg: number;
  arcCenterDeg: number;
  sod: number;
}

const GRID_N = 40;

export const OffMidSliceCBCT: React.FC<OffMidSliceCBCTProps> = ({
  params,
  contrast,
  roseThreshold,
  phantomR,
  arcDeg,
  arcCenterDeg,
  sod,
}) => {
  const [halfHeight, setHalfHeight] = useState(phantomR);
  const plotRef = useRef<HTMLDivElement>(null);

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
    };
  }, [params, contrast, roseThreshold, phantomR, arcDeg, arcCenterDeg, sod]);

  useEffect(() => {
    if (!plotRef.current) return;
    const t0 = performance.now();
    const R = config.R;
    const Z = halfHeight;
    const N = GRID_N;

    type Surface = {
      X: number[][];
      Y: number[][];
      Zg: number[][];
      C: (number | null)[][];
    };

    const empty = (): Surface => ({ X: [], Y: [], Zg: [], C: [] });

    // ---------- 1. Cut plane (y = 0, half y ≥ 0 side removed) ----------
    const cut = empty();
    for (let i = 0; i < N; i++) {
      const zi = -Z + (2 * Z * i) / (N - 1);
      const rowX: number[] = [];
      const rowY: number[] = [];
      const rowZ: number[] = [];
      const rowC: (number | null)[] = [];
      for (let j = 0; j < N; j++) {
        const xj = -R + (2 * R * j) / (N - 1);
        rowX.push(xj);
        rowY.push(0);
        rowZ.push(zi);
        const v = resolutionAt3D(xj, 0, zi, config);
        rowC.push(isFinite(v) ? v : null);
      }
      cut.X.push(rowX);
      cut.Y.push(rowY);
      cut.Zg.push(rowZ);
      cut.C.push(rowC);
    }

    // ---------- 2. Curved cylinder wall (y ≥ 0 half) ----------
    const wall = empty();
    const innerR = R * 0.99; // evaluate slightly inside the edge
    for (let i = 0; i < N; i++) {
      const zi = -Z + (2 * Z * i) / (N - 1);
      const rowX: number[] = [];
      const rowY: number[] = [];
      const rowZ: number[] = [];
      const rowC: (number | null)[] = [];
      for (let j = 0; j < N; j++) {
        const phi = (j / (N - 1)) * Math.PI; // [0, π] → upper half
        const xj = R * Math.cos(phi);
        const yj = R * Math.sin(phi);
        rowX.push(xj);
        rowY.push(yj);
        rowZ.push(zi);
        const v = resolutionAt3D(innerR * Math.cos(phi), innerR * Math.sin(phi), zi, config);
        rowC.push(isFinite(v) ? v : null);
      }
      wall.X.push(rowX);
      wall.Y.push(rowY);
      wall.Zg.push(rowZ);
      wall.C.push(rowC);
    }

    // ---------- 3. Top cap (z = +Z, y ≥ 0 half) ----------
    const top = empty();
    for (let i = 0; i < N; i++) {
      const yi = (i / (N - 1)) * R;
      const rowX: number[] = [];
      const rowY: number[] = [];
      const rowZ: number[] = [];
      const rowC: (number | null)[] = [];
      for (let j = 0; j < N; j++) {
        const xj = -R + (2 * R * j) / (N - 1);
        rowX.push(xj);
        rowY.push(yi);
        rowZ.push(Z);
        if (xj * xj + yi * yi >= R * R) {
          rowC.push(null);
        } else {
          const v = resolutionAt3D(xj, yi, Z, config);
          rowC.push(isFinite(v) ? v : null);
        }
      }
      top.X.push(rowX);
      top.Y.push(rowY);
      top.Zg.push(rowZ);
      top.C.push(rowC);
    }

    // ---------- 4. Bottom cap (z = −Z, y ≥ 0 half) ----------
    const bot = empty();
    for (let i = 0; i < N; i++) {
      const yi = (i / (N - 1)) * R;
      const rowX: number[] = [];
      const rowY: number[] = [];
      const rowZ: number[] = [];
      const rowC: (number | null)[] = [];
      for (let j = 0; j < N; j++) {
        const xj = -R + (2 * R * j) / (N - 1);
        rowX.push(xj);
        rowY.push(yi);
        rowZ.push(-Z);
        if (xj * xj + yi * yi >= R * R) {
          rowC.push(null);
        } else {
          const v = resolutionAt3D(xj, yi, -Z, config);
          rowC.push(isFinite(v) ? v : null);
        }
      }
      bot.X.push(rowX);
      bot.Y.push(rowY);
      bot.Zg.push(rowZ);
      bot.C.push(rowC);
    }

    // Shared colorscale range across all four surfaces
    let cmin = Infinity;
    let cmax = -Infinity;
    const scan = (s: Surface) => {
      for (const row of s.C)
        for (const v of row) {
          if (v != null && isFinite(v)) {
            if (v < cmin) cmin = v;
            if (v > cmax) cmax = v;
          }
        }
    };
    scan(cut);
    scan(wall);
    scan(top);
    scan(bot);

    const compute_ms = performance.now() - t0;

    const mkSurface = (s: Surface, name: string, showscale: boolean): any => ({
      type: 'surface',
      x: s.X,
      y: s.Y,
      z: s.Zg,
      surfacecolor: s.C,
      colorscale: 'Viridis',
      cmin,
      cmax,
      showscale,
      colorbar: showscale
        ? { title: 'lp/mm', thickness: 12, len: 0.85, tickfont: { size: 10 }, titlefont: { size: 10 } }
        : undefined,
      name,
      hovertemplate:
        'x = %{x:.2f} mm<br>y = %{y:.2f} mm<br>z = %{z:.2f} mm<br>res = %{surfacecolor:.3f} lp/mm<extra></extra>',
    });

    Plotly.react(
      plotRef.current,
      [
        mkSurface(cut, 'cut plane (y=0)', true),
        mkSurface(wall, 'cylinder wall', false),
        mkSurface(top, 'top cap', false),
        mkSurface(bot, 'bottom cap', false),
      ],
      {
        margin: { l: 0, r: 0, t: 10, b: 0 },
        scene: {
          xaxis: { title: 'x (mm)', tickfont: { size: 9 }, titlefont: { size: 10 } },
          yaxis: { title: 'y (mm)', tickfont: { size: 9 }, titlefont: { size: 10 } },
          zaxis: { title: 'z (mm)', tickfont: { size: 9 }, titlefont: { size: 10 } },
          aspectmode: 'manual',
          aspectratio: { x: 1, y: 1, z: Math.min(1.4, (2 * Z) / (2 * R)) },
          camera: { eye: { x: 1.6, y: -1.4, z: 0.9 } },
        },
        font: { family: 'ui-monospace, monospace', size: 11 },
        autosize: true,
        annotations: [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.0,
            y: 1.02,
            xanchor: 'left',
            yanchor: 'bottom',
            text: `${N}×${N} per surface · ${compute_ms.toFixed(0)} ms · res range: ${cmin.toFixed(2)}–${cmax.toFixed(2)} lp/mm`,
            showarrow: false,
            font: { size: 9, color: '#6b7280' },
          },
        ],
      } as any,
      { displaylogo: false, responsive: true } as any
    );
  }, [config, halfHeight]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <label className="text-gray-700 block mb-1 flex items-center justify-between gap-2">
            <span>Cylinder half-height Z</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                value={halfHeight}
                onChange={(e) => setHalfHeight(Number(e.target.value))}
                step={1}
                className="w-16 px-1 py-0.5 border border-gray-300 rounded text-right"
              />
              <span>mm</span>
            </span>
          </label>
          <div className="text-gray-500 text-[10px] mt-0.5">extent of cylinder above and below midplane</div>
        </div>
      </div>
      <div ref={plotRef} style={{ width: '100%', height: 560 }} />
    </div>
  );
};
