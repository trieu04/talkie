import { describe, expect, it } from 'vitest';

import { getAppTheme } from '../../../src/theme/theme';

const luminance = (hex: string): number => {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
};

const contrastRatio = (foreground: string, background: string): number => {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
};

describe('theme contrast', () => {
  it.each(['light', 'dark'] as const)('meets WCAG AA contrast in %s mode', (mode) => {
    const theme = getAppTheme(mode);
    expect(contrastRatio(theme.palette.primary.main, theme.palette.primary.contrastText)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.palette.text.primary, theme.palette.background.default)).toBeGreaterThanOrEqual(4.5);
  });
});
