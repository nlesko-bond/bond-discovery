/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
          colors: {
            // TOCA brand colors - extracted from tocafootball.com
            toca: {
              navy: '#1E2761',
              'navy-dark': '#151C4A',
              'navy-light': '#2A3578',
              purple: '#6366F1',
              'purple-light': '#A5B4FC',
              'purple-dark': '#4F46E5',
              violet: '#8B5CF6',
            },
            // Primary color aliases
            primary: {
              DEFAULT: '#1E2761',
              dark: '#151C4A',
              light: '#2A3578',
            },
            // Secondary/accent colors
            secondary: {
              DEFAULT: '#6366F1',
              light: '#A5B4FC',
              dark: '#4F46E5',
            },
            // Bond onboarding checklist (public /onboard pages)
            bond: {
              bg: '#f7f7f5',
              text: '#2c2c2a',
              border: '#e0dfd8',
              /** Primary Bond brand blue (kicker, step pills, primary actions) */
              brand: '#0d4774',
              'brand-light': '#e8eef4',
              /** Gold accent (highlights, %, focus) */
              accent: '#f7b500',
              'accent-muted': '#fef6e0',
              green: '#22c55e',
              'green-dark': '#16a34a',
              'green-light': '#86efac',
              'green-bg': '#f0fdf4',
              /** @deprecated prefer bond-brand / bond-accent */
              orange: '#eb6d4a',
              blue: '#0d4774',
              'blue-bg': '#e8eef4',
              muted: '#888888',
              'muted-dark': '#555555',
              'note-bg': '#fffbeb',
              'note-border': '#fbbf24',
              'note-text': '#78350f',
              'optional-bg': '#fef9c3',
              'optional-text': '#a16207',
              'badge-bg': '#f3f2ee',
              'badge-text': '#7a7a75',
            },
          },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
