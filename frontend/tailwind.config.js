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
          dark: '#0a0c10',
          light: '#f8fafc',
        },
        surface: {
          dark: '#11141c',
          darkCard: '#131620',
          darkHover: '#181c28',
          darkBorder: '#212636',
          darkSubtle: '#1b202e',
          light: '#ffffff',
          lightCard: '#ffffff',
          lightHover: '#f1f5f9',
          lightBorder: '#e2e8f0',
          lightSubtle: '#f8fafc',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [],
}
