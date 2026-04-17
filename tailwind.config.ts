import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core app surfaces
        charcoal: "#0E0E12", // primary background
        card: "#1A1A22", // surface/card background
        border: "#2A2A38",
        "body-gray": "#7A7A8E",
        "body": "#C8C8D4",
        "primary-text": "#F0F0F4",

        // Accents
        teal: "#FF5E00", // real-money accent (legacy name kept for class compatibility)
        purple: "#A855F7", // practice accent (legacy name kept for class compatibility)
        "teal-hover": "#FF7A2E",
        "purple-hover": "#C084FC",

        // Atmospheric steel blue
        "steel-blue": "#2A3A5C",
        "steel-blue-bright": "#3A4F7A",

        // Admin dashboard (distinct from player site)
        "admin-bg": "#0A0B0F",
        "admin-card": "#12131A",
        "admin-accent": "#FF5E00",
        "admin-pink": "#EC4899",
        "admin-success": "#22C55E",
        "admin-warning": "#F59E0B",
        "admin-danger": "#EF4444",
        "admin-body": "#9CA3AF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        // Atmospheric steel blue glows (non-interactive ambience)
        "teal-glow": "0 0 20px rgba(42, 58, 92, 0.4)",
        "teal-glow-lg": "0 0 30px rgba(42, 58, 92, 0.6)",
        // Practice purple glow (kept for practice elements)
        "purple-glow": "0 0 20px rgba(168, 85, 247, 0.3)",
      },
      backgroundImage: {
        "gradient-teal-purple":
          "linear-gradient(135deg, #FF5E00 0%, #FF7A2E 100%)",
        "mesh-gradient":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(42, 58, 92, 0.15), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(42, 58, 92, 0.12), transparent)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "velocity-stripe": "velocity-stripe 0.8s ease-in-out infinite",
        "velocity-logo-pulse": "velocity-logo-pulse 1.3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "velocity-stripe": {
          "0%": {
            transform: "rotate(-55deg) translate3d(135vw, 135vh, 0)",
            opacity: "0",
          },
          "16%": { opacity: "1" },
          "82%": { opacity: "1" },
          "100%": {
            transform: "rotate(-55deg) translate3d(-135vw, -135vh, 0)",
            opacity: "0",
          },
        },
        "velocity-logo-pulse": {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "0.72", transform: "scale(1.02)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
