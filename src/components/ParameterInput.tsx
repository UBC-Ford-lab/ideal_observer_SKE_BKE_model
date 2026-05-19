import React, { useState, useRef, useEffect } from 'react';
import { ScannerParams } from '../lib/calculations';
import { fromArrayBuffer } from 'geotiff';
import Plotly from 'plotly.js-dist-min';
import {
  applyHann2d,
  removeMean,
  powerSpectrum2d,
  radialAverage,
  centralCrop,
} from '../lib/spectrum';

interface ParameterInputProps {
  onParamsChange: (params: ScannerParams, contrast: number) => void;
}

export const ParameterInput: React.FC<ParameterInputProps> = ({
  onParamsChange,
}) => {
  const [N0, setN0] = useState(4203);
  const [muBg, setMuBg] = useState(0.0219);
  const [L, setL] = useState(80);
  const [nTheta, setNTheta] = useState(220);
  const [deltaA_obj, setDeltaA_obj] = useState(0.0249);
  const [contrast, setContrast] = useState(500);
  const [showN0Help, setShowN0Help] = useState(false);
  const [hoveredParam, setHoveredParam] = useState<string | null>(null);

  const handleParamChange = () => {
    const params: ScannerParams = { N0, muBg, L, nTheta, deltaA_obj };
    onParamsChange(params, contrast);
  };

  React.useEffect(() => {
    handleParamChange();
  }, [N0, muBg, L, nTheta, deltaA_obj, contrast]);

  const Tooltip: React.FC<{ text: string; param: string }> = ({ text, param }) => (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setHoveredParam(param)}
        onMouseLeave={() => setHoveredParam(null)}
        className="text-blue-500 hover:text-blue-700 font-bold text-xs leading-none"
      >
        ?
      </button>
      {hoveredParam === param && (
        <div className="absolute bottom-full left-0 mb-1 bg-blue-100 border border-blue-300 rounded px-2 py-1 text-xs text-gray-800 whitespace-nowrap z-40 pointer-events-none">
          {text}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-2 text-xs">
        <div className="space-y-1">
          <label className="text-gray-700 font-mono flex items-center gap-2">
            N₀ (photons/px)
            <button
              onClick={() => setShowN0Help(true)}
              className="text-blue-600 hover:text-blue-800 underline text-xs leading-none"
            >
              Calculate here
            </button>
          </label>
          <input
            type="number"
            value={N0}
            onChange={(e) => setN0(Number(e.target.value))}
            step={100}
            className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-700 font-mono flex items-center gap-1">
            μ_bg (mm⁻¹)
            <Tooltip param="muBg" text="Linear attenuation coefficient (e.g. water)" />
          </label>
          <input
            type="number"
            value={muBg}
            onChange={(e) => setMuBg(Number(e.target.value))}
            step={0.0001}
            className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-700 font-mono flex items-center gap-1">
            L (mm)
            <Tooltip param="L" text="Object depth along beam" />
          </label>
          <input
            type="number"
            value={L}
            onChange={(e) => setL(Number(e.target.value))}
            step={1}
            className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-700 font-mono flex items-center gap-1">
            N_θ (projections)
            <Tooltip param="nTheta" text="Number of projection angles" />
          </label>
          <input
            type="number"
            value={nTheta}
            onChange={(e) => setNTheta(Number(e.target.value))}
            step={10}
            className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-700 font-mono flex items-center gap-1">
            Δa_obj (mm)
            <Tooltip param="deltaA_obj" text="Pixel size in object plane (i.e. projection resolution)" />
          </label>
          <input
            type="number"
            value={deltaA_obj}
            onChange={(e) => setDeltaA_obj(Number(e.target.value))}
            step={0.0001}
            className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs"
          />
        </div>

        <div className="border-t pt-2 mt-3">
          <label className="text-gray-700 font-mono block mb-1 flex items-center gap-1">
            Contrast (HU): {contrast}
            <Tooltip param="contrast" text="HU difference object vs background" />
          </label>
          <input
            type="range"
            min="10"
            max="2000"
            step="10"
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Modal for N0 calculation help */}
      {showN0Help && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowN0Help(false)}>
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[85vh] overflow-y-auto p-6 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="font-bold text-sm">How to Calculate N₀ (photons/pixel)</h2>
              <button
                onClick={() => setShowN0Help(false)}
                className="text-gray-500 hover:text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-gray-700">
              <div>
                <div className="font-bold mb-1">What you need:</div>
                <ul className="list-disc ml-4 space-y-1">
                  <li><strong>Dark field:</strong> One projection with X-ray source OFF (shutter closed)</li>
                  <li><strong>Bright field:</strong> One or more projections with EMPTY scanner (air only, no object)</li>
                  <li><strong>Two adjacent projections:</strong> Consecutive bright field images to measure noise</li>
                </ul>
              </div>

              <div>
                <div className="font-bold mb-1">Steps:</div>
                <ol className="list-decimal ml-4 space-y-1">
                  <li><strong>Flat-field correction:</strong> For each projection, compute T = (I - dark) / (bright - dark)</li>
                  <li><strong>Select air pixels:</strong> In the corrected projections, find pixels where T ≈ 1 (unattenuated beam)</li>
                  <li><strong>Calculate variance:</strong> From two consecutive air projections T₁ and T₂, compute Var(T) = Var[(T₁ - T₂)/√2]</li>
                  <li><strong>Convert to photon count:</strong> N₀ = 1 / Var(T)</li>
                </ol>
              </div>

              <div className="bg-gray-50 border border-gray-300 p-2 rounded">
                <div className="font-bold mb-2">Simple calculator:</div>
                <N0Calculator deltaA_obj={deltaA_obj} />
              </div>

              <div className="text-gray-600 italic text-xs">
                <strong>Note:</strong> This assumes Poisson statistics. The variance calculation uses two frames to remove correlated noise (dark current, read noise). The factor of √2 accounts for this differencing.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const CROP_SIZE = 512; // power of 2 for FFT

interface N0CalculatorProps {
  deltaA_obj: number;
}

const N0Calculator: React.FC<N0CalculatorProps> = ({ deltaA_obj }) => {
  const [variance, setVariance] = useState(0.001);
  const [darkFile, setDarkFile] = useState<File | null>(null);
  const [brightFile, setBrightFile] = useState<File | null>(null);
  const [proj1File, setProj1File] = useState<File | null>(null);
  const [proj2File, setProj2File] = useState<File | null>(null);
  const [calculatedVariance, setCalculatedVariance] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const cropsRef = useRef<{ t1: Float64Array; t2: Float64Array } | null>(null);
  const [spectrumReady, setSpectrumReady] = useState(false);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const [computingSpectrum, setComputingSpectrum] = useState(false);
  const spectrumDivRef = useRef<HTMLDivElement>(null);

  const n0 = variance > 0 ? 1 / variance : 0;

  const readTiffArrayData = async (file: File): Promise<number[][] | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const tiff = await fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();
      const data = await image.readRasters();

      if (!data || data.length === 0) {
        setStatus('Error: Could not read TIFF data');
        return null;
      }

      // Convert to 2D array
      const width = image.getWidth();
      const height = image.getHeight();
      const rasterData = data[0]; // first channel
      const array2d: number[][] = [];

      for (let i = 0; i < height; i++) {
        const row: number[] = [];
        for (let j = 0; j < width; j++) {
          row.push(rasterData[i * width + j] as number);
        }
        array2d.push(row);
      }

      return array2d;
    } catch (err) {
      setStatus(`Error reading TIFF: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    }
  };

  const calculateN0FromFiles = async () => {
    if (!darkFile || !brightFile || !proj1File || !proj2File) {
      setStatus('Please upload all four files (dark, bright, proj1, proj2)');
      return;
    }

    setLoading(true);
    setSpectrumReady(false);
    setShowSpectrum(false);
    cropsRef.current = null;
    setStatus('Reading TIFF files...');

    try {
      const dark = await readTiffArrayData(darkFile);
      const bright = await readTiffArrayData(brightFile);
      const p1 = await readTiffArrayData(proj1File);
      const p2 = await readTiffArrayData(proj2File);

      if (!dark || !bright || !p1 || !p2) {
        setLoading(false);
        return;
      }

      setStatus('Flat-field correcting...');

      const height = p1.length;
      const width = p1[0].length;

      // Get min/max of input images for diagnostics
      let darkMin = Infinity, darkMax = -Infinity;
      let brightMin = Infinity, brightMax = -Infinity;
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          darkMin = Math.min(darkMin, dark[i][j]);
          darkMax = Math.max(darkMax, dark[i][j]);
          brightMin = Math.min(brightMin, bright[i][j]);
          brightMax = Math.max(brightMax, bright[i][j]);
        }
      }

      setStatus(`Image ranges - Dark:[${darkMin.toFixed(0)}, ${darkMax.toFixed(0)}], Bright:[${brightMin.toFixed(0)}, ${brightMax.toFixed(0)}]. Correcting...`);

      // Flat-field correction: T = (I - dark) / (bright - dark)
      const t1: number[][] = [];
      const t2: number[][] = [];

      for (let i = 0; i < height; i++) {
        const row1: number[] = [];
        const row2: number[] = [];
        for (let j = 0; j < width; j++) {
          const d = dark[i][j];
          const b = bright[i][j];
          const i1 = p1[i][j];
          const i2 = p2[i][j];

          const denominator = b - d;
          if (Math.abs(denominator) > 1e-6) {
            row1.push((i1 - d) / denominator);
            row2.push((i2 - d) / denominator);
          } else {
            row1.push(0);
            row2.push(0);
          }
        }
        t1.push(row1);
        t2.push(row2);
      }

      setStatus(`Selecting air pixels (T ≈ 1)...`);

      // Air pixels = unattenuated beam, so T should be close to 1.
      // Pick pixels where BOTH frames have T in [AIR_LO, AIR_HI].
      const AIR_LO = 0.8;
      const AIR_HI = 1.2;

      const airDiffs: number[] = [];
      let airSum = 0;
      let totalPixels = 0;
      let pixelsNearOne = 0;

      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          totalPixels++;
          const a = t1[i][j];
          const b = t2[i][j];
          if (a >= AIR_LO && a <= AIR_HI) pixelsNearOne++;
          if (a >= AIR_LO && a <= AIR_HI && b >= AIR_LO && b <= AIR_HI) {
            airDiffs.push((a - b) / Math.sqrt(2));
            airSum += a;
          }
        }
      }

      const airFraction = pixelsNearOne / totalPixels;
      const MIN_AIR_FRACTION = 0.01; // 1%

      if (airFraction < MIN_AIR_FRACTION) {
        // Diagnostic: what does the T distribution look like?
        let tMin = Infinity, tMax = -Infinity, tSum = 0;
        for (let i = 0; i < height; i++) {
          for (let j = 0; j < width; j++) {
            tMin = Math.min(tMin, t1[i][j]);
            tMax = Math.max(tMax, t1[i][j]);
            tSum += t1[i][j];
          }
        }
        const tMean = tSum / totalPixels;
        setStatus(
          `No air pixels found: only ${(airFraction * 100).toFixed(2)}% of T1 in [${AIR_LO}, ${AIR_HI}]. ` +
          `T1 range=[${tMin.toFixed(3)}, ${tMax.toFixed(3)}], mean=${tMean.toFixed(3)}. ` +
          `Did you upload object projections instead of bright-field repeats? ` +
          `Projection 1 & 2 should be empty-scanner (air-only) exposures.`
        );
        setLoading(false);
        return;
      }

      const nAir = airDiffs.length;
      const meanT = airSum / nAir;

      // Variance of (T1 - T2)/√2 over air pixels
      const meanDiff = airDiffs.reduce((a, b) => a + b, 0) / nAir;
      const variance = airDiffs.reduce((s, v) => s + (v - meanDiff) ** 2, 0) / nAir;

      setCalculatedVariance(variance);
      setVariance(variance);
      setStatus(
        `Variance=${variance.toExponential(3)} from ${nAir.toLocaleString()} air pixels ` +
        `(${(airFraction * 100).toFixed(1)}% of image, mean T=${meanT.toFixed(3)}).`
      );

      // Save central crops for optional spectrum analysis
      const cropDim = Math.min(CROP_SIZE, height, width);
      cropsRef.current = {
        t1: centralCrop(t1, height, width, cropDim),
        t2: centralCrop(t2, height, width, cropDim),
      };
      setSpectrumReady(true);
      setShowSpectrum(false);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    setLoading(false);
  };

  const computeAndPlotSpectrum = async () => {
    if (!cropsRef.current || !spectrumDivRef.current) return;
    setComputingSpectrum(true);
    // Yield to UI so the spinner can render
    await new Promise((r) => setTimeout(r, 30));

    const { t1, t2 } = cropsRef.current;
    const n = Math.round(Math.sqrt(t1.length));

    // Signal: T1 itself. Noise: (T1 - T2)/sqrt(2).
    const signal = new Float64Array(t1);
    const noise = new Float64Array(t1.length);
    const invSqrt2 = 1 / Math.sqrt(2);
    for (let i = 0; i < t1.length; i++) noise[i] = (t1[i] - t2[i]) * invSqrt2;

    // Remove DC and apply Hann window to both
    removeMean(signal);
    removeMean(noise);
    applyHann2d(signal, n);
    applyHann2d(noise, n);

    const psSig = powerSpectrum2d(signal, n);
    const psNoise = powerSpectrum2d(noise, n);

    const sigRA = radialAverage(psSig, n);
    const noiseRA = radialAverage(psNoise, n);

    // Convert cycles/pixel → lp/mm if pixel size known and > 0
    const px = deltaA_obj > 0 ? deltaA_obj : 0;
    const xFactor = px > 0 ? 1 / px : 1; // cycles/pixel * (1/px mm) = lp/mm
    const xLabel =
      px > 0
        ? `Spatial frequency (lp/mm) — assuming detector resolution of ${px} mm`
        : 'Spatial frequency (cycles/pixel)';
    const xSig = sigRA.freq.map((f) => f * xFactor);
    const xNoise = noiseRA.freq.map((f) => f * xFactor);

    await Plotly.newPlot(
      spectrumDivRef.current,
      [
        {
          x: xSig,
          y: sigRA.values,
          name: 'Projection (signal+noise)',
          type: 'scatter',
          mode: 'lines',
          line: { color: '#1d4ed8', width: 2 },
        },
        {
          x: xNoise,
          y: noiseRA.values,
          name: 'Noise floor',
          type: 'scatter',
          mode: 'lines',
          line: { color: '#9ca3af', width: 2, dash: 'dot' },
          fill: 'tonexty',
          fillcolor: 'rgba(59, 130, 246, 0.15)',
        },
      ] as any,
      {
        margin: { l: 55, r: 10, t: 10, b: 45 },
        xaxis: { title: xLabel, type: 'linear', tickfont: { size: 10 }, titlefont: { size: 11 } },
        yaxis: {
          title: 'Radial PSD (a.u.)',
          type: 'log',
          tickfont: { size: 10 },
          titlefont: { size: 11 },
        },
        legend: { font: { size: 10 }, orientation: 'h', y: -0.25 },
        font: { family: 'ui-monospace, monospace', size: 10 },
        autosize: true,
      } as any,
      { displaylogo: false, responsive: true } as any
    );
    setComputingSpectrum(false);
  };

  useEffect(() => {
    if (showSpectrum) computeAndPlotSpectrum();
    // Clean up Plotly node if hidden
    return () => {
      if (spectrumDivRef.current && !showSpectrum) {
        try { Plotly.purge(spectrumDivRef.current); } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSpectrum]);

  return (
    <div className="space-y-2">
      <div className="text-gray-600 text-xs font-bold mb-2">Upload method (optional):</div>

      <div className="space-y-1">
        <label className="block text-gray-700 mb-1 text-xs">Dark field (source OFF):</label>
        <input
          type="file"
          accept=".tif,.tiff"
          onChange={(e) => setDarkFile(e.target.files?.[0] || null)}
          className="w-full text-xs"
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-gray-700 mb-1 text-xs">Bright field (empty scanner):</label>
        <input
          type="file"
          accept=".tif,.tiff"
          onChange={(e) => setBrightFile(e.target.files?.[0] || null)}
          className="w-full text-xs"
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-gray-700 mb-1 text-xs">Projection 1 (bright field adjacent):</label>
        <input
          type="file"
          accept=".tif,.tiff"
          onChange={(e) => setProj1File(e.target.files?.[0] || null)}
          className="w-full text-xs"
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-gray-700 mb-1 text-xs">Projection 2 (bright field adjacent):</label>
        <input
          type="file"
          accept=".tif,.tiff"
          onChange={(e) => setProj2File(e.target.files?.[0] || null)}
          className="w-full text-xs"
          disabled={loading}
        />
      </div>

      <button
        onClick={calculateN0FromFiles}
        disabled={loading || !darkFile || !brightFile || !proj1File || !proj2File}
        className="w-full px-2 py-1 bg-blue-600 text-white rounded text-xs font-mono disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700"
      >
        {loading ? 'Calculating...' : 'Calculate N₀ from files'}
      </button>

      {status && (
        <div className="text-xs text-gray-600 italic bg-gray-50 p-1 rounded">{status}</div>
      )}

      <div className="text-xs text-gray-600 italic bg-gray-50 p-1 rounded border border-gray-300">
        <strong>Note:</strong> Adjacent projections are fine for variance estimation. However, two projections of the <strong>same angle and same scene</strong> (e.g., repeated acquisitions) give the purest noise measurement, removing any scene correlation.
      </div>

      <div className="border-t border-gray-300 pt-2 mt-2">
        <div className="text-gray-600 text-xs font-bold mb-1">Manual entry:</div>
        <label className="block text-gray-700 mb-1 text-xs">Variance of flat-field corrected air pixels:</label>
        <input
          type="number"
          value={variance}
          onChange={(e) => setVariance(Number(e.target.value))}
          step={0.00001}
          min={0.00001}
          className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs"
          placeholder="e.g., 0.00238"
        />
      </div>

      <div className="bg-blue-50 border border-blue-300 p-2 rounded">
        <div className="text-gray-600 text-xs">N₀ (photons/pixel) =</div>
        <div className="font-bold text-lg text-blue-700">{n0.toFixed(0)}</div>
        {calculatedVariance !== null && (
          <div className="text-xs text-blue-600 mt-1">from file variance: {calculatedVariance.toFixed(6)}</div>
        )}
      </div>

      {spectrumReady && !showSpectrum && (
        <button
          onClick={() => setShowSpectrum(true)}
          className="w-full text-left text-xs text-blue-700 hover:text-blue-900 italic bg-amber-50 border border-amber-300 px-2 py-1 rounded"
        >
          By the way, are you interested in what the projection spectrum of the scene you uploaded
          looks like? <span className="underline">Show plot →</span>
        </button>
      )}

      {showSpectrum && (
        <div className="border border-gray-300 rounded p-2 space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-gray-700">
              Projection spectrum vs noise floor
            </div>
            <button
              onClick={() => setShowSpectrum(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              hide
            </button>
          </div>
          <div className="text-[10px] text-gray-500 italic">
            Radial-average PSD of central {CROP_SIZE}×{CROP_SIZE} crop. Signal = T₁; noise =
            (T₁−T₂)/√2. Where the curves meet, noise dominates.
          </div>
          {computingSpectrum && (
            <div className="text-xs text-gray-600">Computing FFT…</div>
          )}
          <div ref={spectrumDivRef} style={{ width: '100%', height: 280 }} />
        </div>
      )}
    </div>
  );
};


