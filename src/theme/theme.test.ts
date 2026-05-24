import { describe, expect, it } from 'vitest';
import { brandPalette, theme } from './theme';

describe('theme', () => {
  it('uses the v0.1.10 brand token palette', () => {
    expect(brandPalette).toMatchObject({
      primary: '#0f4c81',
      deep: '#0b2e4f',
      info: '#1f67b2',
      accent: '#f28c28',
      layoutBg: '#eef4f8',
      textBase: '#122230',
      tableHeaderBg: '#f6f9fb',
    });

    expect(theme.token).toMatchObject({
      colorPrimary: '#0f4c81',
      colorInfo: '#1f67b2',
      colorWarning: '#f28c28',
      colorBgLayout: '#eef4f8',
      colorTextBase: '#122230',
    });
    expect(theme.components?.Table).toMatchObject({ headerBg: '#f6f9fb' });
  });
});
