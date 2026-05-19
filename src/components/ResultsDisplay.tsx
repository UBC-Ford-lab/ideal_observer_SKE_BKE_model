import React from 'react';
import { ScannerParams, analyzeDetectability } from '../lib/calculations';

interface ResultsDisplayProps {
  params: ScannerParams;
  contrast: number;
  roseThreshold?: number;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  params,
  contrast,
  roseThreshold = 3.0,
}) => {
  const result = analyzeDetectability(params, contrast, roseThreshold);

  // Generate a table of results for multiple contrasts
  const contrastValues = [50, 100, 200, 500, 1000];
  const resultTable = contrastValues.map((c) => analyzeDetectability(params, c, roseThreshold));

  return (
    <div className="space-y-3 text-xs font-mono">
      {/* Main results */}
      <div className="border border-gray-300 p-2 bg-gray-50">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-gray-600">d_min (mm)</div>
            <div className="font-bold text-lg">{result.dMin.toFixed(4)}</div>
          </div>
          <div>
            <div className="text-gray-600">f (lp/mm)</div>
            <div className="font-bold text-lg">{result.resolution_lpmm.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-gray-600">d'</div>
            <div className="font-bold text-lg">{result.dPrime.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Signal & noise */}
      <div className="border border-gray-300 p-2">
        <div className="text-gray-600 mb-1 text-xs font-bold">Signal & Noise</div>
        <div className="space-y-1 text-gray-700 text-xs">
          <div className="text-xs text-gray-600 mb-1 italic">Single projection, single pixel:</div>
          <div className="flex justify-between">
            <span>Δp_peak:</span>
            <span className="font-mono">{result.signalPerPixel.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span>σ_p:</span>
            <span className="font-mono">{result.noisePerPixel.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span>SNR (single pixel):</span>
            <span className="font-mono font-bold">{(result.signalPerPixel / result.noisePerPixel).toFixed(3)}</span>
          </div>

          <div className="border-t border-gray-300 pt-1 mt-1">
            <div className="flex justify-between">
              <span>Effective SNR (over {params.nTheta} projections):</span>
              <span className="font-mono font-bold">{(result.dPrime).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-contrast table */}
      <div className="border border-gray-300 p-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-100">
              <th className="px-1 py-0.5 text-left">HU</th>
              <th className="px-1 py-0.5 text-right">d_min</th>
              <th className="px-1 py-0.5 text-right">f</th>
            </tr>
          </thead>
          <tbody>
            {resultTable.map((row, idx) => (
              <tr
                key={idx}
                className={contrastValues[idx] === contrast ? 'bg-blue-100' : ''}
              >
                <td className="px-1 py-0.5">{contrastValues[idx]}</td>
                <td className="px-1 py-0.5 text-right">{row.dMin.toFixed(4)}</td>
                <td className="px-1 py-0.5 text-right">{row.resolution_lpmm.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

