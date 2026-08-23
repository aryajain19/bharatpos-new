import React, { createContext, useContext, useState, useEffect } from 'react';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// BharatPOS Emerald Green & Clean Minimal Light Theme
const lightColors = {
  ...MD3LightTheme.colors,
  primary: '#10B981', // BharatPOS Emerald Green
  onPrimary: '#FFFFFF',
  primaryContainer: '#ECFDF5', // Soft Mint / Pastel Green
  onPrimaryContainer: '#065F46',
  secondary: '#059669',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F0FDF4',
  onSecondaryContainer: '#047857',
  tertiary: '#64748B',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F1F5F9',
  onTertiaryContainer: '#0F172A',
  error: '#EF4444',
  onError: '#FFFFFF',
  errorContainer: '#FEF2F2',
  onErrorContainer: '#991B1B',
  background: '#F8FAFC',
  onBackground: '#0F172A',
  surface: '#FFFFFF',
  onSurface: '#0F172A',
  surfaceVariant: '#F8FAFC',
  onSurfaceVariant: '#475569',
  outline: '#CBD5E1',
  outlineVariant: '#E2E8F0',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#0F172A',
  inverseOnSurface: '#F8FAFC',
  inversePrimary: '#ECFDF5',
  elevation: {
    level0: 'transparent',
    level1: '#FFFFFF',
    level2: '#FFFFFF',
    level3: '#FFFFFF',
    level4: '#FFFFFF',
    level5: '#FFFFFF',
  },
  surfaceDisabled: 'rgba(15, 23, 42, 0.12)',
  onSurfaceDisabled: 'rgba(15, 23, 42, 0.38)',
  backdrop: 'rgba(15, 23, 42, 0.4)',
};

// BharatPOS Emerald Green Dark Theme
const darkColors = {
  ...MD3DarkTheme.colors,
  primary: '#10B981',
  onPrimary: '#FFFFFF',
  primaryContainer: 'rgba(16, 185, 129, 0.2)',
  onPrimaryContainer: '#A7F3D0',
  secondary: '#34D399',
  onSecondary: '#064E3B',
  secondaryContainer: 'rgba(5, 150, 105, 0.2)',
  onSecondaryContainer: '#ECFDF5',
  tertiary: '#94A3B8',
  onTertiary: '#0F172A',
  tertiaryContainer: '#1E293B',
  onTertiaryContainer: '#F8FAFC',
  error: '#FCA5A5',
  onError: '#7F1D1D',
  errorContainer: 'rgba(239, 68, 68, 0.2)',
  onErrorContainer: '#FEE2E2',
  background: '#0F172A',
  onBackground: '#F8FAFC',
  surface: '#1E293B',
  onSurface: '#F8FAFC',
  surfaceVariant: '#334155',
  onSurfaceVariant: '#E2E8F0',
  outline: '#475569',
  outlineVariant: '#334155',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#F8FAFC',
  inverseOnSurface: '#0F172A',
  inversePrimary: '#10B981',
  elevation: {
    level0: 'transparent',
    level1: '#1E293B',
    level2: '#334155',
    level3: '#475569',
    level4: '#64748B',
    level5: '#94A3B8',
  },
  surfaceDisabled: 'rgba(248, 250, 252, 0.12)',
  onSurfaceDisabled: 'rgba(248, 250, 252, 0.38)',
  backdrop: 'rgba(15, 23, 42, 0.6)',
};

export const MonoLightTheme = { ...MD3LightTheme, colors: lightColors };
export const MonoDarkTheme = { ...MD3DarkTheme, colors: darkColors };

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
});

export const useAppTheme = () => useContext(ThemeContext);

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem('user_theme_preference').then((savedTheme) => {
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
      }
    });
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem('user_theme_preference', next ? 'dark' : 'light');
      return next;
    });
  };

  const theme = isDarkMode ? MonoDarkTheme : MonoLightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <PaperProvider theme={theme}>
        {children}
      </PaperProvider>
    </ThemeContext.Provider>
  );
};

export const ThemeProvider = AppThemeProvider;

