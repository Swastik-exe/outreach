import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './context/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        space: ['var(--font-space)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)', 'monospace'],
      },
      colors: {
        bg:        '#0A0B0E',
        surface:   '#111318',
        surface2:  '#1A1D24',
        border:    '#2A2D36',
        primary:   '#6366F1',
        'primary-lt': '#818CF8',
        text:      '#F4F5F7',
        muted:     '#8B8FA8',
        dim:       '#4B4F63',
      },
    },
  },
  plugins: [],
};

export default config;
