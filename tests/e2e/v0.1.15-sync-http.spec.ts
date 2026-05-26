import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.describe('v0.1.15 Sync HTTP mode', () => {
  test('runs manual directory sync and shows synced users', async ({ page }, testInfo) => {
    const screenshotDir = 'design/implementation-screenshots/v0.1.15-feishu-directory-sync-runtime';
    await mkdir(screenshotDir, { recursive: true });

    await page.goto('/login');
    await expect(page.getByText(/HTTP runtime|生产环境/).first()).toBeVisible();

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

    await page.goto('/sync');
    await expect(page.getByRole('heading', { name: '飞书同步' })).toBeVisible();
    await page.getByRole('button', { name: /手动同步/ }).click();
    await expect(page.getByRole('row', { name: /成功/ }).first()).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/sync-runtime-${testInfo.project.name}.png`, fullPage: true });

    await page.goto('/directory');
    await expect(page.getByRole('heading', { name: '组织与用户' })).toBeVisible();
    await expect(page.getByText('本地同步用户一号')).toBeVisible();
    await expect(page.getByText('本地同步用户二号')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/directory-after-sync-${testInfo.project.name}.png`, fullPage: true });
  });
});
