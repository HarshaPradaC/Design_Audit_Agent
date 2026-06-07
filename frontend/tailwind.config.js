export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Surface layers (warm graphite, NOT pure black) ─────────────────
        surface: {
          0: '#0f0f0d',   // page background
          1: '#161513',   // sidebar, card
          2: '#1d1c1a',   // elevated card
          3: '#242321',   // overlay, highest elevation
          4: '#2c2b28',   // tooltip, popover
        },
        // ── Text ──────────────────────────────────────────────────────────
        ink: {
          1: '#f0ede8',   // primary — warm white, never pure
          2: '#a09d97',   // secondary
          3: '#5e5c58',   // tertiary / placeholder
        },
        // ── Borders ───────────────────────────────────────────────────────
        edge: {
          1: '#201f1d',   // subtlest
          2: '#2c2b28',   // default card border
          3: '#3a3835',   // prominent / focused
        },
        // ── Accent (used sparingly — primary CTA only) ────────────────────
        accent: {
          DEFAULT: '#7c6af6',   // muted violet — communicates intelligence
          dim:     '#6b5ae0',   // hover
          glow:    '#7c6af610', // ambient bg tint
        },
        // ── Semantic severity (muted, elegant — not garish) ───────────────
        sev: {
          critical: '#c44444',
          high:     '#c2601a',
          medium:   '#a08210',
          low:      '#3a70b8',
          info:     '#5e5c58',
          success:  '#2d8f52',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
        'xs':  ['11px', { lineHeight: '16px' }],
        'sm':  ['13px', { lineHeight: '20px' }],
        'base':['14px', { lineHeight: '22px' }],
        'md':  ['15px', { lineHeight: '24px' }],
        'lg':  ['16px', { lineHeight: '24px' }],
        'xl':  ['18px', { lineHeight: '28px' }],
        '2xl': ['22px', { lineHeight: '30px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
      },
      letterSpacing: {
        widest: '0.12em',
      },
      borderRadius: {
        'xs':  '4px',
        'sm':  '6px',
        DEFAULT: '8px',
        'md':  '10px',
        'lg':  '12px',
        'xl':  '16px',
      },
      boxShadow: {
        'card':     '0 1px 4px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)',
        'elevated': '0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)',
        'inset-top':'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
}
