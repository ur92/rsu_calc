import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
  test('landing shell loads with no uncaught JS errors', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
    });

    await page.goto('/');

    // Title contains app name
    await expect(page).toHaveTitle(/JFrog/);

    // File upload drop-zone is present on landing
    await expect(page.locator('input[type="file"][accept=".xlsx"]')).toBeAttached();
    await expect(
      page.getByText('גרור קובץ ByBenefitType_expanded לכאן', { exact: true }),
    ).toBeVisible();

    // Salary input is visible before any file is loaded
    await expect(
      page.locator('label', { hasText: 'שכר שנתי ברוטו' }).locator('xpath=ancestor::div[1]').getByPlaceholder('300'),
    ).toBeVisible();

    // No uncaught JS errors on the landing page
    expect(jsErrors, jsErrors.join('\n')).toEqual([]);
  });
});
