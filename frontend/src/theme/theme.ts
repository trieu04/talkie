import { alpha, createTheme } from '@mui/material/styles';

import type { PaletteMode } from '@mui/material';
import type { CSSProperties } from 'react';

declare module '@mui/material/styles' {
  interface Palette {
    talkie: {
      appBg: string;
      pageBg: string;
      navBg: string;
      panel: string;
      panelMuted: string;
      panelRaised: string;
      panelAccent: string;
      borderSubtle: string;
      borderStrong: string;
      textMuted: string;
      textSubtle: string;
      live: string;
      paused: string;
      processing: string;
      reconnecting: string;
      completed: string;
      danger: string;
      warning: string;
      info: string;
      success: string;
      transcriptRail: string;
      transcriptPending: string;
      transcriptHighlight: string;
      summaryAccent: string;
      overlay: string;
    };
  }

  interface PaletteOptions {
    talkie?: Partial<Palette['talkie']>;
  }

  interface TypeBackground {
    level1: string;
    level2: string;
    level3: string;
  }

  interface TypeText {
    tertiary: string;
  }

  interface TypographyVariants {
    pageTitle: CSSProperties;
    sectionTitle: CSSProperties;
    sectionEyebrow: CSSProperties;
    metricValue: CSSProperties;
    monoLabel: CSSProperties;
  }

  interface TypographyVariantsOptions {
    pageTitle?: CSSProperties;
    sectionTitle?: CSSProperties;
    sectionEyebrow?: CSSProperties;
    metricValue?: CSSProperties;
    monoLabel?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true;
    sectionTitle: true;
    sectionEyebrow: true;
    metricValue: true;
    monoLabel: true;
  }
}

const buildPalette = (mode: PaletteMode) => {
  if (mode === 'dark') {
    return {
      primary: {
        main: '#7dd3fc',
        dark: '#38bdf8',
        light: '#bae6fd',
        contrastText: '#082f49',
      },
      secondary: {
        main: '#f0abfc',
        dark: '#e879f9',
        light: '#f5d0fe',
        contrastText: '#3b0764',
      },
      success: {
        main: '#4ade80',
        contrastText: '#052e16',
      },
      warning: {
        main: '#fbbf24',
        contrastText: '#451a03',
      },
      error: {
        main: '#fb7185',
        contrastText: '#4c0519',
      },
      info: {
        main: '#38bdf8',
        contrastText: '#082f49',
      },
      background: {
        default: '#07111f',
        paper: '#0d1726',
        level1: '#0f1c2d',
        level2: '#142235',
        level3: '#192a40',
      },
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        tertiary: '#94a3b8',
      },
      divider: alpha('#d7e3f4', 0.14),
      talkie: {
        appBg: '#07111f',
        pageBg: '#0b1525',
        navBg: alpha('#0b1525', 0.84),
        panel: '#0d1726',
        panelMuted: '#0a1320',
        panelRaised: '#142235',
        panelAccent: alpha('#7dd3fc', 0.1),
        borderSubtle: alpha('#d7e3f4', 0.12),
        borderStrong: alpha('#d7e3f4', 0.22),
        textMuted: '#94a3b8',
        textSubtle: '#64748b',
        live: '#fb7185',
        paused: '#fbbf24',
        processing: '#38bdf8',
        reconnecting: '#f59e0b',
        completed: '#4ade80',
        danger: '#fb7185',
        warning: '#fbbf24',
        info: '#38bdf8',
        success: '#4ade80',
        transcriptRail: alpha('#7dd3fc', 0.18),
        transcriptPending: alpha('#7dd3fc', 0.12),
        transcriptHighlight: alpha('#7dd3fc', 0.18),
        summaryAccent: alpha('#f0abfc', 0.2),
        overlay: alpha('#020617', 0.72),
      },
    };
  }

  return {
    primary: {
      main: '#155eef',
      dark: '#004eeb',
      light: '#84adff',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9f1ab1',
      dark: '#86198f',
      light: '#f0abfc',
      contrastText: '#ffffff',
    },
    success: {
      main: '#16a34a',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#d97706',
      contrastText: '#ffffff',
    },
    error: {
      main: '#dc2626',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0284c7',
      contrastText: '#ffffff',
    },
    background: {
      default: '#eef4fb',
      paper: '#ffffff',
      level1: '#f8fbff',
      level2: '#f1f6fd',
      level3: '#e7eff9',
    },
    text: {
      primary: '#10243b',
      secondary: '#40566f',
      tertiary: '#6c8197',
    },
    divider: '#d7e3f4',
    talkie: {
      appBg: '#eef4fb',
      pageBg: '#f8fbff',
      navBg: alpha('#f8fbff', 0.9),
      panel: '#ffffff',
      panelMuted: '#f4f8fc',
      panelRaised: '#fbfdff',
      panelAccent: alpha('#155eef', 0.06),
      borderSubtle: '#dfe8f3',
      borderStrong: '#c3d4e7',
      textMuted: '#5e748b',
      textSubtle: '#7a8ea3',
      live: '#dc2626',
      paused: '#d97706',
      processing: '#0284c7',
      reconnecting: '#b45309',
      completed: '#15803d',
      danger: '#dc2626',
      warning: '#d97706',
      info: '#0284c7',
      success: '#15803d',
      transcriptRail: '#d6e4f7',
      transcriptPending: alpha('#155eef', 0.06),
      transcriptHighlight: alpha('#155eef', 0.12),
      summaryAccent: alpha('#9f1ab1', 0.08),
      overlay: alpha('#10243b', 0.56),
    },
  };
};

