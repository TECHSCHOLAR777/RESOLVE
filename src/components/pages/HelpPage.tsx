import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import PageHeader, { focusRing } from './PageHeader';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 id={id} className="font-display text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-body">{children}</div>
    </section>
  );
}

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Which files are supported?',
    a: 'A 4-band Sentinel-2 L2A GeoTIFF with bands in the order B4, B3, B2, B8 (red, green, blue, near infrared) at 10 m pixel size. The image can be at most 512 × 512 pixels. Larger areas should be cut into tiles first.',
  },
  {
    q: 'Why only GeoTIFF?',
    a: 'The model works on surface reflectance in specific spectral bands, and the measurement lock and downstream maps need the georeference and pixel size. A PNG or JPEG has neither, so it cannot be processed correctly.',
  },
  {
    q: 'What does the confidence map mean?',
    a: 'It shows, per pixel, how much the added detail is supported by the measurements and the model. Lower confidence marks detail that is more inferred than observed. It is a calibrated estimate, not a guarantee, and it should be read together with the uncertainty and observed-versus-inferred layers.',
  },
  {
    q: 'Why do results expire?',
    a: 'The server keeps only a limited number of recent results, and they are lost when the service restarts. Download the GeoTIFF or the layers you need soon after a run. Samples can be run again at any time.',
  },
  {
    q: 'What happens to my files?',
    a: 'Uploaded files are processed on the server and kept temporarily so you can view and download the result. They are not published. Your run history list is stored only in this browser and can be cleared in Settings.',
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line-soft rounded-lg border border-line">
      {FAQ.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-ink hover:bg-sunken ${focusRing}`}
              >
                {f.q}
                <ChevronDown size={16} aria-hidden className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </h3>
            {isOpen && (
              <div id={`faq-${i}`} role="region" className="px-4 pb-4 text-sm leading-relaxed text-body">
                {f.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TERMS: [string, string][] = [
  ['Mamba backbone', 'A state-space sequence model that reconstructs the 2.5 m image from the 10 m input.'],
  ['Wavelet texture branch', 'A separate path for fine texture and edges.'],
  ['AlphaEarth context', 'Satellite embeddings that give the model scene context. The context is change-gated, so it is used only where it agrees with the current observation.'],
  ['Measurement lock', 'Constrains the output so that, when averaged back to 10 m, it stays consistent with the original measurement.'],
  ['Trust layer', 'Per-pixel uncertainty, an observed versus inferred detail map, and calibrated confidence.'],
  ['Downstream maps', 'Products derived from the enhanced image, such as land cover and vegetation index.'],
];

const CREDITS: ReactNode[] = [
  <>Contains modified Copernicus Sentinel data (year of acquisition shown with each scene). Sentinel-2 imagery: European Union / ESA / Copernicus.</>,
  <>AlphaEarth Foundations Satellite Embedding dataset, Google and Google DeepMind, licensed CC-BY 4.0.</>,
  <>Map tiles: © OpenStreetMap contributors, available under the Open Database Licence (ODbL).</>,
  <>Splash screen Earth: NASA Blue Marble imagery.</>,
  <>Super-resolution weights from SEN2SR (ESA OpenSR), released under CC0. The sen2sr package is MIT licensed.</>,
];

const REFERENCES: ReactNode[] = [
  <>Aybar, C. et al. (2026). SEN2SR. <i>Remote Sensing of Environment</i>.</>,
  <>Aybar, C. et al. (2024). SEN2NAIP: a large-scale dataset for Sentinel-2 image super-resolution. <i>Scientific Data</i>.</>,
  <>Brown, C. F. et al. (2025). AlphaEarth Foundations: an embedding field model for accurate and efficient global mapping from sparse label data. arXiv:2507.22291.</>,
  <>Gu, A. and Dao, T. (2023). Mamba: linear-time sequence modeling with selective state spaces. arXiv:2312.00752.</>,
];

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Help and support" subtitle="About RESOLVE, how to use it, and where the data comes from." />

      <div className="mt-6 flex flex-col gap-5">
        <Section id="about" title="About RESOLVE">
          <p>
            RESOLVE enhances Sentinel-2 imagery from 10 m to 2.5 m ground sampling distance (4×) and shows how much of the added detail can be trusted. It is built on the SEN2SR super-resolution approach, with these parts:
          </p>
          <dl className="divide-y divide-line-soft rounded-lg border border-line">
            {TERMS.map(([t, d]) => (
              <div key={t} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <dt className="font-medium text-ink">{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
          <p>
            Inferred detail is a model estimate. It should not be used as a measurement, and thin or small features in particular should be checked against the confidence and uncertainty layers.
          </p>
        </Section>

        <Section id="how" title="How to use">
          <ol className="list-decimal space-y-2 pl-5 marker:text-muted">
            <li>
              Upload a 4-band Sentinel-2 L2A GeoTIFF (bands B4, B3, B2, B8 at 10 m, up to 512 × 512 pixels), or pick one of the sample scenes.
            </li>
            <li>Wait for processing to finish. The live page shows each stage as it completes.</li>
            <li>Compare input and output, then switch layers to read confidence, uncertainty, observed versus inferred detail and the downstream maps.</li>
            <li>Export the 2.5 m GeoTIFF, layer images, a metadata file, or a one-page report from the workspace. Previous runs are listed under My results.</li>
          </ol>
        </Section>

        <Section id="faq" title="Frequently asked questions">
          <Faq />
        </Section>

        <Section id="credits" title="Data and credits">
          <ul className="list-disc space-y-1.5 pl-5 marker:text-muted">
            {CREDITS.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>

        <Section id="refs" title="References">
          <ul className="space-y-2">
            {REFERENCES.map((r, i) => (
              <li key={i} className="border-l-2 border-line pl-3">
                {r}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
