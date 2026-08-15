import { expect, test } from '@playwright/test';

/**
 * Live regression check for the 2026-08-15 SearchAddTable consolidation: the "Bulk Adjust" item
 * search on /adjustments (previously a bespoke ItemSearchInput usage) now uses shared-ui-lib's
 * SearchAddTable. Verifies the same "search → click a result → clears" contract holds for this
 * migrated flow, plus that the picked item lands in the bulk list (a real behavior check, not
 * just a clear-box check). Read-only: opens the picker, adds one item, never submits the
 * adjustment, so no backend cleanup is needed.
 */

const EMAIL = process.env.E2E_LOGIN_EMAIL || 'demo@bengobox.dev';
const PASSWORD = process.env.E2E_LOGIN_PASSWORD || 'DemoUser2024!';
const ORG = process.env.E2E_ORG_SLUG || 'urban-loft';

async function ssoLogin(page: import('@playwright/test').Page) {
  await page.goto(`/${ORG}/`, { waitUntil: 'domcontentloaded' });
  const alreadyAuthed = await page.getByText(/dashboard|inventory/i).first().isVisible().catch(() => false);
  if (alreadyAuthed) return;
  const signInLink = page.getByRole('link', { name: /sign in|login/i }).first();
  await signInLink.click({ timeout: 15_000 }).catch(() => {});
  const onAccounts = await page.waitForURL(/accounts\.codevertexitsolutions\.com\/login/, { timeout: 20_000 }).then(() => true).catch(() => false);
  if (onAccounts) {
    await page.getByRole('textbox', { name: /email/i }).fill(EMAIL);
    await page.getByRole('textbox', { name: /password/i }).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/inventory\.codevertexitsolutions\.com|inventory\.codevertexafrica\.com|localhost/, { timeout: 30_000 }).catch(() => {});
  }
  const authedContent = page.getByRole('link', { name: /dashboard|profile/i }).or(page.getByText(/dashboard|inventory/i));
  await expect(authedContent.first()).toBeVisible({ timeout: 20_000 });
}

test('Bulk Adjust item search clears after picking a result', async ({ page }) => {
  test.setTimeout(90_000);
  await ssoLogin(page);

  // Grab a real item's name/sku straight from the already-rendered, already-authenticated
  // catalog table (no separate API call / token plumbing needed — sidesteps localStorage
  // auth-shape assumptions entirely).
  await page.goto(`/${ORG}/catalog`, { waitUntil: 'domcontentloaded' });
  const firstRow = page.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 20_000 });
  const rowText = (await firstRow.innerText()).trim();
  const itemName = rowText.split('\n')[0].trim();
  expect(itemName.length, `expected a real item name from the catalog table, got "${rowText}"`).toBeGreaterThan(1);

  await page.getByRole('link', { name: /^Adjustments$/i }).click();
  await page.waitForURL(/\/adjustments/, { timeout: 15_000 });
  await page.getByRole('button', { name: /bulk adjust/i }).click();
  await expect(page.getByText(/pick items/i)).toBeVisible({ timeout: 15_000 });

  const search = page.getByPlaceholder(/search items to add/i);
  await search.fill(itemName);
  const resultRow = page.getByText(itemName, { exact: false }).first();
  await expect(resultRow).toBeVisible({ timeout: 10_000 });
  await resultRow.click();

  await expect(search).toHaveValue('', { timeout: 5_000 });
  await expect(page.getByText(itemName, { exact: false })).toBeVisible(); // now in the bulk list
});
