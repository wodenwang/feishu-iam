import type { ThemeConfig } from 'antd';

export const brandPalette = {
  primary: '#0f4c81',
  deep: '#0b2e4f',
  info: '#1f67b2',
  accent: '#f28c28',
  layoutBg: '#eef4f8',
  textBase: '#122230',
  tableHeaderBg: '#f6f9fb',
  borderSecondary: '#d9e2ec',
  surface: '#ffffff',
} as const;

export const theme: ThemeConfig = {
  token: {
    colorPrimary: brandPalette.primary,
    colorInfo: brandPalette.info,
    colorWarning: brandPalette.accent,
    colorBgLayout: brandPalette.layoutBg,
    colorTextBase: brandPalette.textBase,
    colorBorderSecondary: brandPalette.borderSecondary,
    colorLink: brandPalette.info,
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Button: {
      primaryShadow: 'none',
    },
    Card: {
      headerBg: brandPalette.surface,
    },
    Layout: {
      bodyBg: brandPalette.layoutBg,
      headerBg: brandPalette.surface,
      siderBg: brandPalette.surface,
      triggerBg: brandPalette.deep,
    },
    Menu: {
      itemSelectedBg: '#e7f0f8',
      itemSelectedColor: brandPalette.primary,
    },
    Table: {
      cellPaddingBlock: 8,
      cellPaddingInline: 12,
      headerBg: brandPalette.tableHeaderBg,
      headerColor: brandPalette.textBase,
      borderColor: brandPalette.borderSecondary,
    },
    Tag: {
      defaultBg: '#f8fafc',
      defaultColor: brandPalette.textBase,
    },
  },
};
