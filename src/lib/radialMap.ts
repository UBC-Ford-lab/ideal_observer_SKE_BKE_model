// Spatial map of the ideal-observer limiting resolution inside a uniform
// circular phantom, with fan-beam (point-source) geometry and per-voxel
// magnification correction.
//
// For each voxel P=(x,y) and projection angle θ, the source is at
//   S(θ) = (SOD·cos θ, SOD·sin θ)
// and rays diverge from that point. Two geometric effects are folded in:
//
// 1. Fan-beam chord through the object cylinder (radius objR, centred at
//    (objCx, objCy); defaults to phantom-R at origin):
//      chord_fan(θ, P) = 2·√(objR² − perp²)
//    where perp is the perpendicular distance from the object centre to the
//    ray line. Reduces to the parallel-beam chord 2·√(R² − r²·sin²(θ−α))
//    as SOD → ∞ and (objCx, objCy) = (0,0), objR = R.
//
// 2. Per-voxel magnification: the effective object-plane pixel pitch at P is
//      Δa_obj(P, θ) = Δa_obj_iso · |P − S(θ)| / SOD
//    The user's `delta_a_obj` is treated as the isocentre value Δa_obj_iso.
//
// Folding both into the d'² sum:
//   G(P) = (1/Δφ) · ∫ over arc of N₀·exp(−μ_bg·chord_fan(θ,P)) / |P−S(θ)| dθ
//   d_min(P) = (3·(d'_th)² · Δa_obj_iso / (2 · N_θ · SOD · Δμ² · G(P)))^(1/3)
//
// In the SOD → ∞ limit, |P−S| → SOD and chord_fan → parallel chord, so
// G(P) → N̄_bg(P)/SOD and the formula collapses back to the original
//   d_min = (3·(d'_th)²·Δa_obj / (2·N_θ·N̄_bg·Δμ²))^(1/3)   ✓
//
// Crowther criterion (angular-sampling Nyquist) at radius r from the
// centre of rotation. Ray directions live modulo π, so the binding
// quantity is the largest angular gap between sampled directions:
//   gap = max(Δφ/N_θ, π − Δφ)
//   f_crowther(r) = 1 / (2 r · gap)
// For Δφ ≥ π this reduces to the familiar N_θ / (Δφ · 2 r): the
// conjugate-covered band only revisits directions and never widens a
// gap (at Δφ = 2π this automatically reproduces the "N_θ/2 independent
// views over π" convention). For Δφ < π the unsampled wedge (π − Δφ)
// becomes the largest gap, so the supported isotropic frequency
// collapses as the arc shrinks (limited-angle regime).
// Capped at the detector Nyquist 1 / (2 Δa_obj_iso).

export interface RadialMapConfig {
  R: number;              // phantom radius (mm) = L/2 — bounds the visible domain
  N0: number;             // photons/pixel in unattenuated beam
  mu_bg: number;          // mm^-1
  N_theta: number;        // total number of projections
  delta_a_obj: number;    // mm — pitch projected to isocentre
  delta_mu: number;       // mm^-1
  d_prime_threshold: number;
  arcStartRad: number;    // scan arc start (radians)
  arcEndRad: number;      // scan arc end (radians)
  SOD: number;            // source-to-isocentre distance (mm)
  // Optional off-centre object cylinder for the chord computation.
  // When undefined, defaults to the phantom (centred at origin, radius R).
  objCx?: number;
  objCy?: number;
  objR?: number;
}

const SIMPSON_PANELS = 96; // even; Simpson's 1/3 rule

function objCentreX(c: RadialMapConfig): number {
  return c.objCx ?? 0;
}
function objCentreY(c: RadialMapConfig): number {
  return c.objCy ?? 0;
}
function objRadius(c: RadialMapConfig): number {
  return c.objR ?? c.R;
}

// Chord through a cylinder (radius `rObj`, centred at (cx, cy)) along the
// ray from source S(θ)=(D cos θ, D sin θ) toward P=(x, y).
function chordFan(
  theta: number,
  x: number,
  y: number,
  D: number,
  rObj: number,
  cx: number,
  cy: number
): number {
  const sx = D * Math.cos(theta);
  const sy = D * Math.sin(theta);
  const dx = x - sx;
  const dy = y - sy;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return 0;
  // Unit direction d̂ = (dx, dy) / √len2.
  // Perpendicular distance from object centre C to the line through S along d̂:
  //   V = C − S;  t = V · d̂;  perp² = |V|² − t²
  const vx = cx - sx;
  const vy = cy - sy;
  const dot = vx * dx + vy * dy;          // V · (P−S), un-normalised
  const t2 = (dot * dot) / len2;          // t²
  const v2 = vx * vx + vy * vy;
  const perp2 = v2 - t2;
  const disc = rObj * rObj - perp2;
  return disc > 0 ? 2 * Math.sqrt(disc) : 0;
}

