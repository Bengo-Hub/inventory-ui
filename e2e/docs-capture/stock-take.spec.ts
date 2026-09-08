import { expect, test, type Page } from '@playwright/test';
import { DEMO_OUTLETS, expandSidebarGroup, goToViaSidebar, pinLogin, selectOutlet } from './lib/pin-login';
import { screenshotWithCallouts } from './lib/annotate';
import { assetPath } from './lib/paths';

// Documentation screenshots for a new "Stock Take" guide section (warehouses-and-stock.md) — the
// module has real, useful screenshots to show. Not a regression suite. Run with:
//   E2E_ORG_SLUG=codevertex-demo E2E_ADMIN_PIN=0000 npx playwright test e2e/docs-capture/stock-take.spec.ts --project=chromium --reporter=list
//
// Test 2 opens the retail outlet's own existing, real in-progress ("Counting") stock-take
// session — confirmed live it already has real variance data (some lines short, some over, some
// still pending) — rather than starting a brand new one. A fresh session created by this test
// would need a warehouse with real stocked items to produce any variance at all, and which
// warehouse in this tenant has real stock isn't something worth guessing at; reusing what's
// already there is both simpler and a more honest "here's what a real session mid-count looks
// like" screenshot. Nothing is created or changed — this test only reads.

const OUT = (name: string) => assetPath('warehouses-and-stock', name);

async function settle(page: Page, ms = 600) {
  await page.waitForTimeout(ms);
}

async function waitForSettled(page: Page, timeout = 8_000) {
  await page.locator('.animate-pulse, .animate-spin').first().waitFor({ state: 'hidden', timeout }).catch(() => {});
  await settle(page, 400);
}

test.describe.serial('Docs capture: Stock Take', () => {
  test('1. Stock Take list and New Stock Take dialog', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await goToViaSidebar(page, 'Stock Take');
    await expect(page.getByRole('heading', { name: 'Stock Take' })).toBeVisible({ timeout: 10_000 });
    await waitForSettled(page);
    await screenshotWithCallouts(page, OUT('09-stock-take-list.png'), []);

    await page.getByRole('button', { name: 'New Stock Take' }).click();
    await expect(page.getByRole('heading', { name: 'New Stock Take' })).toBeVisible({ timeout: 5_000 });
    await settle(page, 400);
    const reference = page.getByPlaceholder(/month-end count/i);
    await reference.fill('Docs Example Count');
    await settle(page, 300);
    await screenshotWithCallouts(page, OUT('10-new-stock-take-dialog.png'), [
      { locator: reference, number: 1 },
    ]);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('2. Stock Take counting — variance pills and filter', async ({ page }) => {
    await pinLogin(page);
    await selectOutlet(page, DEMO_OUTLETS.retail);
    await goToViaSidebar(page, 'Stock Take');
    await waitForSettled(page);

    // Target the tenant's own "End of week stock take" specifically — confirmed live it has
    // real negative/positive/pending variance data, unlike a freshly-created session (which
    // starts all-pending, giving a much less illustrative screenshot).
    const openBtn = page
      .getByRole('row', { name: /End of week stock take/i })
      .getByRole('button', { name: 'Open' })
      .first();
    if (!(await openBtn.isVisible({ timeout: 5_000 }).catch(() => false))) return;
    await openBtn.click();
    await waitForSettled(page);
    await expect(page.getByText(/items counted/i)).toBeVisible({ timeout: 10_000 });

    // Pills only render when their count is > 0 — build the callout list from whichever ones
    // are actually present rather than assuming all three (an unmatched locator here eats the
    // whole test timeout inside annotate.ts's boundingBox() wait — root-caused earlier this
    // project for the same symptom).
    const pillCandidates: { name: RegExp; number: number; color: string }[] = [
      { name: /short \(negative variance\)/i, number: 1, color: '#dc2626' },
      { name: /over \(positive variance\)/i, number: 2, color: '#059669' },
      { name: /pending \(not yet counted\)/i, number: 3, color: '#d97706' },
    ];
    const callouts: { locator: ReturnType<Page['getByRole']>; number: number; color: string }[] = [];
    for (const c of pillCandidates) {
      const locator = page.getByRole('button', { name: c.name });
      if (await locator.isVisible({ timeout: 3_000 }).catch(() => false)) {
        callouts.push({ locator, number: c.number, color: c.color });
      }
    }
    if (callouts.length === 0) return;
    await callouts[0].locator.scrollIntoViewIfNeeded().catch(() => {});
    await settle(page, 400);
    await screenshotWithCallouts(page, OUT('11-stock-take-counting.png'), callouts);
  });
});
