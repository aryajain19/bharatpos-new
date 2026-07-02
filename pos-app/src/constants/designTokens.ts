export const DS = {
  // Spacing (8-point grid)
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Border Radius
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  
  // Typography Scale
  font: {
    h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
    h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
    h3: { fontSize: 17, fontWeight: '600' as const },
    body: { fontSize: 14, fontWeight: '400' as const },
    bodyMedium: { fontSize: 14, fontWeight: '500' as const },
    bodySemiBold: { fontSize: 14, fontWeight: '600' as const },
    caption: { fontSize: 12, fontWeight: '500' as const },
    captionMuted: { fontSize: 12, fontWeight: '400' as const },
    label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
  },
  
  // Shadows (Standard elevation/box shadows)
  shadow: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  
  // Semantic Colors
  colors: {
    brand: '#1E3A8A',         // Deep Blue (primary brand)
    brandLight: '#DBEAFE',
    accent: '#3B82F6',        // Bright Blue (CTAs)
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    
    // Neutrals
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',       // Standard border color
    borderLight: '#F1F5F9',
    surfaceBg: '#F8FAFC',    // Page background
    cardBg: '#FFFFFF',       // Card background
    
    // Sidebar
    sidebarBg: '#FAFBFD',
    sidebarActive: '#1E3A8A',
    sidebarActiveBg: 'rgba(30, 58, 138, 0.08)',
    sidebarHover: '#F1F5F9',
    sidebarText: '#475569',
    sidebarTextActive: '#1E3A8A',
  }
};
