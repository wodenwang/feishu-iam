import { SearchOutlined } from '@ant-design/icons';
import { Button, Form, Space } from 'antd';
import type { FormInstance, FormProps } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

type SearchFormLayout = 'grid' | 'inline';

interface SearchFormProps<Values extends object> extends Omit<FormProps<Values>, 'form' | 'children' | 'onFinish' | 'layout'> {
  form: FormInstance<Values>;
  children: ReactNode;
  onFinish: FormProps<Values>['onFinish'];
  layout?: SearchFormLayout;
  compact?: boolean;
  minItemWidth?: number;
  shellStyle?: CSSProperties;
}

interface SearchFormActionsProps {
  searchText?: string;
  resetText?: string;
  loading?: boolean;
  disabled?: boolean;
  onReset?: () => void;
}

export function SearchFormActions({
  searchText = '查询',
  resetText = '重置',
  loading = false,
  disabled = false,
  onReset,
}: SearchFormActionsProps) {
  return (
    <Form.Item style={{ marginBottom: 0 }}>
      <Space size={8}>
        <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading} disabled={disabled}>
          {searchText}
        </Button>
        <Button onClick={onReset}>{resetText}</Button>
      </Space>
    </Form.Item>
  );
}

export function SearchForm<Values extends object>({
  form,
  children,
  onFinish,
  layout = 'grid',
  compact = false,
  minItemWidth = 220,
  shellStyle,
  style,
  ...formProps
}: SearchFormProps<Values>) {
  const gap = compact ? 8 : 12;
  const formStyle: CSSProperties =
    layout === 'grid'
      ? {
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))`,
          columnGap: 16,
          rowGap: gap,
          alignItems: 'end',
          ...style,
        }
      : {
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: 16,
          rowGap: gap,
          alignItems: 'end',
          ...style,
        };

  return (
    <div
      data-testid="search-form-shell"
      style={{
        width: '100%',
        background: '#ffffff',
        border: '1px solid #d9e2ec',
        borderRadius: 6,
        padding: compact ? 12 : 16,
        ...shellStyle,
      }}
    >
      <Form form={form} layout={layout === 'inline' ? 'inline' : 'horizontal'} style={formStyle} onFinish={onFinish} {...formProps}>
        {children}
      </Form>
    </div>
  );
}
