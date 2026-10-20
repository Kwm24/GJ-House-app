/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["General Sans", "Inter", "sans-serif"],
        sans: ["DM Sans", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        brand: {
          red: "rgb(var(--c-accent) / <alpha-value>)",
          dark: "#1C1C1E",
          cream: "#F5F0E8",
          sand: "#EDE7D9",
        },
        genesis: {
          primary:  "#6366F1",
          "primary-h": "#4F46E5",
          bg:       "#FAFAFA",
          surface:  "#FFFFFF",
          text1:    "#0A0A0A",
          text2:    "#6B6B6B",
          muted:    "#9C9C9C",
          border:   "#E8E8EC",
          success:  "#10B981",
          warning:  "#F59E0B",
          error:    "#EF4444",
        },
      },
      boxShadow: {
        "card-hover": "0 8px 30px rgba(0,0,0,0.08)",
        "btn-primary": "0 4px 12px rgba(99,102,241,0.35)",
      },
    },
  },
  plugins: [],
}
