/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        accent: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        violet: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        // "Navy Trust" admin palette (ported from the redesign)
        navy: {
          950: "#0a1230",
          900: "#0f1b3d",
          800: "#16234a",
          700: "#1e2d54",
          600: "#28345e",
          500: "#3a4770",
        },
        "admin-accent": {
          DEFAULT: "#3b6fa0",
          light: "#5a8bc0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        manrope: ["Manrope", "Inter", "system-ui", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "admin-card": "0 1px 3px 0 rgb(15 27 61 / 0.05)",
        "admin-elegant":
          "0 1px 2px 0 rgb(15 27 61 / 0.04), 0 8px 24px -8px rgb(15 27 61 / 0.10)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
