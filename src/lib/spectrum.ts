// In-place radix-2 Cooley-Tukey FFT. Length must be a power of 2.
export function fft1d(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 0, j = 0; i < n; i++) {
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }
  // Butterflies
  for (let s = 1; s < n; s <<= 1) {
    const m = s << 1;
    const theta = -Math.PI / s;
    const wpRe = Math.cos(theta);
    const wpIm = Math.sin(theta);
    for (let k = 0; k < n; k += m) {
      let wRe = 1, wIm = 0;
      for (let p = 0; p < s; p++) {
        const i1 = k + p;
        const i2 = i1 + s;
        const tRe = wRe * re[i2] - wIm * im[i2];
        const tIm = wRe * im[i2] + wIm * re[i2];
        re[i2] = re[i1] - tRe;
        im[i2] = im[i1] - tIm;
        re[i1] += tRe;
        im[i1] += tIm;
        const nwRe = wRe * wpRe - wIm * wpIm;
        wIm = wRe * wpIm + wIm * wpRe;
        wRe = nwRe;
      }
    }
  }
}

// Apply 2D Hann window in place to reduce FFT edge artefacts.
export function applyHann2d(data: Float64Array, n: number): void {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  for (let i = 0; i < n; i++) {
    const wi = w[i];
    const off = i * n;
    for (let j = 0; j < n; j++) data[off + j] *= wi * w[j];
  }
}

// Subtract mean (DC removal). Otherwise DC dominates the spectrum.
export function removeMean(data: Float64Array): void {
  let s = 0;
  for (let i = 0; i < data.length; i++) s += data[i];
  const m = s / data.length;
  for (let i = 0; i < data.length; i++) data[i] -= m;
}

// 2D power spectrum via row-then-column 1D FFT. Returns an n×n Float64Array
// of |X(u,v)|^2 with DC at index (0,0).
export function powerSpectrum2d(data: Float64Array, n: number): Float64Array {
  // re/im scratch — n×n
  const re = new Float64Array(data); // copy
  const im = new Float64Array(n * n);

  // FFT each row
  const rowRe = new Float64Array(n);
  const rowIm = new Float64Array(n);
  for (let r = 0; r < n; r++) {
    const off = r * n;
    for (let c = 0; c < n; c++) { rowRe[c] = re[off + c]; rowIm[c] = im[off + c]; }
    fft1d(rowRe, rowIm);
    for (let c = 0; c < n; c++) { re[off + c] = rowRe[c]; im[off + c] = rowIm[c]; }
  }
  // FFT each column
  const colRe = new Float64Array(n);
  const colIm = new Float64Array(n);
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) { colRe[r] = re[r * n + c]; colIm[r] = im[r * n + c]; }
    fft1d(colRe, colIm);
    for (let r = 0; r < n; r++) { re[r * n + c] = colRe[r]; im[r * n + c] = colIm[r]; }
  }
  // |X|^2
  const ps = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) ps[i] = re[i] * re[i] + im[i] * im[i];
  return ps;
}

// Radial average of an n×n power spectrum with DC at (0,0). Returns
// arrays of frequency (cycles/pixel) and mean PSD per radial bin.
export function radialAverage(ps: Float64Array, n: number, nBins = 64): {
  freq: number[]; values: number[];
} {
  const sums = new Float64Array(nBins);
  const counts = new Int32Array(nBins);
  const fMax = 0.5; // Nyquist in cycles/pixel
  for (let r = 0; r < n; r++) {
    // Map index r to signed frequency in [-0.5, 0.5)
    const fy = (r < n / 2 ? r : r - n) / n;
    for (let c = 0; c < n; c++) {
      const fx = (c < n / 2 ? c : c - n) / n;
      const f = Math.sqrt(fx * fx + fy * fy);
      if (f > fMax) continue;
      const bin = Math.min(nBins - 1, Math.floor((f / fMax) * nBins));
      sums[bin] += ps[r * n + c];
      counts[bin] += 1;
    }
  }
  const freq: number[] = [];
  const values: number[] = [];
  for (let b = 0; b < nBins; b++) {
    if (counts[b] === 0) continue;
    freq.push(((b + 0.5) / nBins) * fMax);
    values.push(sums[b] / counts[b]);
  }
  return { freq, values };
}

// Extract an n×n central crop from a height×width 2D array (row-major).
export function centralCrop(
  src: number[][],
  height: number,
  width: number,
  n: number
): Float64Array {
  const out = new Float64Array(n * n);
  const r0 = Math.max(0, Math.floor((height - n) / 2));
  const c0 = Math.max(0, Math.floor((width - n) / 2));
  for (let r = 0; r < n; r++) {
    const srcRow = src[r0 + r];
    const off = r * n;
    for (let c = 0; c < n; c++) out[off + c] = srcRow[c0 + c];
  }
  return out;
}
