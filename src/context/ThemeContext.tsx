import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DesignSystem, getThemeColors } from '@/theme/DesignSystem';

type ThemeMode = 'light' | 'dark' | 'system';

type Theme = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ReturnType<typeof getThemeColors>;
  spacing: typeof DesignSystem.spacing;
  typography: typeof DesignSystem.typography;
  radius: typeof DesignSystem.radius;
  shadows: typeof DesignSystem.shadows;
  components: typeof DesignSystem.components;
  animation: typeof DesignSystem.animation;
  layout: typeof DesignSystem.layout;
};

type ThemeContextType = {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem('themeMode').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeModeState(saved as ThemeMode);
      }
    }).catch(() => {});
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    try { await AsyncStorage.setItem('themeMode', mode); } catch {}
    setThemeModeState(mode);
  };

  const isDark = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';

  const theme: Theme = {
    mode: themeMode,
    isDark,
    colors: getThemeColors(isDark),
    spacing: DesignSystem.spacing,
    typography: DesignSystem.typography,
    radius: DesignSystem.radius,
    shadows: DesignSystem.shadows,
    components: DesignSystem.components,
    animation: DesignSystem.animation,
    layout: DesignSystem.layout,
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
