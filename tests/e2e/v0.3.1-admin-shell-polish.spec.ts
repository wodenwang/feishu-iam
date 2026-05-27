import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.describe('v0.3.1 Admin Shell polish', () => {
  test('keeps runtime labels low-noise and toggles side navigation', async ({ page }, testInfo) => {
    const screenshotDir = 'design/implementation-screenshots/v0.3.1-admin-shell-polish';
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

    await expect(page).toHaveURL(/\/applications/);
    await expect(page.getByRole('button', { name: /打开用户菜单/ })).toBeVisible();
    await expect(page.getByText('HTTP runtime')).toHaveCount(0);
    await expect(page.getByText('生产环境')).toHaveCount(0);
    await page.screenshot({ path: `${screenshotDir}/admin-shell-${testInfo.project.name}.png`, fullPage: true });

    const collapseButton = page.getByRole('button', { name: '收起侧边导航' });
    const expandButton = page.getByRole('button', { name: '展开侧边导航' });
    if (await collapseButton.isVisible()) {
      await collapseButton.click();
      await expect(expandButton).toBeVisible();
    } else {
      await expect(expandButton).toBeVisible();
      await expandButton.click();
      await expect(collapseButton).toBeVisible();
    }
    await page.screenshot({ path: `${screenshotDir}/admin-shell-collapsed-${testInfo.project.name}.png`, fullPage: true });

    await page.getByRole('button', { name: /打开用户菜单/ }).click();
    await expect(page.getByText('HTTP runtime')).toBeVisible();
    await expect(page.getByText('生产环境')).toBeVisible();
  });
});
