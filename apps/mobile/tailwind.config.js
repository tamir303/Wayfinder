/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0B6BCB', dark: '#084C91', soft: '#E6F0FB' },
        surface: { DEFAULT: '#FFFFFF', muted: '#F4F6F8' },
        ink: { DEFAULT: '#12202F', muted: '#5B6B7B' },
        line: '#D8DFE6',
        danger: '#B3261E',
      },
      borderRadius: { card: '12px' },
      spacing: { gutter: '16px' },
    },
  },
};
