/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
        green: "var(--green)",
        red: "var(--red)",
        amber: "var(--amber)",
        blue: "var(--blue)",
        chartGrid: "var(--chart-grid)",
      },
      boxShadow: {
        signal: "0 0 0 1px rgba(255,255,255,0.02), 0 0 40px rgba(41,121,255,0.08)",
      },
      animation: {
        "signal-pulse": "signal-pulse 3s ease-in-out infinite",
        "status-bar": "status-bar 1.6s ease-in-out infinite",
      },
      keyframes: {
        "signal-pulse": {
          "0%, 100%": { opacity: "0.88", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
        "status-bar": {
          "0%, 100%": { opacity: "0.5", transform: "translateX(0)" },
          "50%": { opacity: "1", transform: "translateX(2px)" },
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
