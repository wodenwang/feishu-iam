import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './index';

describe('LoginPage', () => {
  it('shows Feishu login entry without local username or password fields', () => {
    render(<LoginPage />);

    expect(screen.getByRole('button', { name: '使用飞书登录' })).toBeInTheDocument();
    expect(screen.queryByLabelText('用户名')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('用户名')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('密码')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).not.toBeInTheDocument();
  });

  it('calls the Feishu OAuth entry when login is clicked', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    await user.click(screen.getByRole('button', { name: '使用飞书登录' }));

    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('shows required Feishu environment variables when configuration is missing', () => {
    render(<LoginPage status="configMissing" />);

    expect(screen.getByText(/FEISHU_APP_ID/)).toBeInTheDocument();
    expect(screen.getByText(/FEISHU_APP_SECRET/)).toBeInTheDocument();
  });
});
