import { expect, test } from '@playwright/test';
import { DEMO_OUTLETS, expandSidebarGroup, goToViaSidebar, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Documentation screenshots for "Purchasing & Receiving": Purchase Orders -> Goods Receipts
// (both the one-click "Mark Received" and the fuller line-level GRN flow) -> Purchase Returns.
// Not a regression suite. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 pnpm test:e2e -- e2e/docs-capture/procurement.spec.ts --headed

const OUT = (name: string) => assetPath('procurement', name);

test.describe('Docs capture: Purchasing & Receiving', () => {
  test('New Purchase Order (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Procurement');
    await goToViaSidebar(page, 'Purchase Orders');

    await page.getByRole('button', { name: 'New Order' }).click();
    await expect(page.getByText('New Purchase Order')).toBeVisible();

    const supplierTrigger = page.getByRole('button', { name: /select supplier/i });
    if (await supplierTrigger.isVisible().catch(() => false)) {
      await supplierTrigger.click();
      const demoDistributor = page.getByText('Demo Distributor Co.');
      if (await demoDistributor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await demoDistributor.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
    await screenshotWithCallouts(page, OUT('01-po-supplier-warehouse.png'), []);

    const lineItemSearch = page.getByPlaceholder('Search item to add...');
    await lineItemSearch.scrollIntoViewIfNeeded();
    await lineItemSearch.fill('Sugar');
    await page.waitForTimeout(600);
    const firstResult = page.getByRole('option').first();
    if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstResult.click();
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

    const firstRow = page.getByRole('row').nth(1);
    if (await firstRow.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await firstRow.click();
      await screenshotWithCallouts(page, OUT('04-po-detail-drawer.png'), []);
    }
  });

  test('Goods Receipts — line-level receiving (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Procurement');
    await goToViaSidebar(page, 'Goods Receipts');
    await expect(page.getByText('Goods Receipts')).toBeVisible({ timeout: 10_000 });
    await screenshotWithCallouts(page, OUT('05-goods-receipts-list.png'), []);

    const newReceipt = page.getByRole('button', { name: 'New Goods Receipt' });
    if (await newReceipt.isVisible().catch(() => false)) {
      await newReceipt.click();
      await expect(page.getByText('New Goods Receipt')).toBeVisible({ timeout: 8_000 });
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
    await screenshotWithCallouts(page, OUT('07-returns-list.png'), []);

    const newReturn = page.getByRole('button', { name: 'New Return' });
    if (await newReturn.isVisible().catch(() => false)) {
      await newReturn.click();
      await expect(page.getByText('New Purchase Return')).toBeVisible();
      const itemSearch = page.getByPlaceholder('Search item…');
      if (await itemSearch.isVisible().catch(() => false)) {
        await screenshotWithCallouts(page, OUT('08-new-return-form.png'), [{ locator: itemSearch, number: 1 }]);
      }
      await page.getByRole('button', { name: /cancel/i }).click().catch(() => {});
    }
  });
});
