import { Form, Input } from 'antd';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SearchForm, SearchFormActions } from './index';

interface SearchValues {
  keyword?: string;
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
});

function SearchFormHarness({ layout = 'grid' }: { layout?: 'grid' | 'inline' }) {
  const [form] = Form.useForm<SearchValues>();
  return (
    <SearchForm form={form} layout={layout} compact onFinish={vi.fn()}>
      <Form.Item name="keyword" label="关键词">
        <Input aria-label="keyword" />
      </Form.Item>
      <SearchFormActions onReset={vi.fn()} />
    </SearchForm>
  );
}

describe('SearchForm', () => {
  it('renders compact grid filters without an Ant Design Card wrapper', () => {
    const { container } = render(<SearchFormHarness />);

    expect(screen.getByLabelText('keyword')).toBeInTheDocument();
    expect(container.querySelector('.ant-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-form-shell')).toHaveStyle({ background: '#ffffff' });
  });

  it('uses search semantics for the query action instead of PlusOutlined', () => {
    render(<SearchFormHarness layout="inline" />);

    const queryButton = screen.getByRole('button', { name: /查\s*询/ });
    expect(queryButton.querySelector('.anticon-search')).toBeInTheDocument();
    expect(queryButton.querySelector('.anticon-plus')).not.toBeInTheDocument();
  });
});
