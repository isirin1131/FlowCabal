/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{html,js,svelte,ts}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        code: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Semantic colors using CSS variables
        bg: {
          deep: 'var(--bg-deep)',
          secondary: 'var(--bg-secondary)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          neural: 'var(--accent-neural)',
          'neural-dim': 'var(--accent-neural-dim)',
          error: 'var(--accent-error)',
          thinking: 'var(--accent-thinking)',
          warning: 'var(--accent-warning)',
          success: 'var(--accent-success)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          accent: 'var(--border-accent)',
          'accent-strong': 'var(--border-accent-strong)',
        },
        // Node state colors
        node: {
          'idle-bg': 'var(--node-idle-bg)',
          'idle-border': 'var(--node-idle-border)',
          'pending-bg': 'var(--node-pending-bg)',
          'pending-border': 'var(--node-pending-border)',
          'running-bg': 'var(--node-running-bg)',
          'running-border': 'var(--node-running-border)',
          'completed-bg': 'var(--node-completed-bg)',
          'completed-border': 'var(--node-completed-border)',
          'error-bg': 'var(--node-error-bg)',
          'error-border': 'var(--node-error-border)',
        },
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        neural: 'var(--shadow-neural)',
        'neural-strong': 'var(--shadow-neural-strong)',
        thinking: 'var(--shadow-thinking)',
        error: 'var(--shadow-error)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      spacing: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
        navbar: 'var(--navbar-height)',
        toolbar: 'var(--toolbar-height)',
      },
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        overlay: 'var(--z-overlay)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
        toast: 'var(--z-toast)',
        max: 'var(--z-max)',
      },
      animation: {
        'pulse-neural': 'pulse-neural 2s ease-in-out infinite',
        'pulse-thinking': 'pulse-thinking 1.5s ease-in-out infinite',
        'fade-in': 'fade-in 250ms ease-out',
        'slide-in-right': 'slide-in-right 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-in-up': 'slide-in-up 250ms ease-out',
        'scale-in': 'scale-in 150ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow-pulse 2s ease-in-out infinite',
        'data-flow': 'data-flow 1s linear infinite',
      },
      keyframes: {
        'pulse-neural': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: 'var(--shadow-neural)',
          },
          '50%': {
            opacity: '0.7',
            boxShadow: 'var(--shadow-neural-strong)',
          },
        },
        'pulse-thinking': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-up': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'glow-pulse': {
          '0%, 100%': { filter: 'drop-shadow(0 0 2px var(--accent-neural))' },
          '50%': { filter: 'drop-shadow(0 0 8px var(--accent-neural))' },
        },
        'data-flow': {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      transitionDuration: {
        instant: '50ms',
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
        slower: '600ms',
      },
      transitionTimingFunction: {
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
}
