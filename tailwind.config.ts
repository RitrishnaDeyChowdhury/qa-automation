import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E121B",
        panel: "#F7F4EE",
        mint: "#99D8C9",
        coral: "#FF7A5C",
        citrine: "#E8C84A",
        steel: "#5D7895"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(13, 18, 27, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
