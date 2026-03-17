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

        // Admin dashboard (distinct from player site)
        "admin-bg": "#0A0B0F",
        "admin-card": "#12131A",
        "admin-accent": "#6366F1",
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
        // Real-money orange glow
        "teal-glow": "0 0 20px rgba(255, 94, 0, 0.3)",
        "teal-glow-lg": "0 0 30px rgba(255, 94, 0, 0.4)",
        // Practice purple glow
        "purple-glow": "0 0 20px rgba(168, 85, 247, 0.3)",
      },
      backgroundImage: {
        "gradient-teal-purple":
          "linear-gradient(135deg, #FF5E00 0%, #FF7A2E 100%)",
        "mesh-gradient":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255, 94, 0, 0.06), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(168, 85, 247, 0.05), transparent)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
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
      },
    },
  },
  plugins: [],
};

export default config;
