/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0B0F3A", // Navy Blue
        accent: "#D4A95F",  // Gold
        secondary: "#8C2F1B", // Dark Red
        bgDark: "#05071A",
      },
      fontFamily: {
        heading: ["'Playfair Display'", "serif"],
        body: ["'Poppins'", "sans-serif"],
      },
      backgroundImage: {
        'luxury-gradient': "linear-gradient(135deg, #0B0F3A 0%, #05071A 100%)",
      }
    },
  },
  plugins: [],
}
