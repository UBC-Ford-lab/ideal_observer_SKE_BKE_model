import React, { useState, useRef, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const Tex: React.FC<{ tex: string; block?: boolean }> = ({ tex, block }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, { displayMode: !!block, throwOnError: false });
    }
  }, [tex, block]);
  return block ? (
    <div className="my-2 text-center">
      <span ref={ref} />
    </div>
  ) : (
    <span ref={ref} />
  );
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, children, defaultOpen }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-t border-gray-200 first:border-t-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 text-left text-xs font-mono font-bold text-gray-800 hover:text-gray-600"
      >
        <span>{title}</span>
        <span className="text-gray-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="pb-3 text-xs font-mono text-gray-700 space-y-2 leading-relaxed">{children}</div>}
    </div>
  );
};

export const DerivationWalkthrough: React.FC = () => {
  return (
    <div className="text-xs font-mono">
      <p className="text-gray-600 mb-3">
        Given noisy CT projection data, what is the smallest feature we can detect at a given
        contrast level? This limit is a property of the photon statistics and scan geometry —
        it holds regardless of reconstruction algorithm.
      </p>

      <Section title="Setup" defaultOpen>
        <p>
          Scan with <Tex tex="N_\theta" /> projections, detector pixel pitch <Tex tex="\Delta a_{obj}" /> at
          the object plane, <Tex tex="N_0" /> photons per pixel in the unattenuated beam. A circular
          disc of diameter <Tex tex="d" /> and linear-attenuation contrast <Tex tex="\Delta\mu" /> sits
          inside a uniform background of attenuation <Tex tex="\mu_{bg}" /> and path length <Tex tex="L" />.
        </p>
        <p>The background attenuates the beam:</p>
        <Tex tex="T_{bg} = e^{-\mu_{bg} L}, \qquad N_{bg} = N_0 \cdot T_{bg}" block />
      </Section>

      <Section title="Step 1 — Disc profile in one projection">
        <p>
          For a ray at offset <Tex tex="t" /> from the disc centre (radius <Tex tex="R = d/2" />),
          the extra attenuation is the chord length times <Tex tex="\Delta\mu" />:
        </p>

        <DiscGeometryFigure />

        <Tex tex="\Delta p(t) = 2\,\Delta\mu \sqrt{R^2 - t^2} \quad \text{for } |t| < R" block />
        <p>and zero outside. The disc being circular, every projection angle sees the same profile.</p>
      </Section>

      <Section title="Step 2 — Matched filter (ideal observer)">
        <p>
          The optimal detector for a known signal in Gaussian noise is the matched filter (Hsieh
          et al. 2022). With per-pixel noise variance <Tex tex="\sigma_p^2 = 1/N_{bg}" />, its
          detectability index is
        </p>
        <Tex tex="d'^2 = \sum_{\theta}\sum_{i} \frac{[\Delta p(t_i)]^2}{\sigma_p^2}" block />
        <p className="text-gray-600 italic">
          Please note: the authors in (Hsieh et al. 2022) derived the minimum viable <Tex tex="d'" /> to
          be 5 — essentially the projection-domain SNR, or detectability. I consider this parameter to
          be tunable (above).
        </p>
      </Section>

      <Section title="Step 3 — Single-projection contribution">
        <p>Converting the pixel sum to an integral with spacing <Tex tex="\Delta a_{obj}" />:</p>
        <Tex
          tex="d'^2_{\text{single}} = \frac{1}{\sigma_p^2 \Delta a_{obj}} \int_{-R}^{R} [\Delta p(t)]^2 \, dt = \frac{4 N_{bg}\Delta\mu^2}{\Delta a_{obj}} \int_{-R}^{R} (R^2 - t^2) \, dt"
          block
        />
        <p>The integral evaluates to <Tex tex="4R^3/3 = d^3/6" />, giving</p>
        <Tex tex="d'^2_{\text{single}} = \frac{2\,N_{bg}\,\Delta\mu^2\,d^3}{3\,\Delta a_{obj}}" block />
        <p className="text-gray-600 italic">i.e. the detectability due to a single projection.</p>
      </Section>

      <Section title="Step 4 — Sum over all projections">
        <p>
          Noise is independent across projections and every angle sees the same profile, so multiply
          by <Tex tex="N_\theta" />:
        </p>
        <Tex tex="d'^2 = \frac{2\,N_\theta\,N_{bg}\,\Delta\mu^2\,d^3}{3\,\Delta a_{obj}}" block />
        <p>
          The <Tex tex="d^3" /> scaling: <Tex tex="d^2" /> from disc area (more pixels), and an extra
          factor of <Tex tex="d" /> from path length through the disc (larger per-pixel signal).
        </p>
      </Section>

      <Section title="Step 5 — Minimum detectable disc (Rose criterion)">
        <p>Setting <Tex tex="d' = d'_{\text{th}}" /> and solving for <Tex tex="d" />:</p>
        <Tex
          tex="d_{\min} = \left(\frac{3\,(d'_{\text{th}})^2\,\Delta a_{obj}}{2\,N_\theta\,N_{bg}\,\Delta\mu^2}\right)^{1/3}"
          block
        />
        <p>(Classical Rose uses <Tex tex="d'_{\text{th}} = 3" />.)</p>
      </Section>

      <Section title="Step 6 — Spatial frequency limit">
        <p>Spatial frequency at the minimum detectable disc, in line pairs per mm:</p>
        <Tex tex="f = \frac{1}{2\,d_{\min}} \quad [\text{lp/mm}]" block />
        <p>
          This is the photon-noise resolution limit — the highest spatial frequency at which features
          of contrast <Tex tex="\Delta\mu" /> are detectable, regardless of reconstruction method.
        </p>
      </Section>

      <Section title="Step 7 — Off-axis extension (fan-beam)">
        <p>
          Steps 1–6 placed the feature at the isocentre, where every projection traverses the
          full diameter and every <Tex tex="N_{bg}" /> is the same. For a feature at position{' '}
          <Tex tex="P=(x,y)" /> with a point source at distance <Tex tex="D" /> (SOD) from the
          isocentre, two things change.
        </p>

        <p>
          <strong>(a) Chord through the phantom depends on angle.</strong> With source at{' '}
          <Tex tex="S(\theta)=(D\cos\theta, D\sin\theta)" /> and unit ray direction{' '}
          <Tex tex="\hat d = (P-S)/|P-S|" />, the chord is
        </p>
        <Tex
          tex="\text{chord}(\theta,P) = 2\sqrt{(S\!\cdot\!\hat d)^2 - (D^2 - R^2)}"
          block
        />

        <p>
          <strong>(b) Object-plane pixel pitch scales with source distance.</strong> Anchoring{' '}
          <Tex tex="\Delta a_{obj}" /> to its isocentre value,
        </p>
        <Tex
          tex="\Delta a_{obj}(P, \theta) = \Delta a_{obj}\cdot \frac{|P-S(\theta)|}{D}"
          block
        />

        <p>
          Folding (a) and (b) back into the Step 4 sum — each projection{' '}
          <Tex tex="\theta_j" /> now contributes its own{' '}
          <Tex tex="N_{bg}(\theta_j, P)/\Delta a_{obj}(\theta_j, P)" />:
        </p>
        <Tex
          tex="d_{\min}(P) = \left(\frac{3\,(d'_{\text{th}})^2\,\Delta a_{obj}}{2\,\Delta\mu^2\,D\,\displaystyle\sum_{\theta}\dfrac{N_0\,e^{-\mu_{bg}\,\text{chord}(\theta,P)}}{|P-S(\theta)|}}\right)^{1/3}"
          block
        />
        <p>
          where the sum runs over all <Tex tex="N_\theta" /> projection angles in the scan arc.
        </p>
      </Section>

      <Section title="Step 8 — Off-mid-slice extension (CBCT)">
        <p>
          Step 7 still kept the feature in the midplane of the source orbit{' '}
          (<Tex tex="z = 0" />). In a cone-beam scan, voxels above or below the midplane are hit
          by rays tilted out of the orbit plane by the cone angle{' '}
          <Tex tex="\kappa" />. For a voxel at <Tex tex="P=(x,y,z)" />, define
        </p>
        <Tex
          tex="L_{xy} = \sqrt{(x - D\cos\theta)^2 + (y - D\sin\theta)^2}, \quad L_{3D} = \sqrt{L_{xy}^2 + z^2}, \quad \cos\kappa = L_{xy}/L_{3D}"
          block
        />

        <p>
          For a phantom that is invariant along <Tex tex="z" /> (an extruded cylinder), the
          horizontal projection of the ray is the same line we already computed the chord for;
          the tilt only stretches the traversal length:
        </p>
        <Tex tex="\text{chord}_{3D}(\theta, P) = \text{chord}(\theta, P)/\cos\kappa" block />

        <p>The pixel-pitch correction uses the 3D source-to-voxel distance:</p>
        <Tex tex="\Delta a_{obj}(P, \theta) = \Delta a_{obj}\cdot L_{3D}/D" block />

        <p>
          Substituting into the Step 7 sum (each projection's <Tex tex="|P-S|" /> becomes{' '}
          <Tex tex="L_{3D}" /> and each chord acquires the <Tex tex="\sec\kappa" /> factor):
        </p>
        <Tex
          tex="d_{\min}(P) = \left(\frac{3\,(d'_{\text{th}})^2\,\Delta a_{obj}}{2\,\Delta\mu^2\,D\,\displaystyle\sum_{\theta}\dfrac{N_0\,e^{-\mu_{bg}\,\text{chord}_{3D}(\theta,P)}}{L_{3D}(\theta,P)}}\right)^{1/3}"
          block
        />

        <p>
          The effect is set by the cone half-angle and is small for typical micro-CT (~1%). The
          Tuy condition can be ignored for an ideal observer.
        </p>
      </Section>

      <Section title="Step 9 — Angular sampling (Crowther criterion)">
        <p>
          Steps 1–8 ask whether a feature is <em>detectable</em> above photon noise. A second,
          independent question is whether the angular sample set can <em>represent</em> the
          spatial-frequency content the feature carries. Even with infinitely many photons, a finite
          number of projections imposes a ceiling on resolvable spatial frequency at each radius
          from the centre of rotation.
        </p>

        <p>
          With <Tex tex="N_\theta" /> projections spread over a scan arc of total extent{' '}
          <Tex tex="\Delta\phi" /> (radians), the angular spacing between adjacent projections is{' '}
          <Tex tex="\Delta\theta_{\text{step}} = \Delta\phi / N_\theta" />. At distance{' '}
          <Tex tex="r" /> from the COR, two adjacent projection directions subtend a circumferential
          arc length
        </p>
        <Tex
          tex="s(r) = r\,\Delta\theta_{\text{step}} = \frac{\Delta\phi\,r}{N_\theta}"
          block
        />

        <CrowtherGeometryFigure />

        <p>
          The polar sampling grid is Nyquist-limited by its coarsest direction. At radius{' '}
          <Tex tex="r" /> the coarsest direction is circumferential, with spacing{' '}
          <Tex tex="s(r)" />. The highest spatial frequency representable without aliasing is{' '}
          <Tex tex="1/(2 s)" />:
        </p>
        <Tex
          tex="f_{\text{Crowther}}(r) = \frac{1}{2 s(r)} = \frac{N_\theta}{2\,\Delta\phi\,r}"
          block
        />
        <p>diverging at <Tex tex="r=0" /> and falling as <Tex tex="1/r" /> outward.</p>

        <p>
          Two refinements make this exact for any arc. Ray directions repeat modulo{' '}
          <Tex tex="\pi" />, so what matters is the largest angular <em>gap</em> between sampled
          directions. For <Tex tex="\Delta\phi \ge \pi" /> the conjugate-covered band only
          revisits directions and the gap is the adjacent-view spacing{' '}
          <Tex tex="\Delta\phi/N_\theta" /> — no redundancy correction is needed, and at{' '}
          <Tex tex="\Delta\phi = 2\pi" /> this automatically reproduces the familiar
          &ldquo;<Tex tex="N_\theta/2" /> independent views over <Tex tex="\pi" />&rdquo;
          convention. For <Tex tex="\Delta\phi < \pi" /> an unsampled wedge of directions of
          width <Tex tex="\pi - \Delta\phi" /> remains (the limited-angle regime), and that wedge
          becomes the binding gap. The calculator therefore evaluates
        </p>
        <Tex
          tex="f_{\text{Crowther}}(r) = \frac{1}{2 r \cdot \max\!\left(\Delta\phi/N_\theta,\; \pi - \Delta\phi\right)}"
          block
        />
        <p>
          which equals <Tex tex="N_\theta/(2\,\Delta\phi\,r)" /> for every arc of at least{' '}
          <Tex tex="180^\circ" /> and collapses toward zero as the arc shrinks below it. (In the
          limited-angle regime this is the worst-direction bound; resolution along the sampled
          directions is anisotropic and can be better.)
        </p>

        <p>
          Regardless of how many projections you acquire, no spatial frequency above the detector
          Nyquist <Tex tex="1/(2\,\Delta a_{obj})" /> survives a sampled detector. The angular
          ceiling is therefore capped:
        </p>
        <Tex
          tex="f_{\text{Crowther}}(r) = \min\!\left(\frac{1}{2 r \cdot \max\!\left(\Delta\phi/N_\theta,\; \pi - \Delta\phi\right)},\;\frac{1}{2\,\Delta a_{obj}}\right)"
          block
        />
        <p>
          shown in panel <strong>(b)</strong> of the radial map. The flat red plateau near the COR
          in the 3D view is this cap.
        </p>

        <p>
          The effective resolution ceiling at each voxel <Tex tex="P" /> is the more restrictive
          of the two limits:
        </p>
        <Tex
          tex="f_{\max}(P) = \min\!\big(f_{\text{noise}}(P),\; f_{\text{Crowther}}(|P|)\big)"
          block
        />
        <p>
          shown in panel <strong>(c)</strong>. The two limits are independent: noise vanishes as{' '}
          <Tex tex="N_0 \to \infty" />, leaving angular sampling; angular sampling vanishes as{' '}
          <Tex tex="N_\theta \to \infty" />, leaving noise. The white dashed contour marks the
          set <Tex tex="\{P : f_{\text{noise}}(P) = f_{\text{Crowther}}(|P|)\}" /> — inside, photon
          noise dominates; outside, angular sampling does.
        </p>
        <p className="text-gray-600 italic">
          Note: Crowther's argument is independent of <Tex tex="N_0" />, <Tex tex="\Delta\mu" />,
          and the matched filter — it would still apply with infinitely many photons. It is a
          property of the <em>sampling</em>, not the <em>statistics</em>.
        </p>
      </Section>

      <Section title="Step 10 — Off-centre object cylinder">
        <p>
          Step 7's chord formula{' '}
          <Tex tex="\text{chord}(\theta, P) = 2\sqrt{(S\!\cdot\!\hat d)^2 - (D^2 - R^2)}" />{' '}
          silently assumed the background cylinder of radius <Tex tex="R" /> was centred at the
          isocentre. For a real specimen — e.g. a mouse on an off-centre bed — the bulk attenuator
          is better modelled as a cylinder of radius <Tex tex="R_{obj}" /> centred at{' '}
          <Tex tex="C=(c_x, c_y)" />, distinct from the COR.
        </p>

        <p>
          Generalising to the line-circle intersection at the new centre: with{' '}
          <Tex tex="V = C - S(\theta)" /> and unit ray direction{' '}
          <Tex tex="\hat d = (P - S)/|P-S|" />, the perpendicular distance from <Tex tex="C" /> to
          the ray line is <Tex tex="\text{perp}^2 = |V|^2 - (V\!\cdot\!\hat d)^2" />, giving
        </p>
        <Tex
          tex="\text{chord}(\theta, P) = 2\sqrt{R_{obj}^2 - \text{perp}^2} \quad \text{when } R_{obj}^2 > \text{perp}^2,\; 0\text{ otherwise}"
          block
        />

        <p>
          The rest of Step 7 is unchanged — this chord plugs directly into the same{' '}
          <Tex tex="d'^2" /> sum. When <Tex tex="(c_x, c_y) = (0,0)" /> and{' '}
          <Tex tex="R_{obj} = R" />, the formula collapses back to the centred form.
        </p>

        <p>
          Intuition: projection angles that "look through" more of the cylinder attenuate the beam
          more, leave fewer <Tex tex="N_{bg}" /> photons at the detector, and contribute less to{' '}
          <Tex tex="d'^2" /> at <Tex tex="P" />. When <Tex tex="C" /> is offset from the COR this
          redistribution is asymmetric — which is what produces the lobe pattern visible in panel{' '}
          <strong>(a)</strong> of the radial map when you move the object centre off origin.
        </p>
      </Section>

      <Section title="References">
        <p>Primary reference:</p>
        <ul className="list-disc ml-5 space-y-1 text-gray-700">
          <li>
            Barrett HH, Myers KJ. <em>Foundations of Image Science.</em> Wiley, 2004.
            <span className="text-gray-600"> (this really helped me derive and understand the main argument and derivation)</span>
          </li>
        </ul>
        <p className="mt-3">Some other references I found which derived parts of these concepts before me:</p>
        <ul className="list-disc ml-5 space-y-1 text-gray-700">
          <li>
            Crowther RA, DeRosier DJ, Klug A. "The reconstruction of a three-dimensional structure
            from projections and its application to electron microscopy." <em>Proc R Soc Lond A</em>{' '}
            317: 319–340, 1970.
            <span className="text-gray-600"> (the classic angular-sampling derivation underlying Step 9)</span>
          </li>
          <li>
            Hsieh SS et al. "A minimum SNR criterion for computed tomography object detection in
            the projection domain." <em>Med Phys</em> 49(8): 4988–4998, 2022.
          </li>
          <li>
            Hanson KM. "Detectability in computed tomographic images." <em>Med Phys</em> 6(5):
            441–451, 1979.
          </li>
          <li>
            Gang GJ et al. "Anatomical background and generalized detectability in tomosynthesis
            and cone-beam CT." <em>Med Phys</em> 37(5): 1948–1965, 2010.
          </li>
          <li>
            Rose A. <em>Vision: Human and Electronic.</em> Plenum Press, 1973.
          </li>
        </ul>
      </Section>
    </div>
  );
};

