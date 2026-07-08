/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cinelog identity — "teal & orange" cinema grade on indigo-plum night.
        // Driven by CSS variables (index.css) so a light theme can be added later.
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
        // Accents: amber (primary) · cyan (secondary) · rose (affection)
        accent: 'rgb(var(--gold) / <alpha-value>)',
        gold: 'rgb(var(--gold) / <alpha-value>)',
        cyan: 'rgb(var(--cyan) / <alpha-value>)',
        rose: 'rgb(var(--rose) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        // Condensed grotesque for uppercase eyebrows, titles, and data.
        cond: ['"Haas Grot Disp"', '"Helvetica Neue"', '"Arial Narrow"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        soft: '0 12px 34px -12px rgb(0 0 0 / 0.72)',
        'glow-gold': '0 20px 42px -12px rgb(255 177 60 / 0.32)',
      },
      keyframes: {
        fadeup: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'none' },
        },
        kenburns: {
          from: { transform: 'scale(1) translate(0,0)' },
          to: { transform: 'scale(1.12) translate(-2%, -1.5%)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        glowpulse: {
          '0%,100%': { boxShadow: '0 6px 18px -6px rgb(255 177 60 / 0.5)' },
          '50%': { boxShadow: '0 6px 20px -6px rgb(69 208 221 / 0.55)' },
        },
        blip: {
          '0%': { boxShadow: '0 0 0 0 rgb(69 208 221 / 0.6)' },
          '70%,100%': { boxShadow: '0 0 0 7px rgb(69 208 221 / 0)' },
        },
      },
      animation: {
        fadeup: 'fadeup 0.6s both',
        kenburns: 'kenburns 26s ease-in-out infinite alternate',
        marquee: 'marquee 42s linear infinite',
        glowpulse: 'glowpulse 5s ease-in-out infinite',
        blip: 'blip 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
