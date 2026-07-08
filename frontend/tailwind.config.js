/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Industrial dark palette (landing + Syria map)
        'yt-bg-primary': '#0F0F0F',
        'yt-bg-secondary': '#1E1E1E',
        'yt-bg-tertiary': '#252526',
        'yt-text-primary': '#EDEDED',
        'yt-text-secondary': '#9A9A9A',
        'yt-accent': '#FF8C00',
        'yt-border': '#3C3C3C',
        // Legacy colors (keeping for backward compatibility)
        'dcs-dark': '#212121',
        'dcs-darker': '#0f0f0f',
        'dcs-blue': '#3ea6ff',
        'dcs-red': '#ef4444',
        'dcs-yellow': '#f59e0b',
        'dcs-green': '#10b981',
      },
    },
  },
  plugins: [],
}
