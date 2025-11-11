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
        track: {
          green: "rgb(51, 204, 102)",
          red: "rgb(230, 51, 51)",
          yellow: "rgb(255, 204, 0)",
          blue: "rgb(51, 153, 255)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
