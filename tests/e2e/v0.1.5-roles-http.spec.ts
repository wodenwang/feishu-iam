import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.describe('v0.1.5 Roles HTTP mode', () => {
  test('creates, authorizes, and disables a runtime-backed role', async ({ page }, testInfo) => {
    const screenshotDir = 'design/implementation-screenshots/v0.1.5-roles-http';
    await mkdir(screenshotDir, { recursive: true });
    const suffix = `${testInfo.project.name}-${Date.now()}`;
    const appName = `Roles HTTP Demo ${suffix}`;
    const roleName = `角色 HTTP ${suffix}`;
    const roleCode = `role-http-${suffix}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

    await page.goto('/login');
    await expect(page.getByText('HTTP runtime')).toBeVisible();

    await page.getByRole('button', { name: '使用本地 mock 飞书登录' }).click();
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

    await page.getByRole('button', { name: '创建应用' }).click();
    await page.getByLabel('应用名称').fill(appName);
    await page.getByRole('button', { name: /提\s*交/ }).click();
    await expect(page.getByRole('dialog', { name: '应用已创建' })).toBeVisible();
    await page.getByRole('button', { name: /我已保存/ }).click();

    await page.goto('/roles');
    await expect(page.getByText('HTTP runtime')).toBeVisible();
    await expect(page.getByRole('heading', { name: '角色授权' })).toBeVisible();

    await page.getByRole('button', { name: /新建角色/ }).click();
    const drawer = page.getByRole('dialog', { name: '新建角色' });
    await expect(drawer).toBeVisible();
    await drawer.getByPlaceholder('例如：销售主管').fill(roleName);
    await drawer.getByPlaceholder('例如：sales-manager').fill(roleCode);
    await drawer.getByRole('button', { name: /保\s*存/ }).click();
    await expect(page.getByText(roleName)).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/roles-${testInfo.project.name}.png`, fullPage: true });

    await page.getByRole('row', { name: new RegExp(roleName) }).getByRole('button', { name: '配置授权' }).click();
    const authDrawer = page.getByRole('dialog', { name: new RegExp(`配置授权：${roleName}`) });
    await expect(authDrawer).toBeVisible();
    await authDrawer.getByRole('button', { name: /保存授权/ }).click();
    await expect(page.getByText('授权变更摘要')).toBeVisible();
    await page.getByRole('button', { name: /确认保存授权/ }).click();
    await expect(page.getByText('授权配置已保存')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/roles-authorization-${testInfo.project.name}.png`, fullPage: true });

    const roleRow = page.getByRole('row', { name: new RegExp(roleName) });
    await roleRow.getByRole('checkbox').check();
    await page.getByRole('button', { name: /批量停用/ }).click();
    await expect(page.getByText(/确认停用已选中的 1 个角色/)).toBeVisible();
    await page.getByRole('button', { name: '确认停用' }).click();
    await expect(page.getByText('角色已停用')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/roles-disabled-${testInfo.project.name}.png`, fullPage: true });
  });
});
