/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FACC15',
        'primary-dark': '#EAB308',
        income: '#22C55E',
        expense: '#EF4444',
        transfer: '#3B82F6',
      },
    },
  },
  plugins: [],
}