export const getAppTheme = (mode: PaletteMode) => {
  const palette = buildPalette(mode);

  return createTheme({
    palette,
    shape: {
      borderRadius: 18,
    },
    spacing: 4,
    typography: {
      fontFamily: ['Plus Jakarta Sans', 'Noto Sans', 'Segoe UI', 'sans-serif'].join(','),
      h1: {
        fontSize: '3rem',
        lineHeight: 1.05,
        fontWeight: 700,
        letterSpacing: '-0.04em',
      },
      h2: {
        fontSize: '2.25rem',
        lineHeight: 1.08,
        fontWeight: 700,
        letterSpacing: '-0.03em',
      },
      h3: {
        fontSize: '1.75rem',
        lineHeight: 1.12,
        fontWeight: 700,
      },
      h4: {
        fontSize: '1.5rem',
        lineHeight: 1.15,
        fontWeight: 700,
      },
      h5: {
        fontSize: '1.25rem',
        lineHeight: 1.2,
        fontWeight: 700,
      },
      h6: {
        fontSize: '1.05rem',
        lineHeight: 1.35,
        fontWeight: 700,
      },
      body1: {
        fontSize: '0.98rem',
        lineHeight: 1.7,
      },
      body2: {
        fontSize: '0.9rem',
        lineHeight: 1.6,
      },
      button: {
        textTransform: 'none',
        fontWeight: 700,
        letterSpacing: '-0.01em',
      },
      caption: {
        fontSize: '0.78rem',
        lineHeight: 1.4,
      },
      pageTitle: {
        fontSize: 'clamp(2rem, 5vw, 3.4rem)',
        lineHeight: 1.02,
        fontWeight: 800,
        letterSpacing: '-0.05em',
      },
      sectionTitle: {
        fontSize: '1rem',
        lineHeight: 1.25,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      sectionEyebrow: {
        fontSize: '0.72rem',
        lineHeight: 1.2,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      },
      metricValue: {
        fontSize: '1.5rem',
        lineHeight: 1,
        fontWeight: 700,
        letterSpacing: '-0.04em',
      },
      monoLabel: {
        fontFamily: ['IBM Plex Mono', 'ui-monospace', 'monospace'].join(','),
        fontSize: '0.75rem',
        lineHeight: 1.4,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: mode,
            '--talkie-segment-highlight': palette.talkie.transcriptHighlight,
          },
          body: {
            background: `radial-gradient(circle at top, ${alpha(palette.primary.main, mode === 'dark' ? 0.12 : 0.07)}, transparent 36%), ${palette.background.default}`,
          },
          '#root': {
            minHeight: '100dvh',
          },
          '.talkie-segment-highlight': {
            backgroundColor: 'var(--talkie-segment-highlight) !important',
            boxShadow: `0 0 0 1px ${alpha(palette.primary.main, 0.24)} inset`,
          },
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&.Mui-focusVisible': {
              outline: `3px solid ${alpha(palette.primary.main, 0.9)}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            minHeight: 42,
            borderRadius: 999,
            paddingInline: 18,
          },
          contained: {
            boxShadow: `0 12px 28px ${alpha(palette.primary.main, mode === 'dark' ? 0.16 : 0.18)}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 24,
            border: `1px solid ${palette.talkie.borderSubtle}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 600,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          fullWidth: true,
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundColor: palette.background.paper,
            '& .MuiOutlinedInput-input': {
              fontSize: '1rem',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 24,
            border: `1px solid ${palette.talkie.borderSubtle}`,
            boxShadow: 'none',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 18,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: palette.talkie.borderSubtle,
          },
        },
      },
    },
  });
};
