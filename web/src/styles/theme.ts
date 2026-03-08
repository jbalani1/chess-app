// Chess.com inspired design tokens
// These are exported for use in JS/TS components when needed

export const theme = {
  colors: {
    // Background colors
    bg: {
      primary: '#262421',      // Main background
      secondary: '#1D1C1A',    // Sidebar background
      tertiary: '#302E2B',     // Card background
      hover: '#3D3A36',        // Card hover state
      elevated: '#3D3A36',     // Elevated elements
    },

    // Accent colors
    accent: {
      primary: '#81B64C',      // Chess.com green
      primaryHover: '#9BC962',
      secondary: '#F5A623',    // Orange
      tertiary: '#5D9BEC',     // Blue for links
    },

    // Text colors
    text: {
      primary: '#FFFFFF',
      secondary: '#9E9E9E',
      muted: '#6B6B6B',
      inverse: '#262421',
    },

    // Move classification colors (Chess.com style)
    classification: {
      brilliant: '#1BACA6',    // Teal
      great: '#5C8BB0',        // Blue
      best: '#9BC962',         // Light green
      excellent: '#81B64C',    // Green
      good: '#81B64C',         // Green
      book: '#A67C52',         // Brown
      inaccuracy: '#F5A623',   // Yellow/Orange
      mistake: '#E69D00',      // Orange
      miss: '#E69D00',         // Orange
      blunder: '#CA3431',      // Red
    },

    // Board colors
    board: {
      light: '#EEEED2',
      dark: '#769656',
      highlight: 'rgba(255, 255, 0, 0.5)',
    },

    // UI colors
    border: '#3D3A36',
    divider: '#3D3A36',
  },

  // Spacing
  spacing: {
    sidebar: '220px',
    sidebarCollapsed: '64px',
  },

  // Border radius
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },

  // Shadows
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.3)',
  },
} as const

// Type exports
export type Theme = typeof theme
export type ThemeColors = typeof theme.colors
