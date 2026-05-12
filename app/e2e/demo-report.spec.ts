import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_XLSX = path.join(__dirname, '..', '..', 'sample_data', 'demo_ByBenefitType_expanded.xlsx');

/** Parse a formatted he-IL ₪ amount (digits + grouping) to a number. */
function ilsAmountToNumber(text: string): number {
  const normalized = text.replace(/[\u200e\u200f]/g, '').trim();
  const digits = normalized.replace(/[^\d]/g, '');
  return digits ? Number(digits) : NaN;
}

/** Open the PriceSimulator panel — idempotent: no-op if already open. */
async function openPriceSimulator(page: import('@playwright/test').Page) {
  const panelLabel = page.getByText('מחיר FROG', { exact: true });
  if (await panelLabel.isVisible()) return;
  await page.locator('button').filter({ hasText: 'FROG' }).first().click();
  await expect(panelLabel).toBeVisible();
}

async function setPriceAndRate(page: import('@playwright/test').Page, priceUsd: number, rate: number) {
  await openPriceSimulator(page);
  const priceInput = page
    .locator('label', { hasText: 'מחיר FROG' })
    .locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]')
    .getByRole('spinbutton');
  const rateInput = page
    .locator('label', { hasText: 'שער ₪/$' })
    .locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]')
    .getByRole('spinbutton');
  await priceInput.fill(String(priceUsd));
  await priceInput.blur();
  await rateInput.fill(String(rate));
  await rateInput.blur();
}

/** Open the SalaryInput panel — idempotent: no-op if already open. */
async function setAnnualSalaryNis(page: import('@playwright/test').Page, nis: number) {
  const salaryLabel = page.locator('label', { hasText: 'שכר שנתי ברוטו' }).first();
  const isOpen = await salaryLabel.isVisible();
  if (!isOpen) {
    await page.getByRole('button', { name: /שכר ומקורות הכנסה/ }).click();
    await expect(salaryLabel).toBeVisible();
  }
  const thousands = nis / 1000;
  const salarySpin = page
    .locator('label', { hasText: 'שכר שנתי ברוטו' })
    .locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]')
    .getByRole('spinbutton');
  await expect(salarySpin).toBeVisible();
  await salarySpin.fill(String(thousands));
  await salarySpin.blur();
}

async function readAvailNowNetNis(page: import('@playwright/test').Page): Promise<number> {
  const card = page.locator('div.rounded-2xl').filter({ hasText: 'זמין עכשיו למכירה' }).first();
  await expect(card).toBeVisible();
  // Target the net-value paragraph by its font-bold class — more robust than nth(1)
  // which would silently shift if a badge or sub-heading is inserted before the value.
  const valueLine = card.locator('p.font-bold').first();
  await expect(valueLine).toBeVisible();
  const raw = await valueLine.textContent();
  return ilsAmountToNumber(raw ?? '');
}

test.describe('demo report', () => {
  test('full flow from demo xlsx matches expected holdings and net range', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[type="file"]')).toBeAttached();
    await page.locator('input[type="file"]').setInputFiles(DEMO_XLSX);
    await page.getByRole('button', { name: 'חשב', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'RSU Grants' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'אופציות (NQ)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ESPP' })).toBeVisible();

    await setPriceAndRate(page, 50, 3.6);
    await setAnnualSalaryNis(page, 300_000);

    // Scope table-row assertions to their dedicated sections to avoid matching
    // the same grant ID in FutureVestsTable or AvailableNowTable.
    const rsuSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'RSU Grants', exact: true }),
    });
    const rsuRow = rsuSection.locator('tr').filter({ hasText: 'RSU-2021-001' });
    await expect(rsuRow).toBeVisible();
    await expect(rsuRow).toContainText('600');

    const optSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'אופציות (NQ)', exact: true }),
    });
    const optRow = optSection.locator('tr').filter({ hasText: 'OPT-2019-001' });
    await expect(optRow).toBeVisible();
    await expect(optRow).toContainText('$20.00');
    await expect(optRow).toContainText('500');

    const esppSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'ESPP', exact: true }),
    });
    await expect(esppSection.locator('tbody tr')).toHaveCount(2);

    await expect(page.getByRole('heading', { name: /עדיפויות למכירה/ })).toBeVisible();

    const availNet = await readAvailNowNetNis(page);
    expect(availNet, `avail net parsed as ${availNet}`).toBeGreaterThanOrEqual(140_000);
    expect(availNet).toBeLessThanOrEqual(165_000);

    // Change price to 40 and confirm the net total decreases
    await openPriceSimulator(page); // idempotent — no-op if already open
    const priceInput = page
      .locator('label', { hasText: 'מחיר FROG' })
      .locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]')
      .getByRole('spinbutton');
    await priceInput.fill('40');
    await priceInput.blur();

    await expect.poll(async () => readAvailNowNetNis(page)).toBeLessThan(availNet);
  });
});
