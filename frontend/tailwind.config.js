/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      colors: {
        background: {
          dark: '#000000',
          light: '#ffffff',
        },
        surface: {
          dark: '#0a0a0a',
          darkCard: '#0f0f0f',
          darkHover: '#171717',
          darkBorder: '#1f1f1f',
          darkSubtle: '#141414',
          light: '#ffffff',
          lightCard: '#ffffff',
          lightHover: '#f5f5f5',
          lightBorder: '#e5e5e5',
          lightSubtle: '#fafafa',
        },
        brand: {
          50: '#f5f5f5',
          100: '#e5e5e5',
          500: '#ffffff',
          600: '#000000',
          700: '#171717',
        }
      }
    },
  },
  plugins: [],
}
