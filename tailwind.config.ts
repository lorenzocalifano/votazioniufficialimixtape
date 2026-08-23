import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#07060d",
        panel: "#0e0d18",
        cyan: "#2de2e6",
        magenta: "#ff3ea5",
        acid: "#b4ff39",
        gold: "#ffd23e",
        violet: "#7b2fff",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        hero: ["var(--font-hero)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(45,226,230,0.45), 0 0 60px rgba(255,62,165,0.25)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
