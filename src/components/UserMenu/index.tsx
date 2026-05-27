import { CopyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Dropdown, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { useLogout } from '../../features/iam/queries';
import type { AdminRole, CurrentSession } from '../../features/iam/types';

const roleLabels: Record<AdminRole, string> = {
  platform_admin: '平台管理员',
  application_admin: '应用管理员',
};

type UserMenuProps = {
  session: CurrentSession;
  environmentName: string;
  runtimeName?: string;
  compact?: boolean;
  logout?: () => Promise<void>;
  onLogoutSuccess?: () => void;
};

export function UserMenu({ session, environmentName, runtimeName, compact = false, logout, onLogoutSuccess }: UserMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localLogoutError, setLocalLogoutError] = useState(false);
  const [localLogoutLoading, setLocalLogoutLoading] = useState(false);
  const logoutMutation = useLogout({ onSuccess: onLogoutSuccess });
  const primaryRole = session.roles[0];
  const primaryRoleLabel = primaryRole ? roleLabels[primaryRole] : '未分配角色';
  const openId = session.user.feishuUserId;
  const truncatedOpenId = truncateOpenId(openId);

  const runLogout = async () => {
    setLocalLogoutError(false);
    if (logout) {
      setLocalLogoutLoading(true);
      try {
        await logout();
        onLogoutSuccess?.();
      } catch {
        setLocalLogoutError(true);
      } finally {
        setLocalLogoutLoading(false);
      }
      return;
    }
    try {
      await logoutMutation.mutateAsync();
    } catch {
      setLocalLogoutError(true);
    }
  };

  const copyOpenId = async () => {
    await writeClipboard(openId);
    setCopied(true);
  };

  return (
    <>
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: [
            {
              key: 'logout',
              danger: true,
              icon: <LogoutOutlined aria-hidden="true" />,
              label: '退出登录',
            },
          ],
          onClick: ({ key }) => {
            if (key === 'logout') {
              setConfirmOpen(true);
            }
          },
        }}
        popupRender={(menu) => (
          <div style={{ width: 280, padding: 12, background: '#fff', borderRadius: 6, boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}>
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              <Space align="start" size={10}>
                <Avatar icon={<UserOutlined aria-hidden="true" />} />
                <Space orientation="vertical" size={2} style={{ minWidth: 0 }}>
                  <Typography.Text strong ellipsis>
                    {session.user.displayName}
                  </Typography.Text>
                  <Space size={6} wrap>
                    <Tag color={primaryRole ? 'blue' : 'default'} style={{ marginInlineEnd: 0 }}>
                      {primaryRoleLabel}
                    </Tag>
                    <Tag color="green" style={{ marginInlineEnd: 0 }}>
                      {environmentName}
                    </Tag>
                    {runtimeName ? (
                      <Tag color="default" style={{ marginInlineEnd: 0 }}>
                        {runtimeName}
                      </Tag>
                    ) : null}
                  </Space>
                </Space>
              </Space>
              <Space size={6} style={{ width: '100%', justifyContent: 'space-between' }}>
                <Typography.Text type="secondary">open_id</Typography.Text>
                <Space size={4}>
                  <Typography.Text code>{truncatedOpenId}</Typography.Text>
                  <Tooltip title={copied ? '已复制' : '复制 open_id'}>
                    <Button
                      aria-label="复制飞书 open_id"
                      size="small"
                      type="text"
                      icon={<CopyOutlined aria-hidden="true" />}
                      onClick={copyOpenId}
                    />
                  </Tooltip>
                </Space>
              </Space>
              {menu}
            </Space>
          </div>
        )}
      >
        <Button
          type="text"
          aria-label={`打开用户菜单，当前飞书用户：${session.user.displayName}`}
          style={{ height: 40, display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Avatar size={28} icon={<UserOutlined aria-hidden="true" />} />
          {!compact ? (
            <Typography.Text style={{ maxWidth: 120 }} ellipsis>
              {session.user.displayName}
            </Typography.Text>
          ) : null}
        </Button>
      </Dropdown>
      <Modal
        open={confirmOpen}
        title="确认退出登录"
        okText={localLogoutError || logoutMutation.isError ? '重试退出' : '确认退出'}
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={localLogoutLoading || logoutMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onOk={runLogout}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text>当前 IAM 管理会话将结束。</Typography.Text>
          <Typography.Text type="secondary">退出后需要重新通过飞书登录才能访问 Admin Console。</Typography.Text>
          {localLogoutError || logoutMutation.isError ? <Alert showIcon type="error" title="退出失败，请重试。" /> : null}
        </Space>
      </Modal>
    </>
  );
}

function truncateOpenId(openId: string) {
  if (openId.length <= 13) {
    return openId;
  }
  return `${openId.slice(0, 6)}...${openId.slice(-4)}`;
}

async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}
