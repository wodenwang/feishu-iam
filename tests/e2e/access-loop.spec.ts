import { expect, test } from '@playwright/test';

test.describe('v0.1 access loop critical path', () => {
  test('renders the visible IAM access loop pages', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: '使用飞书登录' })).toBeVisible();

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible();

    await page.goto('/applications');
    await expect(page.getByRole('heading', { name: '应用管理' })).toBeVisible();
    await expect(page.getByText('Demo CRM')).toBeVisible();

    await page.goto('/applications/onboarding');
    await expect(page.getByRole('heading', { name: '应用接入向导' })).toBeVisible();
    await expect(page.getByText('IAM_APP_SECRET')).toBeVisible();
    await expect(page.getByText('IAM_API_SECRET')).toBeVisible();

    const agentPromptArea = page.locator('.ant-card').filter({ has: page.getByText('Agent Prompt') }).last();
    await expect(agentPromptArea).toContainText('IAM_APP_SECRET');
    await expect(agentPromptArea).toContainText('IAM_API_SECRET');
    await expect(agentPromptArea).not.toContainText('sec_****_crm');
    await expect(agentPromptArea).not.toContainText('api_****_crm');

    await page.goto('/roles');
    await expect(page.getByRole('heading', { name: '角色授权' })).toBeVisible();

    await page.goto('/audit-logs');
    await expect(page.getByRole('heading', { name: '审计日志' })).toBeVisible();
    await expect(page.getByText(/req_/).first()).toBeVisible();

    await page.goto('/sync');
    await expect(page.getByRole('heading', { name: '飞书同步' })).toBeVisible();
    await expect(page.getByText(/req_sync_failed_001|飞书部门列表接口限流/).first()).toBeVisible();

    await page.goto('/directory');
    await expect(page.getByRole('heading', { name: '组织与用户' })).toBeVisible();
    await expect(page.getByText('只读目录投影')).toBeVisible();
  });
});
