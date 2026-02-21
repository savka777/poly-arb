import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A0A0F',
        'bg-card': '#12121A',
        'bg-hover': '#1A1A26',
        'bg-elevated': '#222233',
        'text-primary': '#E8E8ED',
        'text-secondary': '#8888A0',
        'text-muted': '#555566',
        'accent-green': '#00D47E',
        'accent-red': '#FF4444',
        'accent-blue': '#4488FF',
        'accent-warning': '#FFAA00',
        'border-default': '#2A2A3A',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
