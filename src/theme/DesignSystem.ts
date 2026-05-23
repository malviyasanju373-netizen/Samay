import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const fontScale  = Math.min(Math.max(SCREEN_WIDTH / 390, 0.9),  1.35);
const spaceScale = Math.min(Math.max(SCREEN_WIDTH / 390, 0.95), 1.2);

const fs = (n: number) => Math.round(n * fontScale);
const sp = (n: number) => Math.round(n * spaceScale);

export const DesignSystem = {
  colors: {
    dark: {
      background: '#0F1115',
      surface: '#1A1D24',
      card: '#1A1D24',
      elevated: '#20242D',
      text: '#FFFFFF',
      textSecondary: '#B0B7C3',
      textTertiary: '#4A4F55',
      textInverse: '#000000',
      border: '#2F3336',
      divider: '#2F3336',
      primary: '#38BDF8',
      primaryLight: '#0EA5E9',
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#38BDF8',
      accent1: '#2DD4BF',
      accent2: '#A78BFA',
      accent3: '#F472B6',
      accent4: '#14B8A6',
      accent5: '#FBBF24',
      accent6: '#60A5FA',
      // Focus timer specific
      timerRing: '#38BDF8',
      timerRingBg: '#2F3336',
      timerActive: '#22C55E',
      timerPaused: '#F59E0B',
      streak: '#F97316',
    },
    light: {
      background: '#F5F7FA',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      elevated: '#FFFFFF',
      text: '#111111',
      textSecondary: '#555555',
      textTertiary: '#9CA3AF',
      textInverse: '#FFFFFF',
      border: '#E5E7EB',
      divider: '#F3F4F6',
      primary: '#38BDF8',
      primaryLight: '#0EA5E9',
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#38BDF8',
      accent1: '#2DD4BF',
      accent2: '#8B5CF6',
      accent3: '#EC4899',
      accent4: '#14B8A6',
      accent5: '#F59E0B',
      accent6: '#3B82F6',
      // Focus timer specific
      timerRing: '#38BDF8',
      timerRingBg: '#E5E7EB',
      timerActive: '#22C55E',
      timerPaused: '#F59E0B',
      streak: '#F97316',
    },
  },

  spacing: {
    xs:    sp(4),
    sm:    sp(8),
    md:    sp(12),
    lg:    sp(16),
    xl:    sp(20),
    '2xl': sp(24),
    '3xl': sp(32),
    '4xl': sp(48),
  },

  typography: {
    fontSize: {
      xs:    fs(10),
      sm:    fs(12),
      base:  fs(14),
      md:    fs(16),
      lg:    fs(18),
      xl:    fs(22),
      '2xl': fs(26),
      '3xl': fs(32),
      '4xl': fs(40),
    },
    fontWeight: {
      regular:  '400' as const,
      medium:   '500' as const,
      semibold: '600' as const,
      bold:     '700' as const,
    },
    letterSpacing: {
      tight:  -0.5,
      normal: 0,
      wide:   0.3,
      wider:  1,
    },
  },

  radius: {
    xs: sp(4),
    sm: sp(8),
    md: sp(12),
    lg: sp(16),
    xl: sp(20),
    full: 999,
  },

  shadows: {
    none: {
      elevation: 0, shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0,
    },
    sm: {
      elevation: 2, shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3,
    },
    md: {
      elevation: 4, shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 6,
    },
    lg: {
      elevation: 8, shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 12,
    },
  },

  // animation: {
  //   duration: { fast: 150, normal: 250, slow: 400 },
  //   scale: { pressIn: 0.96, pressOut: 1 },
  // },

  components: {
    card: { padding: sp(14), borderRadius: sp(12), gap: sp(10) },
    button: { height: sp(48), borderRadius: sp(12), paddingHorizontal: sp(20) },
    input: { height: sp(48), borderRadius: sp(12), paddingHorizontal: sp(16) },
    icon: { sm: sp(16), md: sp(20), lg: sp(24) },
    tabBar: { height: sp(64), bottomOffset: sp(12) },
    timerRing: { size: sp(240), strokeWidth: sp(14) },
  },

  layout: {
    screenPadding: sp(20),
    headerHeight: sp(56),
  },
};

export function getThemeColors(isDark: boolean) {
  return isDark ? DesignSystem.colors.dark : DesignSystem.colors.light;
}

export function getCategoryColor(index: number, isDark: boolean) {
  const c = getThemeColors(isDark);
  return [c.accent1, c.accent2, c.accent3, c.accent4, c.accent5, c.accent6][index % 6];
}