const DiscGeometryFigure: React.FC = () => {
  // Disc: centre (170, 115), radius R=60. Ray horizontal at y=85 → offset t=30.
  // Chord half-length = sqrt(60^2 - 30^2) ≈ 51.96 → endpoints x ∈ [118, 222].
  const cx = 170, cy = 115, R = 60, t = 30;
  const halfChord = Math.sqrt(R * R - t * t);
  const xL = cx - halfChord, xR = cx + halfChord;
  const rayY = cy - t;

  return (
    <figure className="my-3 flex flex-col items-center">
      <svg viewBox="0 0 340 200" className="w-full max-w-sm" aria-label="Disc projection geometry">
        {/* Beam direction arrow above */}
        <g stroke="#9ca3af" strokeWidth="0.8" fill="none">
          <line x1="20" y1="25" x2="60" y2="25" />
        </g>
        <polygon points="60,25 55,22 55,28" fill="#9ca3af" />
        <text x="65" y="28" fontFamily="ui-monospace,monospace" fontSize="9" fill="#6b7280">
          beam direction
        </text>

        {/* Disc */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#374151" strokeWidth="1.2" />

        {/* Centre dot */}
        <circle cx={cx} cy={cy} r="1.8" fill="#374151" />

        {/* The ray (full extent) */}
        <line x1="20" y1={rayY} x2="320" y2={rayY} stroke="#9ca3af" strokeWidth="0.8" />
        <polygon points={`320,${rayY} 315,${rayY - 3} 315,${rayY + 3}`} fill="#9ca3af" />

        {/* Highlighted chord through disc */}
        <line x1={xL} y1={rayY} x2={xR} y2={rayY} stroke="#1d4ed8" strokeWidth="2.5" />

        {/* Perpendicular from centre to ray (offset t) */}
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={rayY}
          stroke="#374151"
          strokeWidth="0.9"
          strokeDasharray="3,2"
        />
        {/* Right-angle marker at intersection */}
        <polyline
          points={`${cx + 5},${rayY} ${cx + 5},${rayY + 5} ${cx},${rayY + 5}`}
          fill="none"
          stroke="#374151"
          strokeWidth="0.8"
        />

        {/* Radius from centre to right chord endpoint */}
        <line x1={cx} y1={cy} x2={xR} y2={rayY} stroke="#374151" strokeWidth="0.9" strokeDasharray="3,2" />

        {/* Labels */}
        <text x={cx + 4} y={cy - t / 2 + 3} fontFamily="ui-monospace,monospace" fontSize="11" fill="#374151">
          t
        </text>
        <text
          x={cx + halfChord / 2 + 2}
          y={cy - t / 2 + 12}
          fontFamily="ui-monospace,monospace"
          fontSize="11"
          fill="#374151"
        >
          R
        </text>
        <text
          x={cx - 40}
          y={rayY - 6}
          fontFamily="ui-monospace,monospace"
          fontSize="10"
          fill="#1d4ed8"
        >
          2√(R²−t²)
        </text>
        <text
          x={cx - 6}
          y={cy + R + 14}
          fontFamily="ui-monospace,monospace"
          fontSize="10"
          fill="#374151"
        >
          disc (Δμ)
        </text>
      </svg>
      <figcaption className="text-xs text-gray-500 mt-1">
        A single ray at offset <em>t</em> from the disc centre traverses a chord of length
        2√(R²−t²); the extra attenuation along that ray is Δμ times the chord length.
      </figcaption>
    </figure>
  );
};

const CrowtherGeometryFigure: React.FC = () => {
  // COR at (170, 130). Two adjacent projection directions separated by 25°
  // (exaggerated for visibility). Show the circle of radius r and the
  // circumferential arc s between the two radii.
  const cx = 170, cy = 130, r = 70;
  const dThetaDeg = 25;
  const dTheta = (dThetaDeg * Math.PI) / 180;
  // Angles measured from +x axis, CCW. Direction A is straight up (90°);
  // direction B is 25° clockwise from A.
  const aAngle = Math.PI / 2;
  const bAngle = aAngle - dTheta;
  const ax = cx + r * Math.cos(aAngle);
  const ay = cy - r * Math.sin(aAngle);
  const bx = cx + r * Math.cos(bAngle);
  const by = cy - r * Math.sin(bAngle);
  // Inner Δθ marker arc (small radius near COR).
  const rInner = 18;
  const ix0 = cx + rInner * Math.cos(aAngle);
  const iy0 = cy - rInner * Math.sin(aAngle);
  const ix1 = cx + rInner * Math.cos(bAngle);
  const iy1 = cy - rInner * Math.sin(bAngle);

  return (
    <figure className="my-3 flex flex-col items-center">
      <svg viewBox="0 0 340 200" className="w-full max-w-sm" aria-label="Crowther sampling geometry">
        {/* Circle of radius r (dashed grey) */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#9ca3af" strokeWidth="0.8" strokeDasharray="3,2" />

        {/* COR marker (small +) */}
        <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="#374151" strokeWidth="1.2" />
        <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="#374151" strokeWidth="1.2" />
        <text x={cx - 18} y={cy + 16} fontFamily="ui-monospace,monospace" fontSize="9" fill="#6b7280">
          COR
        </text>

        {/* Radial line A (projection direction θ) */}
        <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="#374151" strokeWidth="1.0" />
        {/* Radial line B (projection direction θ + Δθ) */}
        <line x1={cx} y1={cy} x2={bx} y2={by} stroke="#374151" strokeWidth="1.0" />

        {/* Highlighted circumferential arc at radius r */}
        <path
          d={`M ${ax} ${ay} A ${r} ${r} 0 0 1 ${bx} ${by}`}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="2.5"
        />

        {/* Δθ marker arc near COR */}
        <path
          d={`M ${ix0} ${iy0} A ${rInner} ${rInner} 0 0 1 ${ix1} ${iy1}`}
          fill="none"
          stroke="#374151"
          strokeWidth="0.9"
        />

        {/* Labels */}
        <text x={cx + 8} y={cy - 8} fontFamily="ui-monospace,monospace" fontSize="11" fill="#374151">
          Δθ
        </text>
        <text
          x={cx - 14}
          y={cy - r / 2 + 6}
          fontFamily="ui-monospace,monospace"
          fontSize="11"
          fill="#374151"
        >
          r
        </text>
        {/* Arc-label position: midpoint of arc pushed radially outward so it
            sits above the circle, well clear of the θ ray-tip label. */}
        <text
          x={cx + (r + 22) * Math.cos((aAngle + bAngle) / 2) - 26}
          y={cy - (r + 22) * Math.sin((aAngle + bAngle) / 2) + 4}
          fontFamily="ui-monospace,monospace"
          fontSize="10"
          fill="#1d4ed8"
        >
          s = r·Δθ
        </text>

        {/* Direction labels at the ray tips */}
        <text x={ax - 14} y={ay - 4} fontFamily="ui-monospace,monospace" fontSize="9" fill="#6b7280">
          θ
        </text>
        <text x={bx + 4} y={by - 4} fontFamily="ui-monospace,monospace" fontSize="9" fill="#6b7280">
          θ + Δθ
        </text>
      </svg>
      <figcaption className="text-xs text-gray-500 mt-1 max-w-md text-center">
        Two adjacent projection directions, separated by Δθ. At radius <em>r</em> from the COR, the
        circumferential arc length between them is <em>s = r·Δθ</em> — the tangential Nyquist
        spacing at that radius. Δθ shown exaggerated.
      </figcaption>
    </figure>
  );
};
