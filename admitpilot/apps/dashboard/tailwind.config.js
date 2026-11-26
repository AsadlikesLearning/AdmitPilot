/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        surface: {
          deep: '#0f0f10',
          page: '#141415',
          card: '#19191b',
          raised: '#232325',
          hover: '#2a2a2d',
        },
        ink: {
          primary: '#ededed',
          secondary: '#a1a1a6',
          muted: '#85858b',
        },
        brass: {
          DEFAULT: '#d4a853',
          soft: 'rgba(212, 168, 83, 0.12)',
          border: 'rgba(212, 168, 83, 0.28)',
        },
        tone: {
          positive: '#4cc38a',
          negative: '#e5484d',
        },
      },
      borderColor: {
        hairline: 'rgba(237, 237, 237, 0.08)',
        'hairline-strong': 'rgba(237, 237, 237, 0.15)',
      },
      transitionTimingFunction: {
        quart: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
