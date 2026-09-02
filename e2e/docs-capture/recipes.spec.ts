import { expect, test, type Page } from '@playwright/test';
import { DEMO_OUTLETS, goToViaSidebar, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Documentation screenshots for the deeper "Recipe / Menu Item" section of the Adding Products
// guide — complex/nested recipes (a recipe used as an ingredient in another recipe) and
// ingredient content-per-unit configuration. Not a regression suite. Everything here is filled
// but never submitted (the New Menu Item wizard only POSTs on its final step, and the New Item
// dialog has a real Cancel button) — nothing is created, so there's nothing to clean up. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 npx playwright test e2e/docs-capture/recipes.spec.ts --project=chromium --reporter=list
//
// Waits between actions are deliberate, not filler — they give each page/tab/dialog the same
// beat a real person pauses for (read the screen, wait for it to finish loading) rather than
// hammering inputs the instant they mount, which is what caused the admin-docs spinner-capture
// bugs elsewhere in this suite (see administration.spec.ts's waitForSpinnerGone).

const OUT = (name: string) => assetPath('adding-products', name);

function checkboxIn(page: Page, labelText: string) {
  return page.locator('label').filter({ hasText: labelText }).locator('input[type="checkbox"]');
}

test.describe('Docs capture: Recipes — reusable components and content-per-unit', () => {
  test('Recipe — usable as an ingredient + content per portion', async ({ page }) => {
    await pinLogin(page);
    await goToViaSidebar(page, 'Catalog');
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /new menu item/i }).click();
    await expect(page.getByText('Basic Info')).toBeVisible();
    await page.waitForTimeout(600);

    await page.getByPlaceholder(/e\.g\. Beef Grilled/i).fill('Docs Example — Grilled Chicken Breast (200g)');
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g. 900').fill('450');
    await page.waitForTimeout(300);

    const usable = checkboxIn(page, 'Usable as an ingredient in other recipes');
    await usable.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await usable.check();
    await page.waitForTimeout(500);

    // Only one ml/l/g/kg-style select exists on this step — the Content per portion one, revealed
    // by the checkbox above (the Cost section's pack-unit select lives in ItemFormDialog, not
    // this wizard).
    const contentQty = page.getByPlaceholder('e.g. 300');
    await expect(contentQty).toBeVisible();
    await contentQty.fill('200');
    await page.waitForTimeout(300);
    const contentUnit = page.locator(
      'select:has(option[value="ml"]):has(option[value="l"]):has(option[value="g"]):has(option[value="kg"])',
    );
    await contentUnit.selectOption('g');
    await page.waitForTimeout(500);

    await screenshotWithCallouts(page, OUT('recipe-usable-in-recipes-and-content-per-portion.png'), [
      { locator: usable, number: 1 },
      { locator: contentQty, number: 2 },
      { locator: contentUnit, number: 3 },
    ]);

    // Full-page wizard — no Cancel button, nothing submitted yet. Just stop here.
  });

  test('Recipe — a filled ingredient line (qty, unit, waste %, cost)', async ({ page }) => {
    await pinLogin(page);
    await goToViaSidebar(page, 'Catalog');
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /new menu item/i }).click();
    await expect(page.getByText('Basic Info')).toBeVisible();
    await page.waitForTimeout(600);

    await page.getByPlaceholder(/e\.g\. Beef Grilled/i).fill('Docs Example — Chicken Platter');
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g. 900').fill('850');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /^Next|Ingredients$/i }).click();
    await expect(page.getByText('Ingredients', { exact: true }).first()).toBeVisible();
    await page.waitForTimeout(700);

    await page.getByRole('button', { name: 'Add Ingredient' }).click();
    await page.waitForTimeout(500);
    // codevertex-demo's catalog is empty in this outlet, so there's nothing for the picker to
    // find — which is exactly the "picking an ingredient that isn't in inventory yet will
    // auto-create it" case the wizard's own intro copy calls out. Type the name and move on
    // without selecting a dropdown result; the row still shows exactly what a real first-time
    // user typing a brand new ingredient would see.
    const search = page.getByPlaceholder('Search ingredient…');
    await search.click();
    await search.fill('Tea Leaves');
    await page.waitForTimeout(700);

    const zeroInputs = page.locator('input[placeholder="0"]');
    const qty = zeroInputs.nth(0);
    const waste = zeroInputs.nth(1);
    // Clicking into the next field is also what closes the "no matches" dropdown naturally.
    await qty.click();
    await page.waitForTimeout(300);
    await qty.fill('200');
    await page.waitForTimeout(300);
    await waste.fill('5');
    await page.waitForTimeout(500);

    await screenshotWithCallouts(page, OUT('recipe-ingredient-row-filled.png'), [
      { locator: search, number: 1 },
      { locator: qty, number: 2 },
      { locator: waste, number: 3 },
    ]);

    // Nothing submitted — the wizard only POSTs on the final "Create" action, never reached here.
  });

  test('Ingredient — content per unit (liquor, perfume, grammage examples)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await goToViaSidebar(page, 'Catalog');
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^New (Item|Product|Drug)/i }).click();
    await expect(page.getByPlaceholder('Item name')).toBeVisible();
    await page.waitForTimeout(600);

    const typeSelect = page.locator('select:has(option[value="INGREDIENT"])');
    await typeSelect.selectOption('INGREDIENT');
    await page.waitForTimeout(600);

    const name = page.getByPlaceholder('Item name');
    const contentQty = page.getByPlaceholder('e.g. 750');
    // Two selects on this dialog share the ml/l/g/kg option set — the Cost section's pack-unit
    // select (first in the DOM) and this one, "Content per unit" (second). Disambiguate by order.
    const contentUnit = page
      .locator('select:has(option[value="ml"]):has(option[value="l"]):has(option[value="g"]):has(option[value="kg"])')
      .nth(1);

    // Example 1 — a liquor bottle. "25 x 30 ml tots deplete exactly one 750 ml bottle": once this
    // is set, a recipe line for a 30 ml tot (see the Ingredients-grid screenshot above) converts
    // and deducts against this bottle automatically — no separate "tot" stock item needed.
    await name.fill('Docs Example — Whiskey 750ml Bottle');
    await page.waitForTimeout(400);
    await contentQty.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await contentQty.fill('750');
    await page.waitForTimeout(300);
    await contentUnit.selectOption('ml');
    await page.waitForTimeout(500);
    await screenshotWithCallouts(page, OUT('ingredient-content-per-unit-liquor.png'), [
      { locator: contentQty, number: 1 },
      { locator: contentUnit, number: 2 },
    ]);

    // Example 2 — a perfume bottle, same field, a much smaller number.
    await name.fill('Docs Example — Perfume 50ml Bottle');
    await page.waitForTimeout(300);
    await contentQty.fill('50');
    await page.waitForTimeout(500);
    await screenshotWithCallouts(page, OUT('ingredient-content-per-unit-perfume.png'), [
      { locator: contentQty, number: 1 },
      { locator: contentUnit, number: 2 },
    ]);

    // Example 3 — grammage, not volume: a 25 kg bag.
    await name.fill('Docs Example — Rice 25kg Bag');
    await page.waitForTimeout(300);
    await contentQty.fill('25');
    await page.waitForTimeout(300);
    await contentUnit.selectOption('kg');
    await page.waitForTimeout(500);
    await screenshotWithCallouts(page, OUT('ingredient-content-per-unit-grammage.png'), [
      { locator: contentQty, number: 1 },
      { locator: contentUnit, number: 2 },
    ]);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
