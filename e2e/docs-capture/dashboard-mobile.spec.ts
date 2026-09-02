import { devices, expect, test } from '@playwright/test';
import { DEMO_OUTLETS, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Mobile counterpart to dashboard.spec.ts — split into its own file because
// test.use({...devices['iPhone 13']}) must be top-level in a file (or in the config), not inside
// a describe block, since it forces a new worker. Not a regression suite. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 npx playwright test e2e/docs-capture/dashboard-mobile.spec.ts --reporter=list

test.use({ ...devices['iPhone 13'] });

const OUT = (name: string) => assetPath('dashboard', name);

test('mobile dashboard — open menu and quick actions', async ({ page }) => {
  await pinLogin(page);
  await selectOutlet(page, DEMO_OUTLETS.retail);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10_000 });

  // Two ways to reach the same navigation menu on mobile: the hamburger up top, and the "More"
  // tab in the bottom bar (mobile-bottom-nav.tsx's onOpenMore wires to the same handler as the
  // header's hamburger) — label both, not just the hamburger.
  const openMenu = page.getByRole('button', { name: 'Open menu' });
  const moreTab = page.getByRole('button', { name: 'More' }).or(page.getByRole('link', { name: 'More' }));

  // The real "Install Codevertex Inventory" PWA prompt can cover the bottom nav bar — dismiss it
  // so the "More" callout isn't obscured (see mobile.spec.ts for the same pattern).
  const banner = page.locator('div.fixed.inset-x-0.bottom-0');
  if (await banner.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await banner.getByRole('button').first().click().catch(() => {});
  }

  await screenshotWithCallouts(page, OUT('02-mobile-dashboard.png'), [
    { locator: openMenu, number: 1, color: '#dc2626' },
    { locator: moreTab, number: 2, color: '#dc2626' },
  ]);
});
