import { test, expect } from '@playwright/test';

test.describe('Sydney Console dashboard smoke tests', () => {
  test('dashboard loads and shows core surfaces', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText(/Sydney Console/i).first()).toBeVisible();

    await expect(page.getByText(/Today/i).first()).toBeVisible();
    await expect(page.getByText(/Board/i).first()).toBeVisible();
    await expect(page.getByText(/AI Tools/i).first()).toBeVisible();
    await expect(page.getByText(/Review/i).first()).toBeVisible();
  });

  test('AI and Discord surfaces stay manual/draft oriented', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByText(/AI Tools/i).first().click();

    await expect(page.getByText(/draft|manual|approval|approved/i).first()).toBeVisible();
    await expect(page.getByText(/discord/i).first()).toBeVisible();
  });
});