function distSource(
  theta: number,
  x: number,
  y: number,
  D: number
): number {
  const dx = x - D * Math.cos(theta);
  const dy = y - D * Math.sin(theta);
  return Math.sqrt(dx * dx + dy * dy);
}

// G(P) = (1/Δφ) · ∫ over arc of N₀·exp(−μ_bg·chord_fan(θ,P)) / |P−S(θ)| dθ
// Units: photons / mm. Composite Simpson's 1/3 rule.
function geometricFactorAt(x: number, y: number, c: RadialMapConfig): number {
  const dPhi = c.arcEndRad - c.arcStartRad;
  if (dPhi <= 0) return NaN;
  if (x * x + y * y >= c.R * c.R) return NaN;

  const cx = objCentreX(c);
  const cy = objCentreY(c);
  const rObj = objRadius(c);

  const h = dPhi / SIMPSON_PANELS;
  let sum = 0;
  for (let k = 0; k <= SIMPSON_PANELS; k++) {
    const theta = c.arcStartRad + k * h;
    const chord = chordFan(theta, x, y, c.SOD, rObj, cx, cy);
    const dist = distSource(theta, x, y, c.SOD);
    if (dist < 1e-9) continue;
    const f = (c.N0 * Math.exp(-c.mu_bg * chord)) / dist;
    const w = k === 0 || k === SIMPSON_PANELS ? 1 : k % 2 === 1 ? 4 : 2;
    sum += w * f;
  }
  // Simpson: integral ≈ (h/3)·sum. Average over arc = sum/(3·N_PANELS).
  return sum / (3 * SIMPSON_PANELS);
}

// d_min at voxel (x, y) in mm.
export function dMinAt(x: number, y: number, c: RadialMapConfig): number {
  const G = geometricFactorAt(x, y, c);
  if (!isFinite(G) || G <= 0) return NaN;
  return Math.cbrt(
    (3 * c.d_prime_threshold * c.d_prime_threshold * c.delta_a_obj) /
      (2 * c.N_theta * c.SOD * c.delta_mu * c.delta_mu * G)
  );
}

// Resolution in line pairs per mm at (x, y).
export function resolutionAt(x: number, y: number, c: RadialMapConfig): number {
  const d = dMinAt(x, y, c);
  return isFinite(d) && d > 0 ? 1 / (2 * d) : NaN;
}

// --- 3D extension: voxel off the midplane (cone-beam, sec κ corrections) -----
// For a voxel at (x, y, z) and source S(θ) = (D·cos θ, D·sin θ, 0):
//   L_xy  = √((x-D·cos θ)² + (y-D·sin θ)²)
//   L_3D  = √(L_xy² + z²)
//   cos κ = L_xy / L_3D      (cone angle of the ray)
//   chord_3D = chord_2D / cos κ = chord_2D · L_3D / L_xy
// Per-projection integrand becomes N₀·exp(−μ_bg·chord_3D) / L_3D.

export function dMinAt3D(
  x: number,
  y: number,
  z: number,
  c: RadialMapConfig
): number {
  const dPhi = c.arcEndRad - c.arcStartRad;
  if (dPhi <= 0) return NaN;
  if (x * x + y * y >= c.R * c.R) return NaN;

  const cx = objCentreX(c);
  const cy = objCentreY(c);
  const rObj = objRadius(c);

  const h = dPhi / SIMPSON_PANELS;
  let sum = 0;
  for (let k = 0; k <= SIMPSON_PANELS; k++) {
    const theta = c.arcStartRad + k * h;
    const sx = c.SOD * Math.cos(theta);
    const sy = c.SOD * Math.sin(theta);
    const dx = x - sx;
    const dy = y - sy;
    const Lxy2 = dx * dx + dy * dy;
    if (Lxy2 < 1e-12) continue;
    const Lxy = Math.sqrt(Lxy2);
    const L3D = Math.sqrt(Lxy2 + z * z);
    // Chord through cylinder (xy projection — phantom is z-invariant)
    const vx = cx - sx;
    const vy = cy - sy;
    const dot = vx * dx + vy * dy;
    const t2 = (dot * dot) / Lxy2;
    const v2 = vx * vx + vy * vy;
    const perp2 = v2 - t2;
    const disc = rObj * rObj - perp2;
    if (disc <= 0) continue;
    const chord_xy = 2 * Math.sqrt(disc);
    const chord_3D = (chord_xy * L3D) / Lxy;
    const f = (c.N0 * Math.exp(-c.mu_bg * chord_3D)) / L3D;
    const w = k === 0 || k === SIMPSON_PANELS ? 1 : k % 2 === 1 ? 4 : 2;
    sum += w * f;
  }
  const G = sum / (3 * SIMPSON_PANELS);
  if (G <= 0) return NaN;
  return Math.cbrt(
    (3 * c.d_prime_threshold * c.d_prime_threshold * c.delta_a_obj) /
      (2 * c.N_theta * c.SOD * c.delta_mu * c.delta_mu * G)
  );
}

