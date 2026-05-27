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

  it('hides local mock login unless the caller marks it visible', () => {
    const { rerender } = render(<LoginPage />);

    expect(screen.queryByRole('button', { name: /Mock 开发登录/ })).not.toBeInTheDocument();

    rerender(<LoginPage devMockLoginVisible />);

    expect(screen.getByRole('button', { name: /Mock 开发登录/ })).toBeInTheDocument();
    expect(screen.getByText('DEV ONLY')).toBeInTheDocument();
  });

  it('shows a stable callback processing state', () => {
    render(<LoginPage status="callbackProcessing" deploymentUrl="https://iam.example.com" environmentName="生产环境" />);

    expect(screen.getByText('正在验证飞书身份')).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/iam\.example\.com/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '使用飞书登录' })).not.toBeInTheDocument();
  });

  it('shows no-console-access recovery copy', () => {
    render(<LoginPage status="noConsoleAccess" />);

    expect(screen.getByText('无后台访问权限')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新使用飞书登录' })).toBeInTheDocument();
  });

  it('shows login-required recovery when OAuth starts without an IAM session', () => {
    render(<LoginPage status="loginRequired" deploymentUrl="https://iam.example.com" environmentName="生产环境" />);

    expect(screen.getByText('需要通过飞书登录')).toBeInTheDocument();
    expect(screen.getAllByText(/当前浏览器没有有效 IAM 登录态/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '使用飞书登录' })).toBeInTheDocument();
    expect(screen.getByText('生产环境')).toBeInTheDocument();
    expect(screen.getByText('https://iam.example.com')).toBeInTheDocument();
  });
});
