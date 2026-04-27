import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 24px 80px rgba(45, 212, 191, 0.16)"
      }
    }
  },
  plugins: []
} satisfies Config;
