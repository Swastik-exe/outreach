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
      screens: {
        shell: '820px',
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        space: ['var(--font-space)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)', 'monospace'],
      },
      colors: {
        bg:            '#050816',
        surface:       '#0B1220',
        surface2:      '#151E31',
        card:          '#111827',
        border:        '#22304A',
        inner:         '#1B2740',
        'hover-border':'#33456B',
        'row-hover':   '#151E31',
        primary:       '#7C3AED',
        'primary-lt':  '#A78BFA',
        'primary-hover':'#8B5CF6',
        'primary-active':'#6D28D9',
        teal:          '#2DD4BF',
        amber:         '#F59E0B',
        success:       '#10B981',
        'success-lt':  '#34D399',
        error:         '#FB7185',
        text:          '#F8FAFC',
        muted:         '#A5B4C3',
        dim:           '#64748B',
      },
      maxWidth: {
        content:  '1060px',
        score:    '900px',
        settings: '760px',
        marketing:'1100px',
      },
    },
  },
  plugins: [],
};

export default config;
