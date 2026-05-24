import { Tag } from 'antd';
import type { ReactNode } from 'react';

export type StatusTagStatus = 'active' | 'disabled' | 'draft' | 'system';

export const statusTagConfig: Record<StatusTagStatus, { label: string; color: string }> = {
  active: { label: '启用', color: 'green' },
  disabled: { label: '停用', color: 'orange' },
  draft: { label: '草稿', color: 'default' },
  system: { label: '系统', color: 'blue' },
};

interface StatusTagProps {
  status: StatusTagStatus;
  children?: ReactNode;
}

export function StatusTag({ status, children }: StatusTagProps) {
  const config = statusTagConfig[status];

  return (
    <Tag color={config.color} data-status={status}>
      {children ?? config.label}
    </Tag>
  );
}
