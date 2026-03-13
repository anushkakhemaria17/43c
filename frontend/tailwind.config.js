export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0B0F3A",
        accent: "#D4A95F",
        secondary: "#8C2F1B",
        bgDark: "#05071A",
      },
      fontFamily: {
        heading: ["'Playfair Display'", "serif"],
        body: ["'Poppins'", "sans-serif"],
      }
    },
  },
  plugins: [],
}
