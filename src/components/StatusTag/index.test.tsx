import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusTag, statusTagConfig } from './index';

describe('StatusTag', () => {
  it('maps common IAM statuses to readable labels', () => {
    render(
      <>
        <StatusTag status="active" />
        <StatusTag status="disabled" />
        <StatusTag status="draft" />
        <StatusTag status="system" />
      </>,
    );

    expect(screen.getByText('启用')).toBeInTheDocument();
    expect(screen.getByText('停用')).toBeInTheDocument();
    expect(screen.getByText('草稿')).toBeInTheDocument();
    expect(screen.getByText('系统')).toBeInTheDocument();
  });

  it('keeps disabled status as a normal state instead of a black high-contrast tag', () => {
    expect(statusTagConfig.disabled.color).toBe('orange');
    expect(statusTagConfig.disabled.color).not.toBe('black');
  });
});
