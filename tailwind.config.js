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
          red: "#C0392B",
          dark: "#1C1C1E",
          cream: "#F5F0E8",
          sand: "#EDE7D9",
        },
      },
    },
  },
  plugins: [],
}
