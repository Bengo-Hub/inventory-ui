import { expect, test } from '@playwright/test';
import { DEMO_OUTLETS, expandSidebarGroup, goToViaSidebar, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Documentation screenshots for "Inventory Administration": Categories & Brands, Units,
// Suppliers, Team & Roles, Settings (Stock & Thresholds), Approvals, Pricing Profiles. Not a
// regression suite. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 npx playwright test e2e/docs-capture/administration.spec.ts --project=chromium --reporter=list
//
// Every screenshot is preceded by a real "loaded" wait (waitForSpinnerGone, or an explicit
// waitForTimeout after a nav/tab click) rather than firing the instant an assertion resolves —
// several of these pages/tabs fetch data async after their shell renders, and a couple of the
// text assertions used early on turned out to also match sidebar chrome that stays visible
// through a route change. Both classes of bug produced screenshots of the wrong content (a
// spinner, or the dashboard instead of the actual target page) even though the test "passed."

const OUT = (name: string) => assetPath('administration', name);

async function waitForSpinnerGone(page: import('@playwright/test').Page) {
  await page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

test.describe('Docs capture: Inventory Administration', () => {
  test('Categories & Brands', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await goToViaSidebar(page, 'Categories');
    await expect(page.getByText('Categories & Brands')).toBeVisible({ timeout: 10_000 });
    await waitForSpinnerGone(page);
    await screenshotWithCallouts(page, OUT('01-categories-list.png'), []);

    await page.getByRole('button', { name: 'Add Category' }).click();
    const nameInput = page.getByPlaceholder('e.g. Beverages');
    const codeInput = page.getByPlaceholder('e.g. BEV');
    await expect(nameInput).toBeVisible();
    await page.waitForTimeout(400);
    await nameInput.fill('Docs Example Category');
    await page.waitForTimeout(300);
    await screenshotWithCallouts(page, OUT('02-add-category.png'), [
      { locator: nameInput, number: 1 },
      { locator: codeInput, number: 2 },
    ]);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: 'Brands', exact: true }).click();
    await waitForSpinnerGone(page);
    await page.waitForTimeout(400);
    await screenshotWithCallouts(page, OUT('03-brands-list.png'), []);
  });

  test('Units of Measure', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await goToViaSidebar(page, 'Units');
    await expect(page.getByText('Units of Measure')).toBeVisible({ timeout: 10_000 });
    await waitForSpinnerGone(page);
    await screenshotWithCallouts(page, OUT('04-units-list.png'), []);

    await page.getByRole('button', { name: 'Add Unit' }).click();
    const nameInput = page.getByPlaceholder('e.g. Kilogram');
    const abbrInput = page.getByPlaceholder('e.g. kg');
    await expect(nameInput).toBeVisible();
    await page.waitForTimeout(400);
    await nameInput.fill('Docs Example Unit');
    await page.waitForTimeout(300);
    await screenshotWithCallouts(page, OUT('05-add-unit.png'), [
      { locator: nameInput, number: 1 },
      { locator: abbrInput, number: 2 },
    ]);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Suppliers', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Procurement');
    await goToViaSidebar(page, 'Suppliers');
    await expect(page.getByText('Manage your inventory suppliers')).toBeVisible({ timeout: 10_000 });
    await waitForSpinnerGone(page);
    await screenshotWithCallouts(page, OUT('06-suppliers-list.png'), []);

    await page.getByRole('button', { name: 'Add Supplier' }).click();
    const nameInput = page.getByPlaceholder('e.g. Acme Supplies Ltd');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(400);
    await nameInput.fill('Docs Example Supplier');
    await page.waitForTimeout(300);
    await screenshotWithCallouts(page, OUT('07-add-supplier.png'), [{ locator: nameInput, number: 1 }]);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Team & Roles', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Management');
    await goToViaSidebar(page, 'Team & Roles');
    await expect(page.getByRole('heading', { name: 'Team & Roles' })).toBeVisible({ timeout: 10_000 });
    await waitForSpinnerGone(page);
    await screenshotWithCallouts(page, OUT('08-team-accounts.png'), []);

    const rolesTab = page.getByRole('button', { name: /roles.*permissions/i });
    if (await rolesTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await rolesTab.click();
      await waitForSpinnerGone(page);
      await page.waitForTimeout(400);
      await screenshotWithCallouts(page, OUT('09-roles-permissions.png'), []);
    }
  });

  test('Settings — Stock & Thresholds', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Management');
    await goToViaSidebar(page, 'Settings');
    await expect(page.getByText('Inventory Settings')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);

    const stockTab = page.getByRole('button', { name: /stock.*threshold/i });
    await stockTab.click();
    await waitForSpinnerGone(page);
    await expect(page.getByText('Inventory Costing Method')).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(400);
    await screenshotWithCallouts(page, OUT('10-settings-stock-thresholds.png'), []);
  });

  test('Approvals — rules and review', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Management');
    await goToViaSidebar(page, 'Approvals');
    // Assert on the page's own <h1> and the "My Inbox" tab, not the bare text "Approvals" —
    // that string also matches the sidebar nav link, which stays on screen (and thus
    // "visible") through the click, before the route's real content has actually swapped in.
    await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'My Inbox' })).toBeVisible({ timeout: 10_000 });
    await waitForSpinnerGone(page);
    await page.waitForTimeout(400);
    await screenshotWithCallouts(page, OUT('11-approvals-inbox.png'), []);

    const rulesBtn = page.getByRole('button', { name: /approval rules/i });
    if (await rulesBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await rulesBtn.click();
      await page.waitForTimeout(700);
      // "Approval Rules" (bare text) also matches the sidebar nav link — same trap as the
      // Approvals inbox above. Wait for a real signal the rules list itself has rendered: the
      // "New Rule" button only exists on this sub-page.
      const newRule = page.getByRole('button', { name: 'New Rule' });
      await expect(newRule).toBeVisible({ timeout: 8_000 });
      await waitForSpinnerGone(page);
      await page.waitForTimeout(400);
      await screenshotWithCallouts(page, OUT('12-approval-rules-list.png'), []);

      await newRule.click();
      await page.waitForTimeout(600);
      const nameInput = page.getByPlaceholder('e.g. High-value POs');
      await expect(nameInput).toBeVisible({ timeout: 5_000 });
      await nameInput.fill('Docs Example Rule');
      await page.waitForTimeout(400);
      await screenshotWithCallouts(page, OUT('13-new-approval-rule.png'), [{ locator: nameInput, number: 1 }]);
      await page.getByRole('button', { name: 'Cancel' }).click();
    }
  });

  test('Pricing Profiles', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await expandSidebarGroup(page, 'Management');
    await goToViaSidebar(page, 'Pricing Profiles');
    await expect(page.getByText(/price tiers/i)).toBeVisible({ timeout: 10_000 });
    await waitForSpinnerGone(page);
    await screenshotWithCallouts(page, OUT('14-pricing-profiles-list.png'), []);

    await page.getByRole('button', { name: 'Add Profile' }).click();
    // exact: true — getByPlaceholder matches case-insensitively by default, and the Code field's
    // placeholder ("e.g. WHOLESALE") would otherwise also match this Name field's target text.
    const nameInput = page.getByPlaceholder('e.g. Wholesale', { exact: true });
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(400);
    await nameInput.fill('Docs Example Tier');
    await page.waitForTimeout(300);
    await screenshotWithCallouts(page, OUT('15-add-pricing-profile.png'), [{ locator: nameInput, number: 1 }]);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
