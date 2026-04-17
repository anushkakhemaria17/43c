export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1e3a8a",
        accent: "#D4A95F",
        secondary: "#8C2F1B",
        bgDark: "#0a1128",
      },
      fontFamily: {
        heading: ["'Playfair Display'", "serif"],
        body: ["'Poppins'", "sans-serif"],
      }
    },
  },
  plugins: [],
}
