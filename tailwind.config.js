/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Warna, font, dan sudut dibaca dari variabel CSS (src/index.css) supaya Admin dapat berganti tema (data-tema pada <html>): Siaga atau asli (cokelat-emas).
      // Nama token 'pramuka' dan 'emas' dipertahankan dari tema asli; isinya mengikuti tema yang aktif.
      colors: {
        pramuka: {
          50: 'rgb(var(--pramuka-50) / <alpha-value>)',
          100: 'rgb(var(--pramuka-100) / <alpha-value>)',
          200: 'rgb(var(--pramuka-200) / <alpha-value>)',
          300: 'rgb(var(--pramuka-300) / <alpha-value>)',
          400: 'rgb(var(--pramuka-400) / <alpha-value>)',
          500: 'rgb(var(--pramuka-500) / <alpha-value>)',
          600: 'rgb(var(--pramuka-600) / <alpha-value>)',
          700: 'rgb(var(--pramuka-700) / <alpha-value>)',
          800: 'rgb(var(--pramuka-800) / <alpha-value>)',
          900: 'rgb(var(--pramuka-900) / <alpha-value>)',
        },
        emas: {
          DEFAULT: 'rgb(var(--emas) / <alpha-value>)',
          light: 'rgb(var(--emas-light) / <alpha-value>)',
          dark: 'rgb(var(--emas-dark) / <alpha-value>)',
        },
        hasduk: {
          DEFAULT: 'rgb(var(--hasduk) / <alpha-value>)',
          light: 'rgb(var(--hasduk-light) / <alpha-value>)',
          dark: 'rgb(var(--hasduk-dark) / <alpha-value>)',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--r)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        sans: 'var(--font-sans)',
      },
    },
  },
  plugins: [],
};
