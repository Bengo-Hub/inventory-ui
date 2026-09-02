import { expect, test } from '@playwright/test';
import { DEMO_OUTLETS, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// A single orientation shot — "here's the dashboard, here's the always-visible sidebar, here's
// the quick-action buttons" — not a full dashboard walkthrough. Desktop only; see
// dashboard-mobile.spec.ts for the phone-viewport pass. Not a regression suite. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 npx playwright test e2e/docs-capture/dashboard.spec.ts --reporter=list

const OUT = (name: string) => assetPath('dashboard', name);

test('desktop dashboard — menu and quick actions', async ({ page }) => {
  await pinLogin(page);
  await selectOutlet(page, DEMO_OUTLETS.retail);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10_000 });

  // The quick-action pills (Stock Take / Adjust Stock / Purchase Order / Transfer / Stock
  // Levels) are navigational shortcuts rendered as links, not buttons — confirmed live after
  // getByRole('button', ...) matched nothing and silently ate up to ~30s of actionability-wait
  // per unmatched locator inside annotate.ts's callout loop, which is what looked like the page
  // "hanging" in earlier runs. It was never a rendering bug.
  const sidebarNav = page.getByRole('navigation').first();
  const quickAction = page.getByRole('link', { name: 'Stock Levels' }).first();
  await expect(quickAction).toBeVisible({ timeout: 10_000 });
  await screenshotWithCallouts(page, OUT('01-desktop-dashboard.png'), [
    { locator: sidebarNav, number: 1 },
    { locator: quickAction, number: 2 },
  ]);
});
