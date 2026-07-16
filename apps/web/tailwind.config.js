/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "var(--font-space-grotesk)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        heading: [
          "var(--font-space-grotesk)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--font-bricolage)",
          "var(--font-space-grotesk)",
          "ui-sans-serif",
          "sans-serif",
        ],
        mono: [
          "var(--font-plex-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        ink: {
          0: "hsl(var(--ink-0) / <alpha-value>)",
          1: "hsl(var(--ink-1) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "hsl(var(--paper) / <alpha-value>)",
          dim: "hsl(var(--paper-dim) / <alpha-value>)",
        },
        mint: "hsl(var(--mint) / <alpha-value>)",
        gold: "hsl(var(--gold) / <alpha-value>)",
        "brand-blue": "hsl(var(--brand-blue) / <alpha-value>)",
        "brand-green": "hsl(var(--brand-green) / <alpha-value>)",
        "brand-purple": "hsl(var(--brand-purple) / <alpha-value>)",
        surface: {
          0: "hsl(var(--surface-0) / <alpha-value>)",
          1: "hsl(var(--surface-1) / <alpha-value>)",
          2: "hsl(var(--surface-2) / <alpha-value>)",
          3: "hsl(var(--surface-3) / <alpha-value>)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px) scale(1)" },
          "50%": { transform: "translateY(-20px) scale(1.03)" },
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(0px) scale(1)" },
          "50%": { transform: "translateY(-15px) scale(1.02)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 7s ease-in-out infinite",
        "float-delayed": "float-delayed 9s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
