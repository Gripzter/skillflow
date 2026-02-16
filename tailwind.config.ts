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
        charcoal: "#0D0F14",
        card: "#151821",
        teal: "#00E5C7",
        purple: "#7C5CFC",
        "body-gray": "#A1A1AA",
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
        "teal-glow": "0 0 20px rgba(0, 229, 199, 0.3)",
        "teal-glow-lg": "0 0 30px rgba(0, 229, 199, 0.4)",
        "purple-glow": "0 0 20px rgba(124, 92, 252, 0.3)",
      },
      backgroundImage: {
        "gradient-teal-purple":
          "linear-gradient(135deg, #00E5C7 0%, #7C5CFC 100%)",
        "mesh-gradient":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 229, 199, 0.08), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(124, 92, 252, 0.06), transparent)",
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
