/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        priority: {
          critical: '#ef4444',
          high: '#f97316',
          medium: '#3b82f6',
          low: '#6b7280',
        },
        status: {
          backlog: '#6b7280',
          queued: '#eab308',
          running: '#3b82f6',
          done: '#22c55e',
          failed: '#ef4444',
          cancelled: '#9ca3af',
        },
      },
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
        heading: ['Manrope', 'system-ui', 'sans-serif'],
        body: ['Karla', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
