/**
 * Core calculations for ideal observer detectability in CT
 * Based on: Hsieh et al. (2022), Medical Physics 49(8): 4988–4998
 */

export interface ScannerParams {
  N0: number; // photons per pixel in unattenuated beam
  muBg: number; // linear attenuation coefficient (mm^-1)
  L: number; // path length through background (mm)
  nTheta: number; // number of projection angles
  deltaA_obj: number; // detector pixel spacing at object plane (mm)
}

export interface DetectabilityResult {
  dPrime: number; // detectability index
  dMin: number; // minimum detectable disc diameter (mm)
  resolution_lpmm: number; // spatial frequency (line pairs per mm)
  signalPerPixel: number; // peak signal magnitude
  noisePerPixel: number; // std dev of noise per pixel
}

/**
 * Calculate photon transmission through uniform background
 */
export function calculateTransmission(
  muBg: number,
  L: number
): { T_bg: number; N_bg: number } {
  const T_bg = Math.exp(-muBg * L);
  return { T_bg, N_bg: 0 }; // N_bg will be set separately
}

/**
 * Calculate noise variance per pixel (Poisson approximation)
 */
export function calculateNoisePerPixel(N_bg: number): number {
  return 1.0 / Math.sqrt(N_bg);
}

/**
 * Calculate d' (detectability index) for a circular disc
 * Formula: d'^2 = (2 * N_theta * N_bg * delta_mu^2 * d^3) / (3 * delta_a_obj)
 */
export function calculateDPrime(
  d_mm: number,
  deltaMu: number,
  params: ScannerParams & { N_bg: number }
): number {
  const numerator =
    2 * params.nTheta * params.N_bg * Math.pow(deltaMu, 2) * Math.pow(d_mm, 3);
  const denominator = 3 * params.deltaA_obj;
  return Math.sqrt(numerator / denominator);
}

/**
 * Calculate minimum detectable disc diameter given a d' threshold
 * Solves: d'^2 = (2 * N_theta * N_bg * delta_mu^2 * d^3) / (3 * delta_a_obj)
 * For d_min given threshold d'
 */
export function calculateDMin(
  deltaMu: number,
  threshold: number,
  params: ScannerParams & { N_bg: number }
): number {
  const d3 =
    (3 * params.deltaA_obj * Math.pow(threshold, 2)) /
    (2 * params.nTheta * params.N_bg * Math.pow(deltaMu, 2));
  return Math.cbrt(d3);
}

/**
 * Convert HU contrast to linear attenuation coefficient change
 * ΔC_HU = (Δμ / μ_water) * 1000
 * Therefore: Δμ = (ΔC_HU / 1000) * μ_water
 */
export function huToMu(huContrast: number, muWater: number = 0.0219): number {
  return (huContrast / 1000.0) * muWater;
}

/**
 * Convert disc diameter to spatial frequency (line pairs per mm)
 * f = 1 / (2 * d)
 */
export function diameterToFrequency(d_mm: number): number {
  return 1.0 / (2.0 * d_mm);
}

/**
 * Full analysis: given parameters and contrast, return all detectability metrics
 */
export function analyzeDetectability(
  scannerParams: ScannerParams,
  huContrast: number,
  roseThreshold: number = 3.0
): DetectabilityResult {
  // Calculate background transmission
  const T_bg = Math.exp(-scannerParams.muBg * scannerParams.L);
  const N_bg = scannerParams.N0 * T_bg;

  // Enhanced params with calculated N_bg
  const fullParams = { ...scannerParams, N_bg };

  // Convert HU to linear attenuation coefficient
  const deltaMu = huToMu(huContrast);

  // Calculate detectability for this disc
  const dMin = calculateDMin(deltaMu, roseThreshold, fullParams);
  const dPrime = calculateDPrime(dMin, deltaMu, fullParams);
  const resolution_lpmm = diameterToFrequency(dMin);

  // Signal and noise for reference
  const noisePerPixel = calculateNoisePerPixel(N_bg);
  // Peak signal for a disc: Δp_peak = 2 * Δμ * R where R = d/2
  const signalPerPixel = 2 * deltaMu * (dMin / 2);

  return {
    dPrime,
    dMin,
    resolution_lpmm,
    signalPerPixel,
    noisePerPixel,
  };
}

/**
 * Generate a range of d' values for different disc diameters
 */
export function generateDPrimeCurve(
  diameters: number[],
  deltaMu: number,
  scannerParams: ScannerParams
): number[] {
  const T_bg = Math.exp(-scannerParams.muBg * scannerParams.L);
  const N_bg = scannerParams.N0 * T_bg;
  const fullParams = { ...scannerParams, N_bg };

  return diameters.map((d) => calculateDPrime(d, deltaMu, fullParams));
}

/**
 * Compute d_min across a range of contrasts
 */
export function generateMinDiameterCurve(
  contrasts: number[],
  scannerParams: ScannerParams,
  roseThreshold: number = 3.0
): Array<{ contrast: number; dMin: number; resolution: number }> {
  const T_bg = Math.exp(-scannerParams.muBg * scannerParams.L);
  const N_bg = scannerParams.N0 * T_bg;
  const fullParams = { ...scannerParams, N_bg };

  return contrasts.map((contrast) => {
    const deltaMu = huToMu(contrast);
    const dMin = calculateDMin(deltaMu, roseThreshold, fullParams);
    return {
      contrast,
      dMin,
      resolution: diameterToFrequency(dMin),
    };
  });
}
