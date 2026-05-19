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
