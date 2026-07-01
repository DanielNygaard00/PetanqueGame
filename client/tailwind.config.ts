import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        terracotta: "#C65D3B",
        olive: "#6B7A4F",
        cream: "#F5EFE1",
        ink: "#2B2622",
        steel: "#8A8D91",
        bordeaux: "#7B2D3B",
        gold: "#D9A441",
      },
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 2px 12px rgba(43, 38, 34, 0.08)" },
      borderRadius: { card: "14px" },
    },
  },
  plugins: [],
} satisfies Config;

