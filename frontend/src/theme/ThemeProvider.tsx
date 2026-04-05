import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material';

import { getAppTheme } from './theme';

type ColorMode = 'light' | 'dark';

interface ThemeModeContextValue {
  mode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

const STORAGE_KEY = 'talkie-color-mode';
const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

const getInitialColorMode = (): ColorMode => {
  const storedMode = localStorage.getItem(STORAGE_KEY);
  if (storedMode === 'light' || storedMode === 'dark') {
    return storedMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ColorMode>(getInitialColorMode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggleColorMode = useCallback(() => {
    setMode((previousMode) => (previousMode === 'light' ? 'dark' : 'light'));
  }, []);

  const setColorMode = useCallback((nextMode: ColorMode) => {
    setMode(nextMode);
  }, []);

  const contextValue = useMemo(
    () => ({ mode, toggleColorMode, setColorMode }),
    [mode, toggleColorMode, setColorMode],
  );

  const theme = useMemo(() => getAppTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export const useThemeMode = (): ThemeModeContextValue => {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error('useThemeMode must be used within AppThemeProvider.');
  }

  return context;
};
