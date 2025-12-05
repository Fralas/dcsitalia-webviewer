/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dcs-dark': '#0f172a',
        'dcs-darker': '#020617',
        'dcs-blue': '#3b82f6',
        'dcs-red': '#ef4444',
        'dcs-yellow': '#f59e0b',
        'dcs-green': '#10b981',
      },
    },
  },
  plugins: [],
}
