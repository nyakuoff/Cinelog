import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { posterGradient } from '../lib/poster';

// A drifting collage of placeholder posters behind the branding panel.
const COLLAGE = [
  'Dune', 'Shogun', 'Frieren', 'Oppenheimer', 'Arcane', 'The Bear',
  'Poor Things', 'Severance', 'Blade Runner', 'Spirited Away', 'Chernobyl', 'Interstellar',
  'Past Lives', 'The Boys', 'Planet Earth', 'Succession',
];

interface Props {
  eyebrow: string;
  heading: string;
  subheading: string;
  features?: string[];
  children: ReactNode;
}

export function AuthLayout({ eyebrow, heading, subheading, features, children }: Props): JSX.Element {
  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      {/* Branding panel */}
      <aside className="relative hidden overflow-hidden bg-bg-2 lg:block">
        <div
          className="absolute -inset-24 grid grid-cols-4 gap-3 opacity-[0.28]"
          style={{ transform: 'rotate(-9deg) scale(1.15)' }}
          aria-hidden="true"
        >
          {COLLAGE.map((t, i) => (
            <div
              key={t}
              className="aspect-[2/3] rounded-md"
              style={{ background: posterGradient(t + i), animation: 'fadeup 0.8s both', animationDelay: `${i * 45}ms` }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-tr from-bg-2 via-bg-2/85 to-bg-2/40" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(90% 60% at 20% 90%, rgb(255 177 60 / 0.14), transparent 60%), radial-gradient(70% 50% at 90% 10%, rgb(69 208 221 / 0.12), transparent 60%)',
          }}
        />

        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo size={34} glow className="text-2xl" />
          <div className="max-w-md">
            <h2 className="font-cond text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-content text-balance">
              Every frame you watch, in one place.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              A self-hosted diary for films, series, anime, and everything else — your
              library, your ratings, your data.
            </p>
            {features && (
              <ul className="mt-7 space-y-2.5">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-content/90">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] text-gold">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="font-cond text-xs uppercase tracking-[0.2em] text-muted-2">
            Cinelog · self-hosted
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo size={30} glow />
          </div>
          <p className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.2em] text-gold">
            {eyebrow}
          </p>
          <h1 className="font-cond text-3xl font-extrabold uppercase tracking-tight text-content">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-muted">{subheading}</p>
          <div className="mt-7">{children}</div>
        </div>
      </section>
    </div>
  );
}
