import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        "border-subtle": "hsl(var(--border-subtle))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          raised: "hsl(var(--surface-raised))",
          sunken: "hsl(var(--surface-sunken))",
          overlay: "hsl(var(--surface-overlay))"
        },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        info: { DEFAULT: "hsl(var(--info))", foreground: "hsl(var(--info-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          muted: "hsl(var(--sidebar-muted))"
        },
        brand: {
          indigo: "hsl(243 80% 60%)",
          electric: "hsl(217 91% 60%)",
          violet: "hsl(262 85% 64%)"
        }
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-display)", "Sora", "var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
        xs: ["0.75rem", { lineHeight: "1.125rem", letterSpacing: "0.005em" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem", letterSpacing: "0" }],
        base: ["0.875rem", { lineHeight: "1.375rem", letterSpacing: "-0.003em" }],
        md: ["0.9375rem", { lineHeight: "1.5rem", letterSpacing: "-0.005em" }],
        lg: ["1.0625rem", { lineHeight: "1.625rem", letterSpacing: "-0.01em" }],
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.015em" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.02em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.025em" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.03em" }],
        "5xl": ["3rem", { lineHeight: "1.08", letterSpacing: "-0.035em" }],
        "6xl": ["3.75rem", { lineHeight: "1.05", letterSpacing: "-0.04em" }]
      },
      spacing: {
        "0.5": "0.125rem",
        "1.5": "0.375rem",
        "2.5": "0.625rem",
        "3.5": "0.875rem",
        "4.5": "1.125rem",
        "5.5": "1.375rem",
        "6.5": "1.625rem",
        "7.5": "1.875rem",
        "13": "3.25rem",
        "15": "3.75rem",
        "18": "4.5rem"
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "14px",
        "2xl": "18px",
        "3xl": "22px"
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(15 23 42 / 0.04)",
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        elevated: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 4px 12px -2px rgb(15 23 42 / 0.08)",
        lifted: "0 2px 4px 0 rgb(15 23 42 / 0.04), 0 8px 24px -4px rgb(15 23 42 / 0.12)",
        premium:
          "0 1px 0 0 rgb(255 255 255 / 0.7) inset, 0 1px 2px 0 rgb(15 23 42 / 0.05), 0 4px 12px -2px rgb(15 23 42 / 0.08)",
        "glow-indigo":
          "0 0 0 1px hsl(243 80% 60% / 0.25), 0 0 24px -4px hsl(243 80% 60% / 0.55)",
        "glow-violet":
          "0 0 0 1px hsl(262 85% 64% / 0.25), 0 0 24px -4px hsl(262 85% 64% / 0.55)",
        "ring-inset": "inset 0 0 0 1px hsl(var(--border-strong))"
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, hsl(var(--border) / 0.4) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.4) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(ellipse at top, hsl(var(--accent) / 0.08), transparent 60%)",
        "mesh-light":
          "radial-gradient(at 18% -10%, hsl(243 85% 65% / 0.12) 0px, transparent 50%), radial-gradient(at 82% -10%, hsl(217 91% 60% / 0.10) 0px, transparent 50%), radial-gradient(at 50% 110%, hsl(262 85% 64% / 0.10) 0px, transparent 50%)",
        "mesh-dark":
          "radial-gradient(at 18% -10%, hsl(243 90% 60% / 0.22) 0px, transparent 55%), radial-gradient(at 82% -10%, hsl(217 91% 55% / 0.16) 0px, transparent 55%), radial-gradient(at 50% 110%, hsl(262 85% 60% / 0.16) 0px, transparent 55%)"
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "fade-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" }
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" }
        },
        "spin-slow": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-up": "fade-up 280ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-down": "fade-down 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 2s linear infinite",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        "slide-in-right": "slide-in-right 240ms cubic-bezier(0.16, 1, 0.3, 1)"
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-back": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        snappy: "cubic-bezier(0.4, 0, 0.2, 1)"
      },
      transitionDuration: {
        "150": "150ms",
        "180": "180ms",
        "220": "220ms",
        "280": "280ms"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
