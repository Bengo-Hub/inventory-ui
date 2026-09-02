import type { Page } from '@playwright/test';

const ORIGIN = (process.env.BASE_URL || 'https://inventory.codevertexafrica.com').replace(/\/$/, '');
const ORG_SLUG = process.env.E2E_ORG_SLUG || 'codevertex-demo';
const ADMIN_PIN = process.env.E2E_ADMIN_PIN || '0000';

export function orgUrl(path: string) {
  return `${ORIGIN}/${ORG_SLUG}${path}`;
}

// codevertex-demo's outlet display names (auth-service/auth-api/cmd/seed/seed_tenants.go),
// scoped to the ones inventory-ui actually shows. The outlet picked at login decides which item
// types the New Item form offers (see use-case-nomenclature.ts's SCOPES map) — retail is the
// one that matches an actual retail-shop client, so most screenshots use it, not the HQ default.
export const DEMO_OUTLETS = {
  hospitality: /Demo Grand Hotel/i,
  retail: /Demo City Supermarket/i,
  quickService: /Demo Express Kiosk/i,
  pharmacy: /Demo Health Pharmacy/i,
  services: /Demo Beauty & Wellness/i,
  warehouse: /Demo Central Warehouse/i,
  manufacturing: /Demo Production Facility/i,
} as const;

export interface PinLoginOptions {
  pin?: string;
}

/**
 * PIN login — gets authenticated, nothing more. Which outlet the picker lands on at THIS stage
 * doesn't matter (see selectOutlet() below): the outlet-picker step (staggered-animation cards,
 * a click that occasionally doesn't register, a global keydown handler that fires regardless of
 * which screen is showing) turned out to be too flaky to trust for picking a SPECIFIC outlet —
 * confirmed live, repeatedly, across many runs. So this just clicks whatever outlet is first (or
 * types straight in in a single-outlet tenant) to get past login, then the caller uses the admin
 * OutletFilter dropdown (a plain, reliable in-app control) to reach the outlet it actually wants.
 */
// Confirmed live: the outlets-list API this whole flow depends on (both the pin-login picker and
// the post-SSO /auth/select-outlet page) occasionally fails outright ("Failed to load outlets.
// Please try again.") — a real intermittent backend issue, not a client-side timing race. Give it
// a couple of backoff-and-reload attempts before treating the surrounding retry as burned.
async function recoverFromOutletsLoadFailure(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const failed = await page.getByText(/failed to load outlets/i).isVisible({ timeout: 1_500 }).catch(() => false);
    if (!failed) return;
    await page.waitForTimeout(1500 * (i + 1));
    await page.reload();
    await page.waitForTimeout(800);
  }
}

// Confirmed live: "too many requests, please try again later" — a real rate limit on the
// PIN/outlets endpoints, triggered by this suite's own repeated back-to-back logins during
// development. Needs a genuinely long cooldown, not a quick retry (a short backoff just burns
// the retry budget hitting the same limit again).
async function rateLimited(page: Page): Promise<boolean> {
  return page.getByText(/too many requests/i).isVisible({ timeout: 1_000 }).catch(() => false);
}

