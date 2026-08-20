export const DS = {
  // Spacing (8-point grid -> adapted to user request: 4, 8, 12, 16, 24, 32, 48)
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  
  // Border Radius (Globally 12px)
  radius: {
    xs: 12,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    full: 9999,
  },
  
  // Typography Scale (32, 24, 20, 16, 14, 12)
  font: {
    h1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
    h2: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
    h3: { fontSize: 20, fontWeight: '600' as const },
    body: { fontSize: 16, fontWeight: '400' as const },
    bodyMedium: { fontSize: 14, fontWeight: '500' as const },
    bodySemiBold: { fontSize: 14, fontWeight: '600' as const },
    caption: { fontSize: 12, fontWeight: '500' as const },
    captionMuted: { fontSize: 12, fontWeight: '400' as const },
    label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
  },
  
  // Shadows (Modern SaaS: Use shadow-sm or none)
  shadow: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      // Re-mapped to sm for flat aesthetic
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    lg: {
      // Re-mapped to sm for flat aesthetic
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  
  // Semantic Colors
  colors: {
    brand: '#16A34A',         // Primary Green
    brandLight: '#DCFCE7',    // Light Green
    accent: '#15803D',        // Primary Hover Green
    success: '#16A34A',
    successBg: '#F0FDF4',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    
    // Neutrals
    text: '#111827',          // Primary Text
    textSecondary: '#6B7280', // Secondary Text
    textMuted: '#9CA3AF',
    border: '#E5E7EB',        // 1px Border Color
    borderLight: '#F3F4F6',
    surfaceBg: '#F8FAFC',     // Background
    cardBg: '#FFFFFF',        // Card
    
    // Sidebar
    sidebarBg: '#FFFFFF',
    sidebarActive: '#16A34A',
    sidebarActiveBg: '#F0FDF4',
    sidebarHover: '#F9FAFB',
    sidebarText: '#4B5563',
    sidebarTextActive: '#16A34A',
  }
};
