/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teja: {
          cyan: '#00f0ff',
          blue: '#0088ff',
          purple: '#8844ff',
          dark: '#0a0a1a',
          panel: 'rgba(15, 15, 35, 0.85)',
          glow: 'rgba(0, 240, 255, 0.6)',
        }
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite',
        'spin-reverse': 'spin-reverse 15s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        glow: {
          from: { boxShadow: '0 0 20px rgba(0, 240, 255, 0.3), 0 0 40px rgba(0, 240, 255, 0.1)' },
          to: { boxShadow: '0 0 30px rgba(0, 240, 255, 0.6), 0 0 60px rgba(0, 240, 255, 0.3)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.08)', opacity: '1' },
        }
      },
      boxShadow: {
        'orb': '0 0 40px rgba(0, 240, 255, 0.4), 0 0 80px rgba(0, 136, 255, 0.2)',
        'orb-glow': '0 0 60px rgba(0, 240, 255, 0.7), 0 0 120px rgba(0, 136, 255, 0.4)',
      },
    },
  },
  plugins: [],
}
