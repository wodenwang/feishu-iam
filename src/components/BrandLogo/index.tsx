import type { CSSProperties } from 'react';
import { brandPalette } from '../../theme/theme';

export type BrandLogoVariant = 'expanded' | 'collapsed' | 'login';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  style?: CSSProperties;
}

const variantSize: Record<BrandLogoVariant, number> = {
  expanded: 36,
  collapsed: 32,
  login: 56,
};

function LogoMark({ size }: { size: number }) {
  return (
    <svg
      data-testid="brand-logo-mark"
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block', flex: '0 0 auto', width: size, height: size }}
    >
      <rect width="56" height="56" rx="14" fill={brandPalette.deep} />
      <path
        d="M28 9L43 15.2V27.3C43 36.7 37 45.1 28 48C19 45.1 13 36.7 13 27.3V15.2L28 9Z"
        fill={brandPalette.surface}
      />
      <path
        d="M28 14.2L38.2 18.4V27.2C38.2 33.9 34.4 39.9 28 42.6C21.6 39.9 17.8 33.9 17.8 27.2V18.4L28 14.2Z"
        fill={brandPalette.primary}
      />
      <path d="M23 28.2L26.5 31.7L34 22.8" stroke={brandPalette.surface} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M43 15.2V27.3C43 36.7 37 45.1 28 48" stroke={brandPalette.accent} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({ variant = 'expanded', className, style }: BrandLogoProps) {
  const isCollapsed = variant === 'collapsed';
  const isLogin = variant === 'login';
  const size = variantSize[variant];

  return (
    <div
      role="img"
      aria-label="feishu-iam"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isLogin ? 14 : 10,
        minWidth: isCollapsed ? size : undefined,
        ...style,
      }}
    >
      <LogoMark size={size} />
      {isCollapsed ? null : (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
          <span style={{ color: brandPalette.textBase, fontSize: isLogin ? 24 : 16, fontWeight: 700 }}>feishu-iam</span>
          <span style={{ color: '#5f7182', fontSize: isLogin ? 14 : 12, marginTop: isLogin ? 6 : 3 }}>飞书身份与访问管理</span>
        </span>
      )}
    </div>
  );
}
