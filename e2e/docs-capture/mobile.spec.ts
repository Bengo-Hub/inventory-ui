import { devices, expect, test } from '@playwright/test';
import { DEMO_OUTLETS, goToViaSidebar, orgUrl, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Mobile-PWA screenshots for the same guides catalog-items/warehouses-and-stock/procurement
// already cover on desktop — some staff run this app on a phone, and the layout genuinely
// differs (a single-column PIN pad, a hamburger nav drawer instead of a fixed sidebar), so a
// focused mobile pass covers the screens that look different or matter most on the shop floor:
// logging in, opening the nav, and the two moments the WhatsApp support thread was actually
// about (adding a product's Initial Stock, and fixing one via a Stock Adjustment). Not a
// regression suite. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 pnpm test:e2e -- e2e/docs-capture/mobile.spec.ts --headed

test.use({ ...devices['iPhone 13'] });

// The mobile sidebar is an off-canvas drawer, translated out of the viewport until opened — the
// nav links exist in the DOM but Playwright refuses to click something "outside of the viewport",
// unlike desktop where the sidebar is always visible. Open the hamburger menu first.
async function openMobileNav(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByText('Menu', { exact: true })).toBeVisible({ timeout: 5_000 });
}

// The real "Install Codevertex Inventory" PWA prompt can pop up over the bottom of the screen
// mid-test — genuine mobile behavior, but it covers content in a documentation screenshot.
async function dismissInstallBanner(page: import('@playwright/test').Page) {
  const banner = page.locator('div.fixed.inset-x-0.bottom-0');
  if (await banner.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await banner.getByRole('button').first().click().catch(() => {});
  }
}

test.describe('Docs capture: Mobile PWA', () => {
  test('PIN login and mobile nav (retail outlet)', async ({ page }) => {
    await page.goto(orgUrl('/auth/pin-login'));
    await page.waitForTimeout(1000);
    await screenshotWithCallouts(page, assetPath('adding-products', 'login-mobile.png'), []);

    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);

    const openMenu = page.getByRole('button', { name: 'Open menu' });
    await openMenu.click();
    await expect(page.getByText('Menu', { exact: true })).toBeVisible({ timeout: 5000 });
    await screenshotWithCallouts(page, assetPath('adding-products', 'nav-drawer-mobile.png'), []);
    await page.getByRole('button', { name: 'Close menu' }).click().catch(() => {});
  });

  test('New Item — Initial Stock on mobile (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await openMobileNav(page);
    await goToViaSidebar(page, 'Catalog');
    await page.getByRole('button', { name: /^New (Item|Product|Drug|Service)/i }).click();
    await expect(page.getByPlaceholder('Item name')).toBeVisible();

    const typeSelect = page.locator('select:has(option[value="GOODS"])');
    await typeSelect.selectOption('GOODS');
    await page.getByPlaceholder('Item name').fill('Docs Example — 2kg Sugar Packet');

    const initialStock = page.locator('input[placeholder="0"]').first();
    await initialStock.scrollIntoViewIfNeeded();
    await initialStock.fill('50');
    await dismissInstallBanner(page);
    await screenshotWithCallouts(page, assetPath('adding-products', '09-initial-stock-THE-FIX-mobile.png'), [
      { locator: initialStock, number: 1, color: '#dc2626' },
    ]);

    await page.getByRole('button', { name: 'Cancel' }).click({ timeout: 5_000 }).catch(() => {});
  });

  test('Stock Adjustments — fixing a zero-stock item on mobile (retail outlet)', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await openMobileNav(page);
    await goToViaSidebar(page, 'Adjustments');

    await page.getByRole('button', { name: 'New Adjustment' }).click();
    await expect(page.getByText('New Stock Adjustment')).toBeVisible();

    // "Sugar" doesn't match anything real in this outlet's seeded catalog — search a real seeded
    // item's name instead ("Hair Accessories Set," confirmed present for Demo City Supermarket).
    const itemSearch = page.getByPlaceholder('Search by name or SKU...');
    await itemSearch.fill('Hair');
    await page.waitForTimeout(900);
    const firstResult = page.getByRole('option').first().or(page.getByRole('button').filter({ hasText: /hair/i }).first());
    if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstResult.click();
    }

    const qtyInput = page.getByPlaceholder('0').first();
    await qtyInput.fill('10');

    const reasonSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Initial Stock Count' }) });
    if (await reasonSelect.count()) {
      await reasonSelect.selectOption({ label: 'Initial Stock Count' });
    }
    await dismissInstallBanner(page);
    await screenshotWithCallouts(page, assetPath('warehouses-and-stock', '05-adjustment-form-mobile.png'), [
      { locator: qtyInput, number: 1, color: '#dc2626' },
    ]);

    await page.getByRole('button', { name: 'Cancel' }).click({ timeout: 5_000 }).catch(() => {});
  });
});
