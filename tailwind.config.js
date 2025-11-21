/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        dark: {
          "primary": "#48a77f",
          "primary-content": "#ffffff",
          "secondary": "#3d9166",
          "secondary-content": "#ffffff",
          "accent": "#48a77f",
          "accent-content": "#ffffff",
          "neutral": "#1E1E1E",
          "neutral-content": "#EDEDED",
          "base-100": "#0B0C0E",
          "base-200": "#151719",
          "base-300": "#2C2C2C",
          "base-content": "#EDEDED",
          "info": "#48a77f",
          "info-content": "#ffffff",
          "success": "#22C55E",
          "success-content": "#ffffff",
          "warning": "#FACC15",
          "warning-content": "#000000",
          "error": "#EF4444",
          "error-content": "#ffffff",
        },
      },
    ],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
};
