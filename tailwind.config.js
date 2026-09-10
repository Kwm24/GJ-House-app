/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          // Uses a CSS custom property so the accent can be changed from Settings
          // without a rebuild.  Default: --c-accent: 192 57 43  (#C0392B)
          red: "rgb(var(--c-accent) / <alpha-value>)",
          dark: "#1C1C1E",
          cream: "#F5F0E8",
          sand: "#EDE7D9",
        },
      },
    },
  },
  plugins: [],
}
