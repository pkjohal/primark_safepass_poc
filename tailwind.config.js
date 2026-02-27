/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primark: {
          blue: '#0DAADB',
          'blue-dark': '#0987A8',
          'blue-light': '#E6F7FB',
        },
        navy: '#1A1F36',
        charcoal: '#374151',
        'mid-grey': '#6B7280',
        'light-grey': '#F3F4F6',
        'border-grey': '#E5E7EB',
        success: { DEFAULT: '#10B981', bg: '#ECFDF5' },
        warning: { DEFAULT: '#F59E0B', bg: '#FFFBEB' },
        danger: { DEFAULT: '#EF4444', bg: '#FEF2F2' },
        'alert-red': { DEFAULT: '#DC2626', dark: '#991B1B' },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        btn: '48px',
        'btn-primary': '52px',
        input: '44px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
