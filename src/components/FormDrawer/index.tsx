import { Button, Drawer, Space } from 'antd';
import type { DrawerProps } from 'antd';
import type { ReactNode } from 'react';

interface FormDrawerProps {
  title: ReactNode;
  open: boolean;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  size?: DrawerProps['size'];
  submitText?: string;
  submitLoading?: boolean;
}

export function FormDrawer({
  title,
  open,
  children,
  onClose,
  onSubmit,
  size = 520,
  submitText = '保存',
  submitLoading = false,
}: FormDrawerProps) {
  return (
    <Drawer
      title={title}
      size={size}
      open={open}
      destroyOnClose
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={submitLoading} onClick={onSubmit}>
            {submitText}
          </Button>
        </Space>
      }
    >
      {children}
    </Drawer>
  );
}
