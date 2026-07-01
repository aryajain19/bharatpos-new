import React, { createContext, useContext, useState, useEffect } from 'react';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Premium Dark Blue & White Light Theme
const lightColors = {
  ...MD3LightTheme.colors,
  primary: '#1E3A8A', // Deep Blue
  onPrimary: '#FFFFFF',
  primaryContainer: '#DBEAFE',
  onPrimaryContainer: '#1E3A8A',
  secondary: '#3B82F6',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#EFF6FF',
  onSecondaryContainer: '#1E40AF',
  tertiary: '#64748B',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F1F5F9',
  onTertiaryContainer: '#0F172A',
  error: '#DC2626',
  onError: '#FFFFFF',
  errorContainer: '#FEE2E2',
  onErrorContainer: '#991B1B',
  background: '#F8FAFC',
  onBackground: '#0F172A',
  surface: '#FFFFFF',
  onSurface: '#0F172A',
  surfaceVariant: '#F1F5F9',
  onSurfaceVariant: '#475569',
  outline: '#CBD5E1',
  outlineVariant: '#E2E8F0',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#0F172A',
  inverseOnSurface: '#F8FAFC',
  inversePrimary: '#DBEAFE',
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

// Premium Dark Blue & White Dark Theme
const darkColors = {
  ...MD3DarkTheme.colors,
  primary: '#FFFFFF',
  onPrimary: '#1E3A8A',
  primaryContainer: '#1E40AF',
  onPrimaryContainer: '#FFFFFF',
  secondary: '#93C5FD',
  onSecondary: '#1E3A8A',
  secondaryContainer: '#1E3A8A',
  onSecondaryContainer: '#EFF6FF',
  tertiary: '#94A3B8',
  onTertiary: '#0F172A',
  tertiaryContainer: '#1E293B',
  onTertiaryContainer: '#F8FAFC',
  error: '#FCA5A5',
  onError: '#7F1D1D',
  errorContainer: '#991B1B',
  onErrorContainer: '#FEE2E2',
  background: '#0B1120', // Very deep blue-black
  onBackground: '#F8FAFC',
  surface: '#172554', // Dark blue surface
  onSurface: '#F8FAFC',
  surfaceVariant: '#1E3A8A',
  onSurfaceVariant: '#DBEAFE',
  outline: '#3B82F6',
  outlineVariant: '#1D4ED8',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#F8FAFC',
  inverseOnSurface: '#0F172A',
  inversePrimary: '#1E3A8A',
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
  backdrop: 'rgba(11, 17, 32, 0.6)',
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isDarkMode = false;
  const toggleTheme = () => {};
  const currentTheme = MonoLightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <PaperProvider theme={currentTheme}>
        {children}
      </PaperProvider>
    </ThemeContext.Provider>
  );
}
