import { Space, Typography } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function PageHeader({ title, description, extra, className, style }: PageHeaderProps) {
  return (
    <section
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        width: '100%',
        ...style,
      }}
    >
      <Space orientation="vertical" size={4} style={{ minWidth: 0 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {description}
          </Typography.Text>
        ) : null}
      </Space>
      {extra ? <div style={{ flex: '0 0 auto' }}>{extra}</div> : null}
    </section>
  );
}
