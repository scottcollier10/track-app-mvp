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
        surface: "#1e293b",
        surfaceAlt: "#334155",
        subtle: "#475569",
        strong: "#64748b",
        primary: "#f1f5f9",
        muted: "#94a3b8",
        "text-subtle": "#64748b",
        accent: {
          primary: "#3B82F6",
          primarySoft: "#1e3a5f",
          secondary: "#22D3EE",
          secondarySoft: "#083344",
        },
        status: {
          info: "#38BDF8",
          success: "#10B981",
          warn: "#F59E0B",
          critical: "#EF4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