export function resolutionAt3D(
  x: number,
  y: number,
  z: number,
  c: RadialMapConfig
): number {
  const d = dMinAt3D(x, y, z, c);
  return isFinite(d) && d > 0 ? 1 / (2 * d) : NaN;
}

// ---- Crowther criterion -----------------------------------------------------
// f_crowther(r) = 1 / (2 r · max(Δφ/N_θ, π − Δφ)), capped at detector
// Nyquist 1/(2·Δa_obj). Equals N_θ / (Δφ · 2 r) whenever Δφ ≥ π; for
// Δφ < π the unsampled directional wedge is the binding gap.

export function detectorNyquist(c: RadialMapConfig): number {
  return 1 / (2 * c.delta_a_obj);
}

export function crowtherAt(x: number, y: number, c: RadialMapConfig): number {
  const r = Math.sqrt(x * x + y * y);
  const dPhi = c.arcEndRad - c.arcStartRad;
  if (dPhi <= 0) return NaN;
  const nyq = detectorNyquist(c);
  if (r < 1e-9) return nyq;
  // Largest angular gap between sampled ray directions (mod π):
  // adjacent-view spacing, or the unsampled wedge when the arc < π.
  const gap = Math.max(dPhi / c.N_theta, Math.PI - dPhi);
  const f = 1 / (2 * r * gap);
  return Math.min(f, nyq);
}

// ---- Map builders -----------------------------------------------------------

export interface ResolutionMap {
  x: number[];
  y: number[];
  z: (number | null)[][]; // [y][x] — Plotly heatmap convention
  zMin: number;
  zMax: number;
}

// Result of effectiveMap: includes both component maps plus the per-pixel
// dominance (f_noise − f_crowther) so callers can draw the crossover contour.
export interface EffectiveResolutionMap extends ResolutionMap {
  zNoise: (number | null)[][];
  zCrowther: (number | null)[][];
  zDominance: (number | null)[][]; // f_noise − f_crowther; 0-level = crossover
}

function makeGrid(c: RadialMapConfig, gridN: number): { x: number[]; y: number[] } {
  const x = new Array<number>(gridN);
  const y = new Array<number>(gridN);
  for (let i = 0; i < gridN; i++) {
    x[i] = -c.R + (2 * c.R * i) / (gridN - 1);
    y[i] = -c.R + (2 * c.R * i) / (gridN - 1);
  }
  return { x, y };
}

export function resolutionMap(c: RadialMapConfig, gridN: number = 60): ResolutionMap {
  const { x, y } = makeGrid(c, gridN);
  const z: (number | null)[][] = [];
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let j = 0; j < gridN; j++) {
    const row: (number | null)[] = new Array(gridN);
    for (let i = 0; i < gridN; i++) {
      const r2 = x[i] * x[i] + y[j] * y[j];
      if (r2 >= c.R * c.R) {
        row[i] = null;
      } else {
        const v = resolutionAt(x[i], y[j], c);
        if (isFinite(v)) {
          row[i] = v;
          if (v < zMin) zMin = v;
          if (v > zMax) zMax = v;
        } else {
          row[i] = null;
        }
      }
    }
    z.push(row);
  }
  return { x, y, z, zMin, zMax };
}

export function crowtherMap(c: RadialMapConfig, gridN: number = 60): ResolutionMap {
  const { x, y } = makeGrid(c, gridN);
  const z: (number | null)[][] = [];
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let j = 0; j < gridN; j++) {
    const row: (number | null)[] = new Array(gridN);
    for (let i = 0; i < gridN; i++) {
      const r2 = x[i] * x[i] + y[j] * y[j];
      if (r2 >= c.R * c.R) {
        row[i] = null;
      } else {
        const v = crowtherAt(x[i], y[j], c);
        if (isFinite(v)) {
          row[i] = v;
          if (v < zMin) zMin = v;
          if (v > zMax) zMax = v;
        } else {
          row[i] = null;
        }
      }
    }
    z.push(row);
  }
  return { x, y, z, zMin, zMax };
}

