/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        azul: '#1B2F6E',
        'azul-d': '#0f1d45',
        'azul-l': '#2a4499',
        verde: '#1A7A4A',
        'verde-l': '#22a362',
        'verde-n': '#2ECC71',
        amber: '#E8A020',
        coral: '#D85A30',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Cormorant Garamond', 'serif'],
        ui: ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
