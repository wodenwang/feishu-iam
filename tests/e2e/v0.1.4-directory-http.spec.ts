import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.describe('v0.1.4 Directory HTTP mode', () => {
  test('browses runtime-backed directory users with department filtering and detail drawer', async ({ page }, testInfo) => {
    const screenshotDir = 'design/implementation-screenshots/v0.1.4-directory';
    await mkdir(screenshotDir, { recursive: true });

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

    await page.goto('/directory');
    await expect(page.getByRole('button', { name: /打开用户菜单/ })).toBeVisible();
    await expect(page.getByText('部门树')).toBeVisible();
    await expect(page.getByText('用户列表')).toBeVisible();
    await expect(page.getByRole('table')).toContainText('ou_v012_verify_admin');
    await page.screenshot({ path: `${screenshotDir}/directory-${testInfo.project.name}.png`, fullPage: true });

    const adminRow = page.getByRole('row', { name: /ou_v012_verify_admin/ });
    await adminRow.getByRole('button', { name: /查看详情/ }).click();
    const detailDrawer = page.getByRole('dialog', { name: '用户详情' });
    await expect(detailDrawer).toBeVisible();
    await expect(detailDrawer.getByText(/飞书 user_id：ou_v012_verify_admin/)).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/directory-detail-${testInfo.project.name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByTitle('IT 部 (0)').click();
    await expect(page.getByText('该部门暂无已同步用户')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/directory-empty-${testInfo.project.name}.png`, fullPage: true });
  });
});
