/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // YouTube-inspired dark mode colors
        'yt-bg-primary': '#0f0f0f',      // Main background
        'yt-bg-secondary': '#212121',    // Card/Container background
        'yt-bg-tertiary': '#282828',     // Hover/Active states
        'yt-text-primary': '#f1f1f1',    // Main text
        'yt-text-secondary': '#aaaaaa',  // Secondary text
        'yt-accent': '#3ea6ff',          // YouTube blue accent
        'yt-border': '#303030',          // Borders
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
