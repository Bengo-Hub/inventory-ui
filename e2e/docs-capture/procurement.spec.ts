import { expect, test, type Page } from '@playwright/test';
import { DEMO_OUTLETS, expandSidebarGroup, goToViaSidebar, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Documentation screenshots for "Purchasing & Receiving": Purchase Orders -> Goods Receipts
// (both the one-click "Mark Received" and the fuller line-level GRN flow) -> Purchase Returns.
// Not a regression suite. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 pnpm test:e2e -- e2e/docs-capture/procurement.spec.ts --headed
//
// Every wait here is deliberate: codevertex-demo's Purchase Orders list and the PO detail drawer
// both render a skeleton (.animate-pulse) before their real data arrives, and an early screenshot
// silently captured the skeleton (or, worse, the previous page) more than once in this suite's
// history. waitForSettled() below is the shared fix.

const OUT = (name: string) => assetPath('procurement', name);

async function waitForSettled(page: Page, timeout = 8_000) {
  await page.locator('.animate-pulse, .animate-spin').first().waitFor({ state: 'hidden', timeout }).catch(() => {});
  await page.waitForTimeout(500);
}

test.describe('Docs capture: Purchasing & Receiving', () => {
  test('New Purchase Order (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Procurement');
    await goToViaSidebar(page, 'Purchase Orders');

    await page.getByRole('button', { name: 'New Order' }).click();
    await expect(page.getByText('New Purchase Order')).toBeVisible();
    await page.waitForTimeout(500);

    const supplierTrigger = page.getByRole('button', { name: /select supplier/i });
    if (await supplierTrigger.isVisible().catch(() => false)) {
      await supplierTrigger.click();
      await page.waitForTimeout(400);
      const demoDistributor = page.getByText('Demo Distributor Co.');
      if (await demoDistributor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await demoDistributor.click();
        await page.waitForTimeout(400);
      } else {
        await page.keyboard.press('Escape');
      }
    }
    await screenshotWithCallouts(page, OUT('01-po-supplier-warehouse.png'), []);

    // A real seeded item, confirmed present for Demo City Supermarket — not "Sugar" or "Docs
    // Example," neither of which exist in this outlet's actual catalog.
    const lineItemSearch = page.getByPlaceholder('Search item to add...');
    await lineItemSearch.scrollIntoViewIfNeeded();
    await lineItemSearch.fill('Hair');
    await page.waitForTimeout(800);
    const firstResult = page.getByRole('option').first();
    if (await firstResult.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstResult.click();
      await page.waitForTimeout(500);
    }
    await screenshotWithCallouts(page, OUT('03-po-line-items.png'), [{ locator: lineItemSearch, number: 1 }]);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Purchase Order detail — status & receive actions (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Procurement');
    await goToViaSidebar(page, 'Purchase Orders');
    await expect(page.getByRole('button', { name: 'New Order' })).toBeVisible({ timeout: 10_000 });
    await waitForSettled(page);

    const firstRow = page.getByRole('row').nth(1);
    if (await firstRow.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await firstRow.click();
      // Wait for a button that's present on the drawer regardless of the PO's status (the
      // status-specific actions checked here previously assumed a Draft/Sent order — the real
      // first row can be in any status, including one with none of those three). Every row in
      // the list ALSO has its own Print/Export icon button, so this only matches uniquely once
      // scoped to the sliding drawer panel itself (Sheet's right-side panel, no role/dialog
      // semantics of its own — see ui/sheet.tsx).
      const drawer = page.locator('.fixed.top-0.right-0');
      await expect(drawer.getByRole('button', { name: /print.*export/i })).toBeVisible({ timeout: 10_000 });
      await waitForSettled(page);
      await screenshotWithCallouts(page, OUT('04-po-detail-drawer.png'), []);
    }
  });

  test('Goods Receipts — line-level receiving (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Procurement');
    await goToViaSidebar(page, 'Goods Receipts');
    // getByText('Goods Receipts') is ambiguous — it also matches the sidebar link itself.
    await expect(page.getByRole('heading', { name: 'Goods Receipts' })).toBeVisible({ timeout: 10_000 });
    await waitForSettled(page);
    await screenshotWithCallouts(page, OUT('05-goods-receipts-list.png'), []);

    const newReceipt = page.getByRole('button', { name: 'New Goods Receipt' });
    if (await newReceipt.isVisible().catch(() => false)) {
      await newReceipt.click();
      // getByText('New Goods Receipt') is ambiguous — also matches the button just clicked.
      await expect(page.getByRole('heading', { name: 'New Goods Receipt' })).toBeVisible({ timeout: 8_000 });
      await waitForSettled(page);
      const poSelect = page.getByText(/select a sent.*partially-received PO/i);
      if (await poSelect.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await screenshotWithCallouts(page, OUT('06-grn-select-po.png'), []);
      }
      await page.getByRole('button', { name: /cancel/i }).click().catch(() => {});
    }
  });

  test('Purchase Returns (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Procurement');
    await goToViaSidebar(page, 'Returns');
    await expect(page.getByText('Purchase Returns')).toBeVisible({ timeout: 10_000 });
    await waitForSettled(page);
    await screenshotWithCallouts(page, OUT('07-returns-list.png'), []);

    const newReturn = page.getByRole('button', { name: 'New Return' });
    if (await newReturn.isVisible().catch(() => false)) {
      await newReturn.click();
      await expect(page.getByText('New Purchase Return')).toBeVisible();
      await page.waitForTimeout(500);
      const itemSearch = page.getByPlaceholder('Search item…');
      if (await itemSearch.isVisible().catch(() => false)) {
        await screenshotWithCallouts(page, OUT('08-new-return-form.png'), [{ locator: itemSearch, number: 1 }]);
      }
      await page.getByRole('button', { name: /cancel/i }).click().catch(() => {});
    }
  });
});
