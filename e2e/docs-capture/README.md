# docs-capture

Playwright specs that take annotated screenshots for the "Inventory" section of the shared-docs
user guide (`shared-docs/docs/user-guide/inventory/`). These are not a regression suite — they
fill in forms, screenshot them, and cancel out without submitting, so nothing fails CI and no
demo data is created. They log into `codevertex-demo` (the platform's shared demo tenant) via PIN
login, picking a specific outlet per screenshot since the item-type selector and its wording
depend on which outlet is active.

## Re-running this

The guide's screenshots go stale whenever the New Item form, Adjustments, Purchase Orders, or
Goods Receipts pages change layout. Re-run the relevant spec and re-publish shared-docs:

```
pnpm docs:capture
# or a single file:
pnpm test:e2e -- e2e/docs-capture/catalog-items.spec.ts --headed
```

`BASE_URL` and `E2E_ORG_SLUG` default to production and `urban-loft` (see `playwright.config.ts`);
these specs override the tenant themselves via `lib/pin-login.ts`'s `orgUrl()`, which reads
`E2E_ORG_SLUG` (default `codevertex-demo`) and `E2E_ADMIN_PIN` (default `0000`) directly.

Screenshots are written straight into the sibling `shared-docs` repo
(`docs/user-guide/inventory/assets/`) — there's no copy step, so both repos need to be checked
out side by side (already the case for this monorepo-of-repos layout).
