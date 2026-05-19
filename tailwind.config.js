/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ct-red': '#c0392b',
        'ct-orange': '#e67e22',
        'ct-blue': '#2980b9',
        'ct-green': '#27ae60',
      },
    },
  },
  plugins: [],
}
