import { expect, test, type Page } from '@playwright/test';

// Regression coverage for two things fixed in the same session:
//  1. There was no dedicated Brands management page — added as a "Brands" tab on the
//     Categories page (/categories).
//  2. Creating a brand via the "+ New brand" picker inside the item form (Catalog → New
//     Item → GOODS → Brand) reset/closed the whole item form and never actually attached
//     the brand — root cause: AddBrandDialog's own <form> was nested inside the item form's
//     <form>, so its submit bubbled into the outer form's onSubmit and prematurely
//     saved/closed the item. Fixed by hoisting AddBrandDialog to render as a sibling of the
//     outer <form>, same as the existing Category/Unit/Supplier quick-create dialogs.
//
// Auth: PIN login (tenant admin PIN), not SSO — matches how this tenant is actually operated.

const origin = (process.env.BASE_URL || 'https://inventory.codevertexafrica.com').replace(/\/$/, '');
const orgSlug = process.env.E2E_ORG_SLUG || 'urban-loft';
// Inventory admin PIN is 7777 for this tenant (POS uses 1111 — different service, different PIN).
const ADMIN_PIN = process.env.E2E_ADMIN_PIN || '7777';

function url(path: string) {
  return `${origin}/${orgSlug}${path}`;
}

async function pinLogin(page: Page) {
  await page.goto(url('/auth/pin-login'));

  // Multi-outlet tenants show an outlet picker first; single-outlet tenants skip straight
  // to the PIN pad (auto-selected). Handle both.
  const outletPrompt = page.getByText(/select your outlet/i);
  const sawOutletPrompt = await outletPrompt.isVisible({ timeout: 5000 }).catch(() => false);
  if (sawOutletPrompt) {
    await page.getByRole('button').first().click();
  }

  // Click the numeric PIN keypad directly rather than simulating physical keystrokes —
  // the page's window-level keydown handler only routes digits to the PIN when focus
  // isn't inside a text <input>, which is timing-sensitive in a headless run. The keypad
  // digit buttons are unambiguous (only one numeric keypad is in the accessibility tree
  // at a time — the responsive duplicate is display:none at Playwright's default viewport).
  await page.waitForTimeout(300); // outlet → PIN pad transition
  for (const digit of ADMIN_PIN.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }

  await expect(page).toHaveURL(new RegExp(`/${orgSlug}(/)?($|\\?)`), { timeout: 20_000 });
}

// In-app navigation MUST go through client-side <Link> clicks, not page.goto(). inventory-ui's
// auth-provider fires a one-shot silent SSO probe (prompt=none) whenever it mounts on a non-/auth
// route before the PIN session rehydrates — a hard page.goto() reload re-triggers that mount race
// on every navigation and can bounce back to /auth/callback?error=login_required. See the
// sso-silent-probe-prompt-none project memory. A sidebar Link click stays in the same SPA session.
async function goToViaSidebar(page: Page, linkName: string) {
  await page.getByRole('link', { name: linkName, exact: true }).click();
}

test.describe('Brands', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (d) => d.accept()); // native confirm() on delete
    await pinLogin(page);
  });

  test('Brands tab on the Categories page supports create, edit, delete', async ({ page }) => {
    const brandName = `E2E Brand ${Date.now()}`;

    await goToViaSidebar(page, 'Categories');
    await page.getByRole('button', { name: 'Brands' }).click();

    await page.getByRole('button', { name: 'Add Brand' }).click();
    await page.getByPlaceholder('e.g. HP', { exact: true }).fill(brandName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByText('Brand created')).toBeVisible({ timeout: 10_000 });
    const row = page.getByRole('row', { name: new RegExp(brandName) });
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Edit
    await row.getByRole('button', { name: 'Edit brand' }).click();
    const descriptionBox = page.locator('textarea');
    await descriptionBox.fill('Updated by e2e');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByText('Brand updated')).toBeVisible({ timeout: 10_000 });

    // Delete (cleanup — mandatory per this project's e2e data-cleanup rule)
    await row.getByRole('button', { name: 'Delete brand' }).click();
    await expect(page.getByText('Brand deleted')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('row', { name: new RegExp(brandName) })).toHaveCount(0);
  });

  test('adding a brand from the item form does not reset or close the item dialog', async ({ page }) => {
    const itemName = `E2E Nested Form Test ${Date.now()}`;
    const brandName = `E2E Inline Brand ${Date.now()}`;

    await goToViaSidebar(page, 'Catalog');
    await page.getByRole('button', { name: 'New Item' }).click();

    const nameInput = page.getByPlaceholder('Item name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(itemName);

    // GOODS is the type that reveals the Brand field (hospitality's default type is RECIPE).
    const typeSelect = page.locator('select:has(option[value="GOODS"])');
    await typeSelect.selectOption('GOODS');

    const brandTrigger = page.getByRole('button', { name: 'Select a brand…' });
    await expect(brandTrigger).toBeVisible();
    await brandTrigger.click();
    await page.getByRole('button', { name: 'New brand' }).click();

    // AddBrandDialog — filling + submitting must NOT touch the item form underneath it. Both
    // forms are in the DOM at once (the item form stays mounted behind the overlay), each with
    // their own "Create" button, so scope to the brand dialog's own <form> specifically.
    const addBrandForm = page.locator('form').filter({ has: page.getByPlaceholder('e.g. HP', { exact: true }) });
    await addBrandForm.getByPlaceholder('e.g. HP', { exact: true }).fill(brandName);
    await addBrandForm.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText('Brand created')).toBeVisible({ timeout: 10_000 });

    // The regression: the item form used to submit/close here because the brand dialog's
    // <form> was nested inside it. Assert it's still open with our data intact.
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue(itemName);
    // The new brand is now selected in the picker (no longer showing the placeholder).
    await expect(page.getByRole('button', { name: brandName })).toBeVisible();

    // Don't actually submit the item — this test only needs to prove the brand-add flow
    // in isolation. Cancel out.
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Cleanup the brand created above (mandatory per this project's e2e data-cleanup rule).
    await goToViaSidebar(page, 'Categories');
    await page.getByRole('button', { name: 'Brands' }).click();
    const row = page.getByRole('row', { name: new RegExp(brandName) });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: 'Delete brand' }).click();
    await expect(page.getByText('Brand deleted')).toBeVisible({ timeout: 10_000 });
  });
});