export async function pinLogin(page: Page, opts: PinLoginOptions = {}) {
  await page.goto(orgUrl('/auth/pin-login'));
  if (await rateLimited(page)) {
    await page.waitForTimeout(20_000);
    await page.goto(orgUrl('/auth/pin-login'));
  }
  await recoverFromOutletsLoadFailure(page);

  const outletPrompt = page.getByText(/select your outlet/i);
  const sawOutletPrompt = await outletPrompt.isVisible({ timeout: 5000 }).catch(() => false);
  if (sawOutletPrompt) {
    await page.waitForTimeout(600);
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByRole('button').first().click();
      const left = await outletPrompt.waitFor({ state: 'hidden', timeout: 4_000 }).then(() => true).catch(() => false);
      if (left) break;
    }
  }

  await page.waitForTimeout(400);
  const pin = opts.pin || ADMIN_PIN;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const digit of pin.split('')) {
      await page.keyboard.press(digit);
      await page.waitForTimeout(120);
    }

    // Known race, confirmed live: a silent SSO probe on the destination page can bounce a fresh
    // PIN session to /auth/callback?error=login_required before it finishes hydrating, even
    // though the PIN session itself is already valid. A hard reload of the org root recovers.
    await page
      .waitForURL((url) => url.pathname.startsWith(`/${ORG_SLUG}`) || url.href.includes('auth/callback'), { timeout: 8_000 })
      .catch(() => {});
    if (page.url().includes('auth/callback') || page.url().includes('login_required')) {
      await page.goto(orgUrl(''));
    }

    // A missing/failed outlet selection at this point can route an HQ user through
    // /auth/select-outlet, a second gate with its own (also occasionally-failing) outlets fetch.
    // For an HQ/admin user it auto-selects and redirects on success — just needs the load
    // failure recovered and time to settle, no click required.
    if (page.url().includes('/auth/select-outlet')) {
      await recoverFromOutletsLoadFailure(page);
      await page
        .waitForURL(new RegExp(`/${ORG_SLUG}(/)?($|\\?)`), { timeout: 8_000 })
        .catch(() => {});
    }

    const arrived = await page
      .waitForURL(new RegExp(`/${ORG_SLUG}(/)?($|\\?)`), { timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    if (arrived) return;

    if (page.url().includes('/auth/pin-login')) {
      if (await rateLimited(page)) {
        await page.waitForTimeout(20_000);
        await page.goto(orgUrl('/auth/pin-login'));
        await recoverFromOutletsLoadFailure(page);
        continue;
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  throw new Error(`pinLogin: never reached ${orgUrl('')} after PIN entry retries`);
}

/**
 * Switches the active outlet via the header's admin-only OutletFilter dropdown
 * (src/components/outlet-filter.tsx) — a plain client-side dropdown, not a redirect/PIN-style
 * flow, so it doesn't suffer the login picker's timing issues. Requires an already-authenticated
 * admin session (pinLogin() above). Retries the whole open-click-verify sequence since a dropdown
 * closing itself (outside click, re-render) mid-click can still occasionally eat a click.
 */
export async function selectOutlet(page: Page, outletName: RegExp | string) {
  const trigger = page.locator('button[aria-haspopup="listbox"]');
  for (let attempt = 0; attempt < 4; attempt++) {
    // The outlets-list fetch backing the /auth/select-outlet gate (see pinLogin above) can also
    // fail mid-session, not just at initial login — confirmed live, landing here instead of the
    // OutletFilter's own page entirely, which would otherwise wait forever for a trigger button
    // that isn't on this page. Recover and wait for the auto-redirect back before continuing.
    if (page.url().includes('/auth/select-outlet')) {
      await recoverFromOutletsLoadFailure(page);
      await page.waitForURL((url) => !url.pathname.includes('/auth/select-outlet'), { timeout: 8_000 }).catch(() => {});
    }
    await trigger.click();
    const option = page.locator('.max-h-56').getByRole('button', { name: outletName });
    const optionVisible = await option.first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!optionVisible) {
      await page.keyboard.press('Escape').catch(() => {});
      continue;
    }
    await option.first().click();
    const confirmed = await trigger.getByText(outletName).first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (confirmed) return;
  }
  throw new Error(`selectOutlet: could not select outlet matching ${String(outletName)}`);
}

// Several sidebar groups (Procurement, Reports, Manufacturing, Assets, After-Sales, Management)
// render collapsed by default (sidebar.tsx's `defaultCollapsed: true`) — their links don't exist
// in the DOM at all until the group header is expanded. Call this before goToViaSidebar() for any
// link that lives in one of those groups. Idempotent: only clicks if currently collapsed.
export async function expandSidebarGroup(page: Page, groupLabel: string) {
  const header = page.getByRole('button', { name: groupLabel, exact: true });
  if (await header.isVisible({ timeout: 3_000 }).catch(() => false)) {
    if ((await header.getAttribute('aria-expanded')) === 'false') {
      await header.click();
      await page.waitForTimeout(300);
    }
  }
}

// In-app navigation must go through client-side <Link> clicks, not page.goto() — see the
// sso-silent-probe-prompt-none project memory referenced in brand-management.spec.ts: a hard
// reload on a non-/auth route re-triggers a silent SSO probe before the PIN session rehydrates.
export async function goToViaSidebar(page: Page, linkName: string) {
  // Scoped to the <nav> landmark: several pages also render a same-labelled quick-action link in
  // the main content area (e.g. "Stock Levels" as both a sidebar item and a dashboard shortcut
  // button) — an unscoped getByRole('link', ...) matches both and throws a strict-mode violation.
  await page.getByRole('navigation').getByRole('link', { name: linkName, exact: true }).click();
}
