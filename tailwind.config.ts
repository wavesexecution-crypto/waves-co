import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0A1F44",
          dark: "#06142E",
          light: "#163261",
        },
        accent: {
          DEFAULT: "#00C2D1",
          hover: "#00A0AD",
        },
        paper: "#F7F9FB",
        surface: "#E8EAED",
        line: "#D1D5DB",
        body: "#4A5568",
        muted: "#94A3B8",
        success: "#27AE60",
        error: "#E74C3C",
      },
      fontFamily: {
        heading: ["General Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      boxShadow: {
        precise: "0 24px 70px rgba(6, 20, 46, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