export function effectiveMap(
  c: RadialMapConfig,
  gridN: number = 60
): EffectiveResolutionMap {
  const { x, y } = makeGrid(c, gridN);
  const zNoise: (number | null)[][] = [];
  const zCrowther: (number | null)[][] = [];
  const z: (number | null)[][] = [];
  const zDominance: (number | null)[][] = [];
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let j = 0; j < gridN; j++) {
    const rowN: (number | null)[] = new Array(gridN);
    const rowC: (number | null)[] = new Array(gridN);
    const rowE: (number | null)[] = new Array(gridN);
    const rowD: (number | null)[] = new Array(gridN);
    for (let i = 0; i < gridN; i++) {
      const r2 = x[i] * x[i] + y[j] * y[j];
      if (r2 >= c.R * c.R) {
        rowN[i] = rowC[i] = rowE[i] = rowD[i] = null;
        continue;
      }
      const fn = resolutionAt(x[i], y[j], c);
      const fc = crowtherAt(x[i], y[j], c);
      if (!isFinite(fn) || !isFinite(fc)) {
        rowN[i] = rowC[i] = rowE[i] = rowD[i] = null;
        continue;
      }
      const fe = Math.min(fn, fc);
      rowN[i] = fn;
      rowC[i] = fc;
      rowE[i] = fe;
      rowD[i] = fn - fc;
      if (fe < zMin) zMin = fe;
      if (fe > zMax) zMax = fe;
    }
    zNoise.push(rowN);
    zCrowther.push(rowC);
    z.push(rowE);
    zDominance.push(rowD);
  }
  return { x, y, z, zMin, zMax, zNoise, zCrowther, zDominance };
}

// Marching-squares extraction of the f_noise = f_crowther crossover polyline.
// Returns one or more polylines (lists of (x, y) points) suitable for plotting
// as a 2D scatter trace or, after z-lifting, a 3D scatter trace on the surface.
export interface Segment {
  x: number;
  y: number;
}

export function crossoverPolylines(
  m: EffectiveResolutionMap
): Segment[][] {
  const { x, y, zDominance } = m;
  const nx = x.length;
  const ny = y.length;
  const segs: Segment[][] = [];
  // Each grid cell produces 0–2 line segments at the level=0 isocontour.
  // We collect each cell's segments individually rather than stitching them —
  // visually that draws as a continuous dashed curve.
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v00 = zDominance[j][i];
      const v10 = zDominance[j][i + 1];
      const v01 = zDominance[j + 1][i];
      const v11 = zDominance[j + 1][i + 1];
      if (v00 == null || v10 == null || v01 == null || v11 == null) continue;
      const pts: Segment[] = [];
      // Edge (i,j)-(i+1,j)
      if ((v00 <= 0) !== (v10 <= 0)) {
        const t = v00 / (v00 - v10);
        pts.push({ x: x[i] + t * (x[i + 1] - x[i]), y: y[j] });
      }
      // Edge (i+1,j)-(i+1,j+1)
      if ((v10 <= 0) !== (v11 <= 0)) {
        const t = v10 / (v10 - v11);
        pts.push({ x: x[i + 1], y: y[j] + t * (y[j + 1] - y[j]) });
      }
      // Edge (i,j+1)-(i+1,j+1)
      if ((v01 <= 0) !== (v11 <= 0)) {
        const t = v01 / (v01 - v11);
        pts.push({ x: x[i] + t * (x[i + 1] - x[i]), y: y[j + 1] });
      }
      // Edge (i,j)-(i,j+1)
      if ((v00 <= 0) !== (v01 <= 0)) {
        const t = v00 / (v00 - v01);
        pts.push({ x: x[i], y: y[j] + t * (y[j + 1] - y[j]) });
      }
      if (pts.length === 2) segs.push(pts);
      else if (pts.length === 4) {
        // Saddle: pair (0,1) and (2,3)
        segs.push([pts[0], pts[1]]);
        segs.push([pts[2], pts[3]]);
      }
    }
  }
  return segs;
}

// Bilinear sample on the [y][x] grid; returns NaN if either neighbour is null.
export function bilinearSample(
  m: ResolutionMap,
  px: number,
  py: number
): number {
  const { x, y, z } = m;
  const nx = x.length;
  const ny = y.length;
  const dx = x[1] - x[0];
  const dy = y[1] - y[0];
  const fi = (px - x[0]) / dx;
  const fj = (py - y[0]) / dy;
  const i = Math.max(0, Math.min(nx - 2, Math.floor(fi)));
  const j = Math.max(0, Math.min(ny - 2, Math.floor(fj)));
  const ti = fi - i;
  const tj = fj - j;
  const v00 = z[j][i];
  const v10 = z[j][i + 1];
  const v01 = z[j + 1][i];
  const v11 = z[j + 1][i + 1];
  if (v00 == null || v10 == null || v01 == null || v11 == null) return NaN;
  return (
    (1 - ti) * (1 - tj) * v00 +
    ti * (1 - tj) * v10 +
    (1 - ti) * tj * v01 +
    ti * tj * v11
  );
}
