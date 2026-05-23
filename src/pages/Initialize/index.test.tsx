import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { InitializePage } from './index';

describe('InitializePage', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('shows initialization status, four bootstrap steps, and actions', () => {
    render(<InitializePage />);

    expect(screen.getByRole('heading', { name: '系统初始化' })).toBeInTheDocument();
    expect(screen.getByText('当前系统尚未完成平台管理员绑定')).toBeInTheDocument();
    expect(screen.getByText('配置飞书自建应用')).toBeInTheDocument();
    expect(screen.getByText('设置 FEISHU_INITIAL_ADMIN_USER_ID')).toBeInTheDocument();
    expect(screen.getByText('重启服务')).toBeInTheDocument();
    expect(screen.getByText('使用飞书登录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新检测配置' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看部署文档' })).toBeInTheDocument();
  });
});
