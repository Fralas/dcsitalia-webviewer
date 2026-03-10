/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Situation-monitor inspired dark palette
        'yt-bg-primary': '#050a11',
        'yt-bg-secondary': '#0f1721',
        'yt-bg-tertiary': '#162330',
        'yt-text-primary': '#e9f1ff',
        'yt-text-secondary': '#9db0ca',
        'yt-accent': '#4ec5ff',
        'yt-border': '#243446',
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
