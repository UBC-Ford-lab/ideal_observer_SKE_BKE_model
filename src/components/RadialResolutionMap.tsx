import React, { useEffect, useMemo, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { ScannerParams, huToMu } from '../lib/calculations';
import { RadialMapConfig, resolutionMap } from '../lib/radialMap';

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
}

const GRID_N = 60;

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
}) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const plot3dRef = useRef<HTMLDivElement>(null);

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
    const data = resolutionMap(config, GRID_N);
    const compute_ms = performance.now() - t0;

    // Phantom outline
    const N_OUTLINE = 200;
    const outlineX: number[] = [];
    const outlineY: number[] = [];
    for (let i = 0; i <= N_OUTLINE; i++) {
      const t = (i / N_OUTLINE) * 2 * Math.PI;
      outlineX.push(config.R * Math.cos(t));
      outlineY.push(config.R * Math.sin(t));
    }

    // Scan-arc indicator: draw a thin arc just outside the phantom on the
    // covered side, so the user can see which angles are being scanned.
    const arcRadius = config.R * 1.08;
    const arcX: number[] = [];
    const arcY: number[] = [];
    const arcSteps = 120;
    const arcLen = config.arcEndRad - config.arcStartRad;
    for (let i = 0; i <= arcSteps; i++) {
      const t = config.arcStartRad + (i / arcSteps) * arcLen;
      arcX.push(arcRadius * Math.cos(t));
      arcY.push(arcRadius * Math.sin(t));
    }

    Plotly.react(
      plotRef.current,
      [
        {
          type: 'heatmap',
          z: data.z,
          x: data.x,
          y: data.y,
          colorscale: 'Viridis',
          colorbar: {
            title: 'lp/mm',
            thickness: 12,
            len: 0.85,
            tickfont: { size: 10 },
            titlefont: { size: 10 },
          },
          hovertemplate:
            'x = %{x:.2f} mm<br>y = %{y:.2f} mm<br>res = %{z:.3f} lp/mm<extra></extra>',
          connectgaps: false,
          zsmooth: 'best',
        } as any,
        {
          type: 'scatter',
          mode: 'lines',
          x: outlineX,
          y: outlineY,
          line: { color: '#1f2937', width: 1.5 },
          name: 'phantom',
          hoverinfo: 'skip',
          showlegend: false,
        } as any,
        {
          type: 'scatter',
          mode: 'lines',
          x: arcX,
          y: arcY,
          line: { color: '#1d4ed8', width: 3 },
          name: 'scan arc',
          hoverinfo: 'skip',
          showlegend: false,
        } as any,
      ],
      {
        margin: { l: 55, r: 30, t: 10, b: 50 },
        xaxis: {
          title: 'x (mm)',
          scaleanchor: 'y',
          scaleratio: 1,
          zeroline: false,
          tickfont: { size: 10 },
          titlefont: { size: 11 },
        },
        yaxis: {
          title: 'y (mm)',
          zeroline: false,
          tickfont: { size: 10 },
          titlefont: { size: 11 },
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
            text: `${GRID_N}×${GRID_N} grid · ${compute_ms.toFixed(0)} ms · res range: ${data.zMin.toFixed(2)}–${data.zMax.toFixed(2)} lp/mm`,
            showarrow: false,
            font: { size: 9, color: '#6b7280' },
          },
        ],
      } as any,
      { displaylogo: false, responsive: true } as any
    );

    // 3D surface plot — same data, viewed as a surface above the (x, y) plane.
    if (plot3dRef.current) {
      Plotly.react(
        plot3dRef.current,
        [
          {
            type: 'surface',
            x: data.x,
            y: data.y,
            z: data.z,
            colorscale: 'Viridis',
            showscale: false,
            connectgaps: false,
            hovertemplate:
              'x = %{x:.2f} mm<br>y = %{y:.2f} mm<br>res = %{z:.3f} lp/mm<extra></extra>',
            contours: {
              z: { show: true, usecolormap: true, highlightcolor: '#fff', project: { z: true } },
            },
          } as any,
        ],
        {
          margin: { l: 0, r: 0, t: 10, b: 0 },
          scene: {
            xaxis: { title: 'x (mm)', tickfont: { size: 9 }, titlefont: { size: 10 } },
            yaxis: { title: 'y (mm)', tickfont: { size: 9 }, titlefont: { size: 10 } },
            zaxis: { title: 'res (lp/mm)', tickfont: { size: 9 }, titlefont: { size: 10 } },
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
  }, [config]);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div ref={plotRef} style={{ width: '100%', height: 480 }} />
        <div ref={plot3dRef} style={{ width: '100%', height: 480 }} />
      </div>

      <div className="text-xs text-gray-600 italic leading-relaxed">
        The blue outer arc marks the scan-arc coverage (not to scale).
      </div>
    </div>
  );
};
