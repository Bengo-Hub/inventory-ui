import { expect, test, type Page } from '@playwright/test';
import { DEMO_OUTLETS, goToViaSidebar, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Documentation screenshots for "Warehouses & Stock" — the module that contains the actual fix
// for a product created with zero stock (New Adjustment, reason "Initial Stock Count"). Not a
// regression suite. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 pnpm test:e2e -- e2e/docs-capture/warehouses-and-stock.spec.ts --headed

const OUT = (name: string) => assetPath('warehouses-and-stock', name);

test.describe('Docs capture: Warehouses & Stock', () => {
  test('New Warehouse + Locations (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await goToViaSidebar(page, 'Warehouses');

    const newWarehouseBtn = page.getByRole('button', { name: /new warehouse|add your first warehouse/i }).first();
    await newWarehouseBtn.click();
    const nameInput = page.getByPlaceholder('e.g. Main Warehouse');
    const codeInput = page.getByPlaceholder('e.g. WH-MAIN');
    const addressInput = page.getByPlaceholder('Street address (optional)');
    await expect(nameInput).toBeVisible();

    await nameInput.fill('Docs Example Warehouse');
    await codeInput.fill('DOCS-WH');
    await screenshotWithCallouts(page, OUT('01-new-warehouse.png'), [
      { locator: nameInput, number: 1 },
      { locator: codeInput, number: 2 },
      { locator: addressInput, number: 3 },
    ]);
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Open Locations on the first existing warehouse card (no data created).
    const manageLocations = page.getByRole('button', { name: /manage locations/i }).first();
    if (await manageLocations.isVisible().catch(() => false)) {
      await manageLocations.click();
      await expect(page.getByText('Warehouse Locations')).toBeVisible({ timeout: 10_000 });
      await screenshotWithCallouts(page, OUT('02-locations-tree.png'), []);

      const addLocation = page.getByRole('button', { name: /add location|add first location/i }).first();
      if (await addLocation.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addLocation.click();
        const zoneName = page.getByPlaceholder('e.g. Zone A');
        const zoneCode = page.getByPlaceholder('e.g. ZONE-A');
        await zoneName.fill('Docs Example Zone');
        await zoneCode.fill('DOCS-ZONE');
        await screenshotWithCallouts(page, OUT('03-add-location.png'), [
          { locator: zoneName, number: 1 },
          { locator: zoneCode, number: 2 },
        ]);
        await page.getByRole('button', { name: 'Cancel' }).click();
      }
    }
  });

  test('Stock Levels page (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await goToViaSidebar(page, 'Stock Levels');
    await expect(page).toHaveURL(/\/stock(\/)?($|\?)/, { timeout: 10_000 });
    await screenshotWithCallouts(page, OUT('04-stock-levels.png'), []);
  });

  test('Stock Adjustments — full "fix a zero-stock item" walkthrough (retail outlet)', async ({ page }: { page: Page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await goToViaSidebar(page, 'Adjustments');

    await page.getByRole('button', { name: 'New Adjustment' }).click();
    await expect(page.getByText('New Stock Adjustment')).toBeVisible();
    const addBtn = page.getByRole('button', { name: 'Add Stock' });
    const removeBtn = page.getByRole('button', { name: 'Remove Stock' });
    await screenshotWithCallouts(page, OUT('05-adjustment-add-remove-toggle.png'), [
      { locator: addBtn, number: 1 },
      { locator: removeBtn, number: 2 },
    ]);

    const itemSearch = page.getByPlaceholder('Search by name or SKU...');
    await itemSearch.fill('Sugar');
    await page.waitForTimeout(600);
    const firstResult = page.getByRole('option').first().or(page.getByRole('button').filter({ hasText: /sugar/i }).first());
    if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstResult.click();
    }
    await screenshotWithCallouts(page, OUT('06-adjustment-item-search.png'), [{ locator: itemSearch, number: 1 }]);

    const qtyInput = page.getByPlaceholder('0').first();
    await qtyInput.fill('10');
    await screenshotWithCallouts(page, OUT('07-adjustment-quantity-warehouse.png'), [{ locator: qtyInput, number: 1 }]);

    const reasonSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Initial Stock Count' }) });
    if (await reasonSelect.count()) {
      await reasonSelect.selectOption({ label: 'Initial Stock Count' });
      await screenshotWithCallouts(page, OUT('08-adjustment-reason-initial-stock-count.png'), [
        { locator: reasonSelect.first(), number: 1, color: '#dc2626' },
      ]);
    } else {
      await screenshotWithCallouts(page, OUT('08-adjustment-reason-initial-stock-count.png'), []);
    }

    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
