/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // -- Luxury brand palette --------------------------------
        // Brass (primary) — replaces "gold" but kept aliased for back-compat
        brass: {
          DEFAULT: '#C9A961',   // dark-mode brass (warm)
          50:  '#FBF7EC',
          100: '#F4EBD2',
          200: '#E8D6A6',       // champagne
          300: '#DCC07B',
          400: '#D0AB55',
          500: '#C9A961',
          600: '#B59343',       // hover (dark)
          700: '#A88438',       // light-mode brass
          800: '#8C6C26',       // hover (light)
          900: '#6B521C',
          soft:  'rgba(201, 169, 97, 0.12)',
          glow:  'rgba(201, 169, 97, 0.32)',
        },
        champagne: '#E8D6A6',
        bronze: {
          DEFAULT: '#8E5530',
          light: '#B07849',
          dark:  '#6B3F20',
        },
        sage: {
          DEFAULT: '#7E8B7A',
          light:  '#A1AD9C',
          dark:   '#5A6657',
        },
        ivory:    '#F4ECDD',
        cream:    '#F7F2E8',
        espresso: '#1A1814',
        taupe:    '#5C5246',

        // Back-compat aliases (so existing classes like text-gold still work)
        gold: {
          DEFAULT: '#C9A961',
          hover:   '#B59343',
        },
        obsidian: '#0E0C09',
        charcoal: '#18150F',

        // -- shadcn semantic ----------------------------------
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        // Display serif (luxury editorial)
        fraunces: ['Fraunces', 'Cormorant Garamond', 'ui-serif', 'Georgia', 'serif'],
        playfair: ['Fraunces', 'Cormorant Garamond', 'ui-serif', 'Georgia', 'serif'], // alias for legacy
        serif:    ['Fraunces', 'Cormorant Garamond', 'ui-serif', 'Georgia', 'serif'],
        // Body sans
        manrope:  ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        sans:     ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Numeric / oversized labels
        bebas:    ['Bebas Neue', 'Oswald', 'sans-serif'],
      },
      letterSpacing: {
        'tightest': '-0.022em',
      },
      boxShadow: {
        'lux':      '0 24px 48px -28px rgba(0,0,0,0.45)',
        'lux-lg':   '0 32px 64px -28px rgba(0,0,0,0.55)',
        'brass':    '0 0 0 1px rgba(201,169,97,0.20), 0 10px 36px -10px rgba(201,169,97,0.32)',
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};
