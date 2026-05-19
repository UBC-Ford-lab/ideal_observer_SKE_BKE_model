import { useState } from 'react';
import { ScannerParams } from './lib/calculations';
import { ParameterInput } from './components/ParameterInput';
import { ResultsDisplay } from './components/ResultsDisplay';
import { InteractivePlots } from './components/InteractivePlots';
import { DerivationWalkthrough } from './components/DerivationWalkthrough';
import { RadialResolutionMap } from './components/RadialResolutionMap';
import './App.css';

function App() {
  const [params, setParams] = useState<ScannerParams>({
    N0: 4203,
    muBg: 0.0219,
    L: 80,
    nTheta: 220,
    deltaA_obj: 0.0249,
  });
  const [contrast, setContrast] = useState(500);
  const [roseThreshold, setRoseThreshold] = useState(3.0);
  const [showRadialMap, setShowRadialMap] = useState(false);

  const handleParamsChange = (newParams: ScannerParams, newContrast: number) => {
    setParams(newParams);
    setContrast(newContrast);
  };

  return (
    <div className="min-h-screen bg-white p-4">
      {/* Minimal header */}
      <div className="mb-6 border-b pb-3">
        <h1 className="text-sm font-mono font-bold">ideal observer CT resolution</h1>
        <p className="text-xs text-gray-600 font-mono">This page calculates the theoretical minimum detectable object size given your CT system, based on a signal-known-exactly (SKE) and background-known-exactly (BKE) ideal observer model. Please note this is a non-prewhitening model (because noise statistics are intractable nowadays with the different types of reconstruction algorithms out there). Hope it's useful!</p>
      </div>

      {/* Main layout */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: Input params */}
        <div className="lg:col-span-1 border border-gray-300 p-3 h-fit">
          <div className="text-xs font-mono font-bold mb-3 pb-2 border-b">Parameters</div>
          <ParameterInput onParamsChange={handleParamsChange} />

          {/* Rose threshold */}
          <div className="border-t mt-3 pt-2">
            <label className="text-xs font-mono text-gray-700 block mb-1">d' threshold: {roseThreshold.toFixed(1)}</label>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={roseThreshold}
              onChange={(e) => setRoseThreshold(Number(e.target.value))}
              className="w-full text-xs"
            />
          </div>

          {/* Radial map toggle (sliding switch) */}
          <div className="border-t mt-3 pt-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-mono text-gray-700">Show radial resolution map</span>
              <span className="relative inline-block">
                <input
                  type="checkbox"
                  checked={showRadialMap}
                  onChange={(e) => setShowRadialMap(e.target.checked)}
                  className="sr-only peer"
                />
                <span className="block w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors"></span>
                <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></span>
              </span>
            </label>
          </div>
        </div>

        {/* Middle: Results */}
        <div className="lg:col-span-1 border border-gray-300 p-3 h-fit">
          <div className="text-xs font-mono font-bold mb-3 pb-2 border-b">Results</div>
          <ResultsDisplay params={params} contrast={contrast} roseThreshold={roseThreshold} />
        </div>

        {/* Right: Plots */}
        <div className="lg:col-span-2 border border-gray-300 p-3">
          <div className="text-xs font-mono font-bold mb-3 pb-2 border-b">Plots</div>
          <InteractivePlots params={params} contrast={contrast} roseThreshold={roseThreshold} />
        </div>
      </div>

      {/* Radial resolution map (toggle) */}
      {showRadialMap && (
        <div className="max-w-6xl mx-auto mt-6 border border-gray-300 p-4">
          <div className="text-xs font-mono font-bold mb-3 pb-2 border-b">
            Radial resolution map (spatial d_min across the phantom)
          </div>
          <RadialResolutionMap
            params={params}
            contrast={contrast}
            roseThreshold={roseThreshold}
          />
        </div>
      )}

      {/* Derivation section */}
      <div className="max-w-6xl mx-auto mt-6 border border-gray-300 p-4">
        <div className="text-xs font-mono font-bold mb-3 pb-2 border-b">Derivation</div>
        <DerivationWalkthrough />
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto mt-6 text-xs text-gray-500 font-mono border-t pt-2">
        <p>Falk L. Wiegmann &amp; Nancy L. Ford — University of British Columbia — 2026</p>
      </div>
    </div>
  );
}

export default App;

