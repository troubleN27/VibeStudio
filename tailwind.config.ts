import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/bot/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f1ff",
          100: "#ebe5ff",
          200: "#d9cfff",
          300: "#bbabfd",
          400: "#9b82f8",
          500: "#7a5af8",
          600: "#6941e8",
          700: "#5a31c6",
          800: "#4a2a9f",
          900: "#3e2680",
          950: "#251553"
        },
        ink: {
          DEFAULT: "#0b0b12",
          50: "#f4f4f6",
          100: "#e7e7ec",
          200: "#cbccd6",
          300: "#a3a4b3",
          400: "#767889",
          500: "#545665",
          600: "#3c3e4c",
          700: "#2d2e3a",
          800: "#1c1d27",
          900: "#121219",
          950: "#0b0b12"
        },
        stone: {
          // Тёмная шкала: используется для поверхностей, границ и приглушённого текста
          50: "#16181f",
          100: "#20232b",
          200: "#2a2e38",
          300: "#4a4f5a",
          400: "#858b99",
          500: "#9aa0ad",
          600: "#c3c7d1",
          700: "#dcdee4",
          800: "#e8e9ee",
          900: "#f2f3f6",
          950: "#fafafc"
        }
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "Helvetica Neue",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,11,18,0.04), 0 6px 20px -6px rgba(11,11,18,0.06)",
        lift: "0 2px 8px rgba(11,11,18,0.05), 0 20px 44px -12px rgba(11,11,18,0.14)",
        glow: "0 0 0 1px rgba(105,65,232,0.10), 0 16px 48px -12px rgba(105,65,232,0.38)"
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" }
        }
      },
      animation: {
        "fade-in-up": "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        "scale-in": "scale-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;