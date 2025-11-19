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
        // Style guide colors
        app: "#020617",
        surface: "#0B1120",
        surfaceAlt: "#111827",
        subtle: "#1F2937",
        strong: "#374151",
        primary: "#E5E7EB",
        muted: "#9CA3AF",
        "text-subtle": "#6B7280",
        accent: {
          primary: "#F973B5",
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
    },
  },
  plugins: [],
};

export default config;
