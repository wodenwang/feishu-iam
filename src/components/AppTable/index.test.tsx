import { Button } from 'antd';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AppTable } from './index';

interface Row {
  id: string;
  name: string;
}

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

  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const tableProps = {
  rowKey: 'id',
  columns: [{ title: '应用名称', dataIndex: 'name' }],
  dataSource: [] as Row[],
  pagination: { total: 0, current: 1, pageSize: 10 },
};

describe('AppTable', () => {
  it('preserves table header and stable body height for error state', () => {
    render(
      <AppTable<Row>
        title="应用列表"
        isError
        error={
          <div>
            加载应用列表失败 <Button>重试</Button>
          </div>
        }
        tableProps={tableProps}
      />,
    );

    expect(screen.getByText('应用列表')).toBeInTheDocument();
    expect(screen.getByText('应用名称')).toBeInTheDocument();
    expect(screen.getByText('加载应用列表失败')).toBeInTheDocument();
    expect(screen.getByTestId('app-table-shell')).toHaveStyle({ minHeight: '360px' });
  });

  it('supports a distinct search-empty state while keeping the table structure visible', () => {
    render(
      <AppTable<Row>
        title="应用列表"
        isSearchEmpty
        searchEmpty={<div>没有匹配的应用</div>}
        tableProps={tableProps}
      />,
    );

    expect(screen.getByText('应用名称')).toBeInTheDocument();
    expect(screen.getByText('没有匹配的应用')).toBeInTheDocument();
  });
});
