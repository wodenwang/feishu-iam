import { Button } from 'antd';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './index';

describe('PageHeader', () => {
  it('renders title, description, and extra action without an Ant Design Card wrapper', () => {
    const { container } = render(
      <PageHeader title="应用管理" description="管理第三方应用接入与权限边界" extra={<Button type="primary">创建应用</Button>} />,
    );

    expect(screen.getByRole('heading', { name: '应用管理' })).toBeInTheDocument();
    expect(screen.getByText('管理第三方应用接入与权限边界')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建应用' })).toBeInTheDocument();
    expect(container.querySelector('.ant-card')).not.toBeInTheDocument();
  });
});
