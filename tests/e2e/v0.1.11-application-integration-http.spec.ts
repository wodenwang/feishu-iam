import { expect, test } from '@playwright/test';

test.describe('v0.1.11 application integration HTTP mode', () => {
  test('creates an application and opens runtime detail plus onboarding', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Mock 开发登录（仅本地）' }).click();

    const bindButton = page.getByRole('button', { name: /绑定当前飞书用户为平台管理员/ });
    const enterApplicationsButton = page.getByRole('button', { name: '进入应用管理' });
    await expect(enterApplicationsButton.or(bindButton).first()).toBeVisible();
    if (await enterApplicationsButton.isVisible()) {
      await enterApplicationsButton.click();
    } else {
      await bindButton.click();
      await expect(enterApplicationsButton).toBeVisible();
      await enterApplicationsButton.click();
    }
    await expect(page).toHaveURL(/\/applications/);

    const appName = `Integration Runtime ${testInfo.project.name} ${Date.now()}`;
    await page.getByRole('button', { name: '新增应用' }).first().click();
    await page.getByLabel('应用名称').fill(appName);
    await page.getByRole('button', { name: /提\s*交/ }).click();

    await expect(page.getByRole('dialog', { name: '应用已创建' })).toBeVisible();
    await expect(page.getByText(/以下密钥只显示一次/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '应用已创建' })).toBeHidden();

    const appRow = page.getByRole('row').filter({ hasText: appName }).first();
    await expect(appRow).toBeVisible();
    await appRow.getByRole('button', { name: '查看' }).click();
    await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: '应用详情' })).toBeVisible();
    await expect(page.getByText(appName)).toBeVisible();
    await expect(page.getByText('API key 状态')).toBeVisible();

    await page.getByRole('tab', { name: '接入配置' }).click();
    await expect(page.getByText('允许来源')).toBeVisible();

    await page.getByRole('tab', { name: '权限注册' }).click();
    await expect(page.getByText('该应用还没有注册权限点')).toBeVisible();

    const applicationId = new URL(page.url()).pathname.split('/').at(-1);
    await page.goto(`/applications/onboarding?applicationId=${applicationId}`);
    await expect(page).toHaveURL(/\/applications\/onboarding\?applicationId=/);
    await expect(page.getByText('应用接入向导')).toBeVisible();
    await expect(page.getByText(appName)).toBeVisible();
    await page.getByRole('button', { name: /运行接入检查/ }).click();
    await expect(page.getByText(/当前页面未发现已注册权限点/)).toBeVisible();
  });
});
