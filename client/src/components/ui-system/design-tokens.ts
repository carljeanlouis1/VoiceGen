/**
 * Apple-inspired design system tokens
 * These tokens define the core visual language for the application
 */

export const COLORS = {
  // Primary and accent colors
  primary: '#0A84FF',        // iOS blue
  secondary: '#30D158',      // iOS green
  accent: '#FF453A',         // iOS red
  
  // Dark theme background variations
  backgroundPrimary: '#000000',
  backgroundSecondary: '#1C1C1E',
  backgroundTertiary: '#2C2C2E',
  
  // Surface and card colors
  surfacePrimary: 'rgba(28, 28, 30, 0.6)',
  surfaceSecondary: 'rgba(44, 44, 46, 0.5)',
  surfaceElevated: 'rgba(56, 56, 58, 0.5)',
  
  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.9)',  // Increased from 0.8 for better contrast
  textTertiary: 'rgba(255, 255, 255, 0.8)',   // Increased from 0.6 for better contrast
  textMuted: 'rgba(255, 255, 255, 0.6)',      // Increased from 0.4 for better contrast
  
  // States
  success: '#30D158',
  warning: '#FFD60A',
  error: '#FF453A',
  info: '#0A84FF',
  
  // Gradient definitions
  gradients: {
    primary: 'from-[#0A84FF] to-[#30D158]',
    accent: 'from-[#FF453A] to-[#FF9F0A]',
    background: 'from-zinc-900 via-zinc-800 to-black'
  }
};

// Spacing system (following 8-point grid)
export const SPACING = {
  0: '0px',
  1: '4px',   // Quarter spacing
  2: '8px',   // Base spacing
  3: '12px',
  4: '16px',  // 2x base
  5: '20px', 
  6: '24px',  // 3x base
  7: '28px',
  8: '32px',  // 4x base
  9: '36px',
  10: '40px', // 5x base
  12: '48px', // 6x base
  16: '64px', // 8x base
  20: '80px', // 10x base
  24: '96px', // 12x base
  32: '128px' // 16x base
};

// Border radius
export const RADIUS = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px'
};

// Transition speeds
export const TRANSITIONS = {
  fast: 'all 0.15s ease',
  medium: 'all 0.3s ease',
  slow: 'all 0.5s ease'
};

// Z-index scale
export const Z_INDEX = {
  behind: -1,
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  tooltip: 700
};

// Shadow definitions (blur-based for modern look)
export const SHADOWS = {
  sm: 'shadow-sm backdrop-blur-sm',
  md: 'shadow-md backdrop-blur',
  lg: 'shadow-lg backdrop-blur-md',
  xl: 'shadow-xl backdrop-blur-lg'
};

// Typography scale
export const TYPOGRAPHY = {
  fontFamily: {
    // SF Pro is Apple's system font, we fallback to system fonts
    display: 'SF Pro Display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    body: 'SF Pro Text, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    mono: 'SF Mono, ui-monospace, SFMono-Regular, monospace'
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem', // 60px
    '7xl': '4.5rem'   // 72px
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },
  lineHeight: {
    none: '1',
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.75',
    loose: '2'
  }
};

/**
 * CSS helper for converting design tokens to Tailwind classes
 * Usage example: 
 * className={tw('bg-zinc-900 text-white', {
 *   'text-red-500': isError
 * })}
 */
export function tw(...inputs: (string | Record<string, boolean>)[]) {
  const classes: string[] = [];
  
  inputs.forEach(input => {
    if (typeof input === 'string') {
      classes.push(input);
    } else {
      Object.entries(input).forEach(([className, condition]) => {
        if (condition) {
          classes.push(className);
        }
      });
    }
  });
  
  return classes.join(' ');
}