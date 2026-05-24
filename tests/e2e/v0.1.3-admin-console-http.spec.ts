import { expect, test } from '@playwright/test';

test.describe('v0.1.3 Admin Console HTTP mode', () => {
  test('logs in through dev mock Feishu, initializes, creates an app, and sees audit', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByText('HTTP runtime')).toBeVisible();

    await page.getByRole('button', { name: '使用本地 mock 飞书登录' }).click();
    await expect(page).toHaveURL(/\/initialize/);

    const bindButton = page.getByRole('button', { name: /绑定当前飞书用户为平台管理员/ });
    if (await bindButton.isVisible()) {
      await bindButton.click();
    }
    await page.goto('/applications');

    await expect(page.getByText('HTTP runtime')).toBeVisible();
    await page.getByRole('button', { name: '创建应用' }).click();
    await page.getByLabel('应用名称').fill(`HTTP Mode Demo ${testInfo.project.name} ${Date.now()}`);
    await page.getByRole('button', { name: /提\s*交/ }).click();

    await expect(page.getByRole('dialog', { name: '应用已创建' })).toBeVisible();
    await expect(page.getByText(/以下密钥只显示一次/)).toBeVisible();
    await page.getByRole('button', { name: /我已保存/ }).click();

    await expect(page).toHaveURL(/\/audit-logs/);
    await expect(page.locator('.ant-table-tbody')).toContainText('创建应用');
  });
});
