// Spatial map of the ideal-observer limiting resolution inside a uniform
// circular phantom, with fan-beam (point-source) geometry and per-voxel
// magnification correction.
//
// For each voxel P=(x,y) and projection angle θ, the source is at
//   S(θ) = (SOD·cos θ, SOD·sin θ)
// and rays diverge from that point. Two geometric effects are folded in:
//
// 1. Fan-beam chord through the phantom:
//      chord_fan(θ, P) = 2·√((S·d̂)² − (|S|² − R²))
//    where d̂ = (P − S)/|P − S|. Reduces to the parallel-beam chord
//    2·√(R² − r²·sin²(θ−α)) as SOD → ∞.
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

export interface RadialMapConfig {
  R: number;              // phantom radius (mm) = L/2
  N0: number;             // photons/pixel in unattenuated beam
  mu_bg: number;          // mm^-1
  N_theta: number;        // total number of projections
  delta_a_obj: number;    // mm — pitch projected to isocentre
  delta_mu: number;       // mm^-1
  d_prime_threshold: number;
  arcStartRad: number;    // scan arc start (radians)
  arcEndRad: number;      // scan arc end (radians)
  SOD: number;            // source-to-isocentre distance (mm)
}

const SIMPSON_PANELS = 96; // even; Simpson's 1/3 rule

function chordFan(
  theta: number,
  x: number,
  y: number,
  R: number,
  D: number
): number {
  const sx = D * Math.cos(theta);
  const sy = D * Math.sin(theta);
  const dx = x - sx;
  const dy = y - sy;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return 0;
  // (S·d̂)² = (S·(P−S))² / |P−S|²
  const Sdot = sx * dx + sy * dy;
  const Smag2 = sx * sx + sy * sy;
  const disc = (Sdot * Sdot) / len2 - (Smag2 - R * R);
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

  const h = dPhi / SIMPSON_PANELS;
  let sum = 0;
  for (let k = 0; k <= SIMPSON_PANELS; k++) {
    const theta = c.arcStartRad + k * h;
    const chord = chordFan(theta, x, y, c.R, c.SOD);
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

export interface ResolutionMap {
  x: number[];
  y: number[];
  z: (number | null)[][]; // [y][x] — Plotly heatmap convention
  zMin: number;
  zMax: number;
}

export function resolutionMap(c: RadialMapConfig, gridN: number = 60): ResolutionMap {
  const x = new Array<number>(gridN);
  const y = new Array<number>(gridN);
  for (let i = 0; i < gridN; i++) {
    x[i] = -c.R + (2 * c.R * i) / (gridN - 1);
    y[i] = -c.R + (2 * c.R * i) / (gridN - 1);
  }
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
