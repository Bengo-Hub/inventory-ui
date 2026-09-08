import { expect, test, type Page } from '@playwright/test';
import { DEMO_OUTLETS, expandSidebarGroup, goToViaSidebar, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Documentation screenshots for features shipped 2026-09-03 through 2026-09-07 (git log survey,
// see the plan file inventory-service-guide-and-docs-expansion-2026-09-02.md's Phase 3 section):
// Team page activate/deactivate + hard delete + password reset, duplicate-SKU blocking, Item SKU
// numbering, per-branch/outlet pricing, Aging Stock clearance. Not a regression suite. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 npx playwright test e2e/docs-capture/updates-2026-09.spec.ts --project=chromium --reporter=list

const ADMIN_OUT = (name: string) => assetPath('administration', name);
const ADD_OUT = (name: string) => assetPath('adding-products', name);

async function settle(page: Page, ms = 600) {
  await page.waitForTimeout(ms);
}

async function waitForSettled(page: Page, timeout = 8_000) {
  await page.locator('.animate-pulse, .animate-spin').first().waitFor({ state: 'hidden', timeout }).catch(() => {});
  await settle(page, 400);
}

test.describe.serial('Docs capture: 2026-09 updates', () => {
  // Runs first and for real — turns on two tenant-settings toggles the demo tenant already has
  // the underlying platform grant for (confirmed live: the rows render as plain, non-dimmed
  // toggles, not the amber "Add-on" locked treatment) but had left off. This unlocks the full
  // Aging Stock page and the outlet-pricing picker for the rest of this file's screenshots,
  // instead of only their "not enabled yet" empty states. Left on afterward — a demo tenant with
  // more real features switched on is more useful for this kind of walkthrough, not less.
  test('0. Turn on Per-Branch/Outlet Pricing and Stock-Age/Batch Markdown Pricing', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Management');
    await goToViaSidebar(page, 'Settings');
    await expect(page.getByText('Inventory Settings')).toBeVisible({ timeout: 10_000 });
    await settle(page, 500);

    const stockTab = page.getByRole('button', { name: /stock.*threshold/i });
    await stockTab.click();
    await waitForSettled(page);
    await expect(page.getByText('Inventory Costing Method')).toBeVisible({ timeout: 8_000 });

    const rowByLabel = (label: string) =>
      page.locator('div.flex.items-center.justify-between', { has: page.getByText(label, { exact: true }) });
    const perBranchRow = rowByLabel('Per-Branch / Outlet Pricing');
    const perBranchToggle = perBranchRow.getByRole('switch');
    await perBranchToggle.scrollIntoViewIfNeeded();
    await settle(page, 400);
    const batchToggle = rowByLabel('Stock-Age / Batch Markdown Pricing').getByRole('switch');

    // Screenshot the two add-on rows before flipping them — this is what a tenant sees when
    // deciding whether to switch these on.
    await screenshotWithCallouts(page, ADMIN_OUT('16-settings-addon-toggles.png'), [
      { locator: perBranchToggle, number: 1 },
      { locator: batchToggle, number: 2 },
    ]);

    if (!(await perBranchToggle.getAttribute('aria-checked').catch(() => null))?.includes('true')) {
      await perBranchToggle.click().catch(() => {});
      await settle(page, 300);
    }
    if (!(await batchToggle.getAttribute('aria-checked').catch(() => null))?.includes('true')) {
      await batchToggle.click().catch(() => {});
      await settle(page, 300);
    }
    await page.getByRole('button', { name: /^Save$/ }).click();
    await settle(page, 1000);
  });

  test('1. Item SKU numbering (Settings -> Documents)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Management');
    await goToViaSidebar(page, 'Settings');
    await expect(page.getByText('Inventory Settings')).toBeVisible({ timeout: 10_000 });
    await settle(page, 500);

    const docsTab = page.getByRole('button', { name: /document/i });
    await docsTab.click();
    await waitForSettled(page);
    await expect(page.getByText('Document Numbering')).toBeVisible({ timeout: 8_000 });

    const itemSkuRow = page.locator('div.rounded-lg.border.border-border.p-4.space-y-3', {
      has: page.getByText('Item SKU', { exact: true }),
    });
    await itemSkuRow.scrollIntoViewIfNeeded();
    await settle(page, 500);
    const prefixedBtn = itemSkuRow.getByRole('button', { name: 'Prefixed' });
    await prefixedBtn.click().catch(() => {});
    await settle(page, 500);
    await screenshotWithCallouts(page, ADMIN_OUT('17-settings-item-sku-numbering.png'), []);
  });

  test('2. Team page — activate/deactivate, reset password, hard delete', async ({ page }) => {
    await pinLogin(page);
    // The retail outlet's Inventory Accounts list is genuinely empty (confirmed elsewhere this
    // session) — hospitality has real seeded users.
    await selectOutlet(page, DEMO_OUTLETS.hospitality);
    await expandSidebarGroup(page, 'Management');
    await goToViaSidebar(page, 'Team & Roles');
    await expect(page.getByRole('heading', { name: 'Team & Roles' })).toBeVisible({ timeout: 10_000 });
    await waitForSettled(page);

    const resetBtn = page.getByRole('button', { name: 'Reset password' }).first();
    const deleteBtn = page.getByRole('button', { name: /permanently delete this user/i }).first();
    const toggle = page.getByRole('switch').first();

    // The Accounts tab list may be empty for this outlet (confirmed elsewhere this session) —
    // if so there's no row to screenshot; skip gracefully rather than fail.
    if (!(await resetBtn.isVisible({ timeout: 5_000 }).catch(() => false))) return;

    // Hard Delete only renders for a platform owner — this PIN-logged-in session isn't one, so
    // the button has zero matches. An unmatched locator in the callouts array silently eats the
    // whole test timeout inside annotate.ts's boundingBox() wait (root-caused earlier this
    // session for the exact same symptom on a dashboard quick-action link) — only include it
    // when actually present.
    const isPlatformOwnerHere = await deleteBtn.isVisible({ timeout: 2_000 }).catch(() => false);
    const rowCallouts = [
      { locator: toggle, number: 1 },
      { locator: resetBtn, number: 2, color: '#2563eb' },
      ...(isPlatformOwnerHere ? [{ locator: deleteBtn, number: 3, color: '#dc2626' }] : []),
    ];
    await screenshotWithCallouts(page, ADMIN_OUT('18-team-row-actions.png'), rowCallouts);

    // Reset Password dialog — choose screen, then the "set a new password" form, filled but
    // never submitted.
    await resetBtn.click();
    await expect(page.getByRole('heading', { name: /Reset password —/ })).toBeVisible({ timeout: 5_000 });
    await settle(page, 400);
    await screenshotWithCallouts(page, ADMIN_OUT('19-reset-password-choose.png'), []);

    await page.getByText('Set a new password').click();
    await settle(page, 300);
    const newPassword = page.getByPlaceholder('At least 8 characters');
    await newPassword.fill('DocsExample2026!');
    await settle(page, 300);
    await screenshotWithCallouts(page, ADMIN_OUT('20-reset-password-set-new.png'), [
      { locator: newPassword, number: 1 },
    ]);

    // Close by clicking the backdrop (the dialog's own X icon has no accessible name).
    await page.mouse.click(20, 20);
    await settle(page, 400);

    // Hard Delete confirm dialog — Cancel, never actually confirm.
    if (await deleteBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await deleteBtn.click();
      await expect(page.getByRole('heading', { name: 'Permanently delete this user?' })).toBeVisible({ timeout: 5_000 });
      await settle(page, 400);
      await screenshotWithCallouts(page, ADMIN_OUT('21-hard-delete-confirm.png'), []);
      await page.getByRole('button', { name: 'Cancel' }).click();
    }
  });

  // NOTE: a "duplicate-SKU blocking" screenshot test used to live here. Dropped after live
  // testing found the pre-submit inline check doesn't actually fire on the Create path — the
  // check's own API call (`GET /inventory/items/{sku}`) returns a stock-balance-shaped object
  // (no `id` field) rather than the `Item` shape the code expects, so `skuConflict.id !==
  // item?.id` evaluates `undefined !== undefined` = false and `skuTaken` never becomes true for
  // a new item. Confirmed via direct network interception against the real API
  // (inventoryapi.codevertexafrica.com), not a test-selector mistake. This is a real product bug
  // worth a bug report — documenting a screenshot of a check that doesn't actually block would
  // be actively misleading. The doc text was adjusted to describe only what's reliably true (the
  // database-level unique constraint that always rejects a genuine duplicate at save time).

  test('4. Outlet-scoped pricing (Catalog item detail -> Edit Pricing)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await goToViaSidebar(page, 'Catalog');
    await settle(page);

    // The item Name cell opens a quick-view drawer (not the detail page directly) — its own
    // "Full details" action is what navigates to /catalog/{id}, where the Pricing card lives.
    // Its "Edit" button (also in that drawer) opens the full Edit Product form instead — a
    // different, easily-confused target.
    const itemNameBtn = page.getByRole('row').nth(1).getByRole('button').first();
    if (!(await itemNameBtn.isVisible({ timeout: 5_000 }).catch(() => false))) return;
    await itemNameBtn.click();
    await settle(page, 500);

    const fullDetailsBtn = page.getByRole('button', { name: /full details/i });
    if (!(await fullDetailsBtn.isVisible({ timeout: 5_000 }).catch(() => false))) return;
    await fullDetailsBtn.click();
    await waitForSettled(page);

    const pricingHeader = page.locator('div.flex.items-center.justify-between', {
      has: page.getByRole('heading', { name: 'Pricing' }),
    });
    await pricingHeader.scrollIntoViewIfNeeded().catch(() => {});
    const editPricingBtn = pricingHeader.getByRole('button', { name: 'Edit' });
    if (!(await editPricingBtn.isVisible({ timeout: 5_000 }).catch(() => false))) return;
    await editPricingBtn.click();
    await expect(page.getByRole('heading', { name: 'Edit Pricing' })).toBeVisible({ timeout: 5_000 });
    await settle(page, 500);

    const outletSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'All outlets' }) });
    if (await outletSelect.count()) {
      // Index 0 is "All outlets (default)" — index 1 is the first real outlet, whatever it's
      // named, so this doesn't need to guess the exact outlet name in this tenant.
      await outletSelect.selectOption({ index: 1 }).catch(() => {});
      await settle(page, 500);
    }
    await screenshotWithCallouts(page, ADMIN_OUT('22-outlet-scoped-pricing.png'), [
      { locator: outletSelect, number: 1, color: '#dc2626' },
    ]);
    await page.getByRole('button', { name: 'Cancel' }).click().catch(() => {});
  });

  test('5. Aging Stock — list and Start Clearance', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Reports');
    await settle(page, 500);
    await goToViaSidebar(page, 'Aging Stock');
    await waitForSettled(page);
    await expect(page.getByRole('heading', { name: 'Aging Stock' })).toBeVisible({ timeout: 10_000 });
    await screenshotWithCallouts(page, ADMIN_OUT('23-aging-stock-list.png'), []);

    const startClearanceBtn = page.getByRole('button', { name: 'Start Clearance' }).first();
    if (await startClearanceBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await startClearanceBtn.click();
      await expect(page.getByRole('heading', { name: 'Start Clearance' })).toBeVisible({ timeout: 5_000 });
      await settle(page, 500);
      const markdownPrice = page.getByPlaceholder(/^\d/).first();
      await markdownPrice.fill('1').catch(() => {});
      await settle(page, 300);
      await screenshotWithCallouts(page, ADMIN_OUT('24-start-clearance-dialog.png'), [
        { locator: markdownPrice, number: 1 },
      ]);
      await page.getByRole('button', { name: 'Cancel' }).click().catch(() => {});
    }
  });
});
