/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        border: "borderRotate 4s linear infinite",
      },
      keyframes: {
        borderRotate: {
          to: { "--border-angle": "360deg" },
        },
      },
    },
  },
  plugins: [],
};
