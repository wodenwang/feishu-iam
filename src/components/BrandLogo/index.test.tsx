import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandLogo } from './index';

describe('BrandLogo', () => {
  it('renders expanded brand text and subtitle', () => {
    render(<BrandLogo variant="expanded" />);

    expect(screen.getByLabelText('feishu-iam')).toBeInTheDocument();
    expect(screen.getByText('feishu-iam')).toBeInTheDocument();
    expect(screen.getByText('飞书身份与访问管理')).toBeInTheDocument();
  });

  it('keeps collapsed variant icon-only', () => {
    render(<BrandLogo variant="collapsed" />);

    expect(screen.getByLabelText('feishu-iam')).toBeInTheDocument();
    expect(screen.queryByText('飞书身份与访问管理')).not.toBeInTheDocument();
  });

  it('uses larger login treatment without changing the brand name', () => {
    render(<BrandLogo variant="login" />);

    expect(screen.getByText('feishu-iam')).toBeInTheDocument();
    expect(screen.getByTestId('brand-logo-mark')).toHaveStyle({ width: '56px', height: '56px' });
  });
});
