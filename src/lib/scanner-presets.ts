import { ScannerParams } from './calculations';

export interface ScannerPreset {
  name: string;
  description: string;
  params: ScannerParams;
}

export const SCANNER_PRESETS: Record<string, ScannerPreset> = {
  ge_explore_ct_120: {
    name: 'GE eXplore CT 120',
    description:
      'Micro-CT scanner (80 kVp, 40 mA, 16 ms) - Scan 1988',
    params: {
      N0: 4203, // photons/pixel (measured)
      muBg: 0.0219, // mm^-1 (water at 80 kVp)
      L: 80.0, // mm (phantom diameter)
      nTheta: 220, // projections
      deltaA_obj: 0.0249, // mm (detector pixel spacing at object plane)
    },
  },
};

export function getScannerPreset(presetId: string): ScannerPreset | undefined {
  return SCANNER_PRESETS[presetId];
}

export function getPresetIds(): string[] {
  return Object.keys(SCANNER_PRESETS);
}
