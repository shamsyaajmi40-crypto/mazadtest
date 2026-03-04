/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./{components,pages}/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Tajawal', 'sans-serif'],
            },
            colors: {
                primary: {
                    DEFAULT: '#2563eb', // Modern Blue
                    dark: '#1d4ed8',
                    light: '#60a5fa',
                },
                secondary: {
                    DEFAULT: '#8b5cf6', // Modern Violet
                    dark: '#7c3aed',
                },
                accent: '#f59e0b',
                surface: '#ffffff',
                background: '#f8fafc',
            }
        },
    },
    plugins: [],
}
