import { expect, test } from '@playwright/test';

test.describe('v0.1.3 Admin Console HTTP mode', () => {
  test('logs in through dev mock Feishu, initializes, creates an app, and sees audit', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByText(/HTTP runtime|生产环境/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Mock 开发登录（仅本地）' }).click();
    await expect(page).toHaveURL(/\/initialize/);

    const bindButton = page.getByRole('button', { name: /绑定当前飞书用户为平台管理员/ });
    const enterApplicationsButton = page.getByRole('button', { name: '进入应用管理' });
    await expect(page.getByText(/初始化已完成|等待完成初始化/)).toBeVisible();
    if (await enterApplicationsButton.isVisible()) {
      await enterApplicationsButton.click();
    } else {
      await expect(bindButton).toBeVisible();
      await bindButton.click();
      await expect(enterApplicationsButton).toBeVisible();
      await enterApplicationsButton.click();
    }
    await expect(page).toHaveURL(/\/applications/);

    await expect(page.getByRole('button', { name: /打开用户菜单/ })).toBeVisible();
    await page.getByRole('button', { name: '新增应用' }).click();
    await page.getByLabel('应用名称').fill(`HTTP Mode Demo ${testInfo.project.name} ${Date.now()}`);
    await page.getByRole('button', { name: /提\s*交/ }).click();

    await expect(page.getByRole('dialog', { name: '应用已创建' })).toBeVisible();
    await expect(page.getByText(/以下密钥只显示一次/)).toBeVisible();
    await page.getByRole('button', { name: /我已保存/ }).click();

    await expect(page).toHaveURL(/\/audit-logs/);
    await expect(page.locator('.ant-table-tbody')).toContainText('创建应用');
  });
});
