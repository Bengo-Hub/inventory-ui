import { expect, test, type Page } from '@playwright/test';
import { DEMO_OUTLETS, goToViaSidebar, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Documentation screenshots for the "Adding Products & Menu Items" shared-docs guide, not a
// regression suite — nothing here should fail CI. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 pnpm test:e2e -- e2e/docs-capture/catalog-items.spec.ts --headed
//
// The GOODS walkthrough runs in the retail outlet (matches an actual retail-shop client), since
// the item-type selector and its nomenclature ("Product" vs "Drug" vs "Item") depend on which
// outlet is active at login. Every field is filled in but the form is never submitted (Cancel at
// the end) — no data is created, so there's nothing to clean up per the project's e2e data rule.

const OUT = (name: string) => assetPath('adding-products', name);

async function openNewItem(page: Page) {
  await goToViaSidebar(page, 'Catalog');
  await page.getByRole('button', { name: /^New (Item|Product|Drug|Service)/i }).click();
  await expect(page.getByPlaceholder('Item name')).toBeVisible();
}

async function selectType(page: Page, value: string) {
  const typeSelect = page.locator(`select:has(option[value="${value}"])`);
  await typeSelect.selectOption(value);
}

function checkboxIn(page: Page, labelText: string) {
  return page.locator('label').filter({ hasText: labelText }).locator('input[type="checkbox"]');
}

test.describe('Docs capture: Catalog / New Item', () => {
  test('GOODS — full walkthrough (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await openNewItem(page);
    await selectType(page, 'GOODS');

    const name = page.getByPlaceholder('Item name');
    const sku = page.getByPlaceholder('Auto-generated if blank');
    await name.fill('Docs Example — 2kg Sugar Packet');
    await sku.fill('DOCS-SUGAR-2KG');
    await screenshotWithCallouts(page, OUT('01-name-sku.png'), [
      { locator: name, number: 1 },
      { locator: sku, number: 2 },
    ]);

    const typeSelect = page.locator('select:has(option[value="GOODS"])');
    const barcode = page.getByPlaceholder('Barcode (optional)');
    await barcode.fill('6009123456789');
    await screenshotWithCallouts(page, OUT('02-type-barcode.png'), [
      { locator: typeSelect, number: 1 },
      { locator: barcode, number: 2 },
    ]);

    // Category / Unit — CreatableSelect renders a trigger button whose text is the placeholder
    // until something is picked.
    const categoryTrigger = page.getByRole('button', { name: 'No category' });
    const unitTrigger = page.getByRole('button', { name: 'No unit' });
    if (await categoryTrigger.isVisible().catch(() => false)) {
      await categoryTrigger.scrollIntoViewIfNeeded();
      await screenshotWithCallouts(page, OUT('03-category-unit.png'), [
        { locator: categoryTrigger, number: 1 },
        { locator: unitTrigger, number: 2 },
      ]);
    }

    const manufacturer = page.getByPlaceholder('e.g. HP Inc.');
    if (await manufacturer.isVisible().catch(() => false)) {
      await manufacturer.scrollIntoViewIfNeeded();
      await manufacturer.fill('Demo Distributor Co.');
      await screenshotWithCallouts(page, OUT('04-brand-model-manufacturer.png'), [{ locator: manufacturer, number: 3 }]);
    }

    const notForSale = checkboxIn(page, 'Not for sale');
    await notForSale.scrollIntoViewIfNeeded();
    await screenshotWithCallouts(page, OUT('05-not-for-sale.png'), [{ locator: notForSale, number: 1 }]);

    const costInput = page.getByPlaceholder('Price paid');
    await costInput.scrollIntoViewIfNeeded();
    await costInput.fill('95');
    await screenshotWithCallouts(page, OUT('06-cost.png'), [{ locator: costInput, number: 1 }]);

    const sellingPrice = page.getByPlaceholder('e.g. 2500');
    const wholesale = page.getByPlaceholder('Wholesale');
    const retail = page.getByPlaceholder('Retail');
    await sellingPrice.scrollIntoViewIfNeeded();
    await sellingPrice.fill('130');
    await screenshotWithCallouts(page, OUT('07-pricing.png'), [
      { locator: sellingPrice, number: 1 },
      { locator: wholesale, number: 2 },
      { locator: retail, number: 3 },
    ]);

    // Non-billable sits right after Tax & Compliance — screenshot both together since they're
    // small, self-contained blocks.
    const taxInclusive = checkboxIn(page, 'Price is inclusive of tax');
    const nonBillable = checkboxIn(page, 'Non-billable');
    await nonBillable.scrollIntoViewIfNeeded();
    await screenshotWithCallouts(page, OUT('08-tax-and-non-billable.png'), [
      { locator: taxInclusive, number: 1 },
      { locator: nonBillable, number: 2 },
    ]);

    // --- The hero shot: Initial Stock on Hand ---
    const initialStock = page.locator('input[placeholder="0"]').first();
    await initialStock.scrollIntoViewIfNeeded();
    await initialStock.fill('50');
    await screenshotWithCallouts(page, OUT('09-initial-stock-THE-FIX.png'), [
      { locator: initialStock, number: 1, color: '#dc2626' },
    ]);

    const reorderLevelBlock = page.getByText('Reorder Level');
    await reorderLevelBlock.scrollIntoViewIfNeeded();
    await screenshotWithCallouts(page, OUT('10-reorder-level-qty.png'), []);

    const perishable = checkboxIn(page, 'Perishable');
    await perishable.scrollIntoViewIfNeeded();
    await screenshotWithCallouts(page, OUT('11-compliance-checkboxes.png'), []);

    const stockTrackingLabel = page.getByText('Stock Tracking', { exact: true });
    await stockTrackingLabel.scrollIntoViewIfNeeded();
    await screenshotWithCallouts(page, OUT('12-stock-tracking-mode.png'), []);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('SERVICE — how it differs (services outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.services);
    await openNewItem(page);
    await selectType(page, 'SERVICE');
    await page.getByPlaceholder('Item name').fill('Docs Example — Haircut & Wash');
    const typeSelect = page.locator('select:has(option[value="SERVICE"])');
    await screenshotWithCallouts(page, OUT('type-service.png'), [{ locator: typeSelect, number: 1 }]);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('VOUCHER — how it differs (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await openNewItem(page);
    await selectType(page, 'VOUCHER');
    await page.getByPlaceholder('Item name').fill('Docs Example — KES 1000 Gift Voucher');
    const typeSelect = page.locator('select:has(option[value="VOUCHER"])');
    await screenshotWithCallouts(page, OUT('type-voucher.png'), [{ locator: typeSelect, number: 1 }]);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('EQUIPMENT — how it differs (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await openNewItem(page);
    await selectType(page, 'EQUIPMENT');
    await page.getByPlaceholder('Item name').fill('Docs Example — Weighing Scale');
    const initialStock = page.locator('input[placeholder="0"]').first();
    await initialStock.scrollIntoViewIfNeeded();
    const typeSelect = page.locator('select:has(option[value="EQUIPMENT"])');
    await screenshotWithCallouts(page, OUT('type-equipment.png'), [{ locator: typeSelect, number: 1 }]);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('INGREDIENT — how it differs (hospitality outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.hospitality);
    await openNewItem(page);
    await selectType(page, 'INGREDIENT');
    await page.getByPlaceholder('Item name').fill('Docs Example — Fresh Basil');
    const typeSelect = page.locator('select:has(option[value="INGREDIENT"])');
    await screenshotWithCallouts(page, OUT('type-ingredient.png'), [{ locator: typeSelect, number: 1 }]);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('RECIPE — New Menu Item wizard (hospitality outlet)', async ({ page }) => {
    // Hospitality is already the tenant's default/HQ outlet reached by plain pinLogin() — no
    // dropdown round-trip needed, which matters here since this test was previously timing out
    // (a stray getByRole('link', ...) selector below waited its full 30s for a role that doesn't
    // exist — "New Menu Item" is a <button>, not a link — before ever reaching the real click).
    await pinLogin(page);
    await goToViaSidebar(page, 'Catalog');
    await page.getByRole('button', { name: /new menu item/i }).click();
    await expect(page.getByText('Basic Info')).toBeVisible();

    await page.getByPlaceholder(/e\.g\. Beef Grilled/i).fill('Docs Example — Grilled Chicken (200g)');
    await screenshotWithCallouts(page, OUT('recipe-step1-basic-info.png'), []);

    await page.getByRole('button', { name: /^Next|Ingredients$/i }).click().catch(() => {});
    const ingredientsHeading = page.getByText('Ingredients', { exact: true }).first();
    if (await ingredientsHeading.isVisible().catch(() => false)) {
      await screenshotWithCallouts(page, OUT('recipe-step2-ingredients.png'), []);
    }

    // New Menu Item is a dedicated full page, not a modal — there's no Cancel/Close button to
    // click (a prior version waited its full action timeout on one that doesn't exist here).
    // Nothing was submitted, so there's nothing to clean up; the test just ends here.
  });
});
