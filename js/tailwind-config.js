// ============================================
// POTS — Shared Tailwind CSS Configuration
// Terra Design System color tokens
// ============================================

tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#4a7c59",
                "on-primary": "#ffffff",
                "primary-container": "#78a886",
                "on-primary-container": "#d8f0de",
                "primary-fixed": "#c8e8d0",
                "primary-fixed-dim": "#8ecf9e",
                "on-primary-fixed": "#002110",
                "on-primary-fixed-variant": "#2a6038",
                "secondary": "#6b6358",
                "on-secondary": "#ffffff",
                "secondary-container": "#f0e8db",
                "on-secondary-container": "#5e5548",
                "secondary-fixed": "#f0e8db",
                "secondary-fixed-dim": "#d4ccbf",
                "on-secondary-fixed": "#1e1a13",
                "on-secondary-fixed-variant": "#4a4538",
                "tertiary": "#705c30",
                "on-tertiary": "#ffffff",
                "tertiary-container": "#c4a66a",
                "on-tertiary-container": "#554020",
                "tertiary-fixed": "#f8e0a8",
                "tertiary-fixed-dim": "#dcc48e",
                "on-tertiary-fixed": "#221a05",
                "on-tertiary-fixed-variant": "#554020",
                "error": "#b83230",
                "on-error": "#ffffff",
                "error-container": "#ffdad8",
                "on-error-container": "#690005",
                "background": "#faf6f0",
                "on-background": "#2e3230",
                "surface": "#faf6f0",
                "on-surface": "#2e3230",
                "surface-variant": "#e4e0d8",
                "on-surface-variant": "#4a4e4a",
                "surface-dim": "#dbd7cf",
                "surface-bright": "#faf6f0",
                "surface-container-lowest": "#ffffff",
                "surface-container-low": "#f5f1ea",
                "surface-container": "#f0ece4",
                "surface-container-high": "#eae6de",
                "surface-container-highest": "#e4e0d8",
                "surface-tint": "#4a7c59",
                "outline": "#74796e",
                "outline-variant": "#c4c8bc",
                "inverse-surface": "#2e3230",
                "inverse-on-surface": "#f5f0e8",
                "inverse-primary": "#8ecf9e"
            },
            borderRadius: {
                "DEFAULT": "0.5rem",
                "lg": "1rem",
                "xl": "1.5rem",
                "full": "9999px"
            },
            fontFamily: {
                "headline": ["Literata", "serif"],
                "display": ["Literata", "serif"],
                "body": ["Nunito Sans", "sans-serif"],
                "label": ["Nunito Sans", "sans-serif"]
            }
        }
    }
};
