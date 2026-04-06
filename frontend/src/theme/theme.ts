import { alpha, createTheme } from '@mui/material/styles';

export const getAppTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'light' ? '#1d4ed8' : '#93c5fd',
        contrastText: mode === 'light' ? '#ffffff' : '#0f172a',
      },
      secondary: {
        main: mode === 'light' ? '#6d28d9' : '#c4b5fd',
        contrastText: mode === 'light' ? '#ffffff' : '#111827',
      },
      background: {
        default: mode === 'light' ? '#f8fafc' : '#0f172a',
        paper: mode === 'light' ? '#ffffff' : '#111827',
      },
      text: {
        primary: mode === 'light' ? '#0f172a' : '#f8fafc',
        secondary: mode === 'light' ? '#334155' : '#cbd5e1',
      },
      divider: mode === 'light' ? '#cbd5e1' : '#334155',
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: ['Inter', 'Roboto', 'Arial', 'sans-serif'].join(','),
      h4: {
        fontWeight: 700,
      },
      h5: {
        fontWeight: 700,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&.Mui-focusVisible': {
              outline: `3px solid ${alpha(mode === 'light' ? '#1d4ed8' : '#93c5fd', 0.9)}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });
