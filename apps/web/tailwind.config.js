/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Archive & Accession — see index.css for the world these serve.
        // Driven by CSS variables so a light theme stays possible later.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        'bg-2': 'rgb(var(--bg-2) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-hi': 'rgb(var(--border-hi) / <alpha-value>)',
        content: 'rgb(var(--content) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-2': 'rgb(var(--muted-2) / <alpha-value>)',
        // Three inks: acetate/edge-code · verdigris · stamp red.
        accent: 'rgb(var(--gold) / <alpha-value>)',
        gold: 'rgb(var(--gold) / <alpha-value>)',
        cyan: 'rgb(var(--cyan) / <alpha-value>)',
        rose: 'rgb(var(--rose) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
      },
      fontFamily: {
        // One superfamily carries text and labels; its width axis supplies the
        // condensed cut (see .font-cond in index.css). Self-hosted via
        // fontsource — a self-hosted instance may have no outbound internet,
        // so a CDN font would simply fail to load there.
        sans: ['"Archivo Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Arial', 'sans-serif'],
        cond: ['"Archivo Variable"', '"Arial Narrow"', 'system-ui', 'sans-serif'],
        // Typewriter for machine records: codes, dates, counts, runtimes.
        data: ['"Courier Prime"', '"Courier New"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        // Labels are cut rectangles. The scale is deliberately near-square, so
        // every `rounded-xl`/`rounded-2xl` already in the codebase resolves to
        // a label corner instead of a pill — the world holds across a hundred
        // call sites without editing each one.
        DEFAULT: '2px',
        sm: '1px',
        md: '2px',
        lg: '3px',
        xl: '3px',
        '2xl': '4px',
        '3xl': '5px',
      },
      boxShadow: {
        // Printed matter sits on a shelf: it does not float and never glows.
        // Real offset + blur, no coloured halos.
        soft: '0 10px 24px -14px rgb(0 0 0 / 0.85)',
        lift: '0 16px 34px -18px rgb(0 0 0 / 0.9)',
      },
      // Everything that used to live here — kenburns, glowpulse, blip, the
      // staggered fadeup on every tile — was scattered decoration. The world's
      // single authored motion is the stamp strike, defined in index.css.
    },
  },
  plugins: [],
};
