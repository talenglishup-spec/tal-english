/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        landingBlack: '#0A0E1A',
        landingNavy: '#0D1B2A',
        landingNavy2: '#1B2B4B',
        landingGreen: '#00E676',
        landingGreenDim: 'rgba(0, 230, 118, 0.12)',
        landingBlue: '#2979FF',
        landingBlueDim: 'rgba(41, 121, 255, 0.12)',
        landingGold: '#FFD600',
        landingRed: '#FF3D00',
        landingGray: '#B0BEC5',
        landingDim: '#546E7A',
        landingCardBg: '#0F1E30',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

