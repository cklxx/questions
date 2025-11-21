import { test, expect } from '@playwright/test';

const topicPlaceholder = '要解释的核心概念';

test.describe('问题模版平台', () => {
  test('loads templates and allows filling & copying a prompt', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('问题模版平台 · React 版')).toBeVisible();
    const firstCard = page.locator('.template-card').first();
    await expect(firstCard).toContainText('知识解释 + 受众适配');
    await firstCard.click();

    await page.getByPlaceholder(topicPlaceholder).fill('量子计算');

    await page.getByRole('button', { name: '✨ 一键 AI 补全' }).click();
    await expect(page.getByText(/已应用 AI 建议|字段/)).toBeVisible();

    const preview = page.locator('.preview-box');
    await expect(preview).toContainText('量子计算');

    await page.getByRole('button', { name: '📋 复制 Prompt' }).click();
    await expect(page.getByText('已复制 Prompt')).toBeVisible();
  });
});
