import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Colors {
  primary: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textMuted: string;
  error: string;
  success: string;
  warning: string;
  border: string;
  card: string;
}

interface Theme {
  dark: boolean;
  colors: Colors;
  toggle: () => void;
}

const darkColors: Colors = {
  primary: '#06B6D4',
  background: '#0f172a',
  surface: '#1e293b',
  surfaceVariant: '#334155',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  border: '#334155',
  card: '#1e293b',
};

const lightColors: Colors = {
  primary: '#06B6D4',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceVariant: '#f1f5f9',
  text: '#0f172a',
  textMuted: '#64748b',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  border: '#e2e8f0',
  card: '#ffffff',
};

const ThemeContext = createContext<Theme>({
  dark: true,
  colors: darkColors,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(true);

  function toggle() {
    setDark((d) => !d);
  }

  const value: Theme = {
    dark,
    colors: dark ? darkColors : lightColors,
    toggle,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
