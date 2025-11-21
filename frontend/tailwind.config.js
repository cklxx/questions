/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#6b7fb8',
                    soft: '#8fa1cb',
                },
                accent: '#74b3b0',
                success: '#46b18f',
                warning: '#e8b166',
                error: '#e96d6d'
            },
            fontFamily: {
                sans: ['"Manrope"', 'system-ui', 'sans-serif'],
                mono: ['"Space Grotesk"', 'monospace'],
            }
        },
    },
    plugins: [],
};
