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
        // Legacy track colors
        track: {
          green: "rgb(51, 204, 102)",
          red: "rgb(230, 51, 51)",
          yellow: "rgb(255, 204, 0)",
          blue: "rgb(51, 153, 255)",
        },
        // Winster Hub Design System - Background layers
        background: {
          darkest: "#0a0b0f",
          sidebar: "#13141a",
          card: "#1a1b23",
          elevated: "#252633",
        },
        // Winster Hub Design System - Primary blue
        blue: {
          default: "#5b8af5",
          dark: "#4a7af7",
          light: "#6b9aff",
        },
        // Winster Hub Design System - Success green
        green: {
          default: "#14e092",
          dark: "#10b981",
        },
        // Winster Hub Design System - Error red
        red: {
          default: "#ef4444",
          dark: "#dc2626",
        },
        // Winster Hub Design System - Text colors
        text: {
          primary: "#ffffff",
          secondary: "#9ca3af",
          muted: "#6b7280",
        },
        // Legacy style guide colors (kept for backward compatibility)
        app: "#020617",
        surface: "#0B1120",
        surfaceAlt: "#111827",
        subtle: "#1F2937",
        strong: "#374151",
        primary: "#E5E7EB",
        muted: "#9CA3AF",
        "text-subtle": "#6B7280",
        accent: {
          primary: "#fe6748",
          primarySoft: "#3B1024",
          secondary: "#22D3EE",
          secondarySoft: "#083344",
        },
        status: {
          info: "#38BDF8",
          success: "#22C55E",
          warn: "#FACC15",
          critical: "#FB7185",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
