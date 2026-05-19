import React, { useEffect, useRef, useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import { ScannerParams, generateDPrimeCurve, generateMinDiameterCurve, calculateDMin, huToMu } from '../lib/calculations';

interface InteractivePlotsProps {
  params: ScannerParams;
  contrast: number;
  roseThreshold?: number;
}

export const InteractivePlots: React.FC<InteractivePlotsProps> = ({
  params,
  contrast,
  roseThreshold = 3.0,
}) => {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);

  const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#2980b9'];
  const contrastLevels = [50, 100, 200, 500, 1000];

  // Plot 1: d' vs diameter for multiple contrasts
  useEffect(() => {
    if (!ref1.current) return;

    const diameterRange = Array.from({ length: 500 }, (_, i) =>
      0.01 + (i / 500) * 4.99
    );

    const plotData = contrastLevels.map((hu, idx) => ({
      x: diameterRange,
      y: generateDPrimeCurve(diameterRange, huToMu(hu), params),
      name: `${hu} HU`,
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { color: colors[idx], width: 2 },
    }));

    const layout = {
      title: '',
      xaxis: { title: 'Disc Diameter (mm)' },
      yaxis: { title: "Detectability Index d'", range: [0, 20] },
      hovermode: 'x unified' as const,
      height: 400,
      margin: { t: 20, b: 50, l: 60, r: 20 },
      plot_bgcolor: '#f9fafb',
      paper_bgcolor: '#ffffff',
      shapes: [
        {
          type: 'line',
          x0: 0,
          x1: 5,
          y0: roseThreshold,
          y1: roseThreshold,
          xref: 'paper',
          yref: 'y',
          line: {
            color: '#999999',
            width: 1.5,
            dash: 'dot',
          },
        },
      ],
    };

    Plotly.newPlot(ref1.current, plotData as any, layout as any, { responsive: true });
  }, [params, roseThreshold]);

  // Plot 2: Dual-axis (d_min and resolution vs contrast)
  useEffect(() => {
    if (!ref2.current) return;

    const contrastRange = Array.from({ length: 100 }, (_, i) =>
      50 + (i / 100) * 1950
    );
    const results = generateMinDiameterCurve(contrastRange, params, roseThreshold);

    const plotData = [
      {
        x: results.map((r) => r.contrast),
        y: results.map((r) => r.dMin),
        name: 'Min. Detectable Disc',
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color: '#2980b9', width: 2.5 },
        yaxis: 'y' as const,
      },
      {
        x: results.map((r) => r.contrast),
        y: results.map((r) => r.resolution),
        name: 'Resolution (lp/mm)',
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color: '#e74c3c', width: 2.5 },
        yaxis: 'y2' as const,
      },
    ];

    const layout = {
      title: '',
      xaxis: { title: 'Contrast (HU)' },
      yaxis: {
        title: 'Min. Detectable Disc (mm)',
        titlefont: { color: '#2980b9' },
        tickfont: { color: '#2980b9' },
      },
      yaxis2: {
        title: 'Resolution (line pairs/mm)',
        titlefont: { color: '#e74c3c' },
        tickfont: { color: '#e74c3c' },
        overlaying: 'y' as const,
        side: 'right' as const,
      },
      hovermode: 'x unified' as const,
      height: 400,
      margin: { t: 20, b: 50, l: 60, r: 60 },
      plot_bgcolor: '#f9fafb',
      paper_bgcolor: '#ffffff',
    };

    Plotly.newPlot(ref2.current, plotData as any, layout as any, { responsive: true });
  }, [params, roseThreshold]);

  return (
    <div className="space-y-3">
      {/* Plot 1: d' vs diameter */}
      <div className="border border-gray-300 p-2">
        <div ref={ref1} style={{ width: '100%' }} />
      </div>

      {/* Plot 2: Dual-axis */}
      <div className="border border-gray-300 p-2">
        <div ref={ref2} style={{ width: '100%' }} />
      </div>
    </div>
  );
};

