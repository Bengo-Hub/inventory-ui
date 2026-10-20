// ── Use-case module gating ────────────────────────────────────────────────────
// Maps outlet use_case to the set of module keys visible for that vertical. Shared source of
// truth for both the sidebar nav (components/sidebar.tsx) and the Settings page
// (app/[orgSlug]/settings/page.tsx) so a hospitality-only setting (e.g. "Enable Room Pricing")
// is hidden from a pure-retail/pharmacy/etc. tenant the same way its nav item already is.
// Mirrors pos-ui's USE_CASE_MODULES pattern.

export const USE_CASE_MODULES: Record<string, string[]> = {
  // 'hospitality_settings' gates the Settings → Modules "Hospitality" section (Room Pricing /
  // Facility Booking / Conference Packages) — scoped to hospitality only, per
  // catalogScopeFor(...).itemUseCases in use-case-nomenclature.ts: HOSPITALITY_ROOM /
  // HOSPITALITY_FACILITY / CONFERENCE appear ONLY in hospitality's item-use-case list (not
  // services', even though services also sets showHospitality:true for its item-form section).
  hospitality:   ['dashboard', 'catalog', 'categories', 'units', 'recipes', 'modifiers', 'warehouses', 'stock', 'adjustments', 'stock_take', 'transfers', 'events', 'production_batches', 'assets', 'requisitions', 'approvals','settings', 'hospitality_settings'],
  quick_service: ['dashboard', 'catalog', 'categories', 'units', 'recipes', 'warehouses', 'stock', 'adjustments', 'stock_take', 'production_batches', 'assets', 'requisitions', 'approvals','settings'],
  retail:        ['dashboard', 'catalog', 'categories', 'units', 'recipes', 'warehouses', 'stock', 'adjustments', 'stock_take', 'transfers', 'lots', 'purchase_orders', 'rfqs','returns', 'contracts', 'suppliers', 'requisitions', 'approvals','assets', 'warranties', 'production_batches', 'settings'],
  pharmacy:      ['dashboard', 'catalog', 'categories', 'units', 'warehouses', 'stock', 'adjustments', 'stock_take', 'lots', 'purchase_orders', 'rfqs','returns', 'contracts', 'suppliers', 'requisitions', 'approvals','assets', 'settings'],
  services:      ['dashboard', 'catalog', 'categories', 'units', 'warehouses', 'stock', 'adjustments', 'stock_take', 'events', 'assets', 'requisitions', 'approvals','settings'],
  warehouse:     ['dashboard', 'catalog', 'categories', 'units', 'warehouses', 'stock', 'adjustments', 'stock_take', 'transfers', 'lots', 'purchase_orders', 'rfqs','returns', 'contracts', 'production_batches', 'assets', 'requisitions', 'approvals','settings'],
  logistics:     ['dashboard', 'warehouses', 'stock', 'transfers', 'adjustments', 'stock_take', 'assets', 'settings'],
  manufacturing: ['dashboard', 'catalog', 'categories', 'units', 'recipes', 'warehouses', 'stock', 'adjustments', 'stock_take', 'transfers', 'lots', 'purchase_orders', 'rfqs', 'suppliers', 'production_batches', 'assets', 'requisitions', 'approvals', 'settings'],
};

// ── Recipes and BOM scope ─────────────────────────────────────────────────────
// A recipe is a menu or production concept. Hospitality, quick service and manufacturing run on
// them; a retail or warehouse tenant only does once it has actually created recipes (the paid
// manufacturing feature, for example cupcakes baked in a shop), so Recipes / BOM and the recipe
// wording of Recipe Health stay out of a pure retail tenant's way until then.
export const RECIPE_USE_CASES = ['hospitality', 'quick_service', 'manufacturing'];

// The use cases inventory-api serves /recipes/health to (RequireOutletUseCase in
// handlers/inventory.go). Outside them the page would 403, so no nav entry is offered.
export const HEALTH_USE_CASES = ['hospitality', 'quick_service', 'warehouse', 'manufacturing', 'retail'];

/** Whether the tenant works with recipes: a recipe use case, or recipes already on record. */
export function usesRecipes(useCase: string | undefined, hasRecipes: boolean): boolean {
  if (useCase && RECIPE_USE_CASES.includes(useCase)) return true;
  return hasRecipes;
}

/** Whether the health page (recipe wording, or stock-only wording without recipes) applies. */
export function hasHealthPage(useCase: string | undefined): boolean {
  return !useCase || HEALTH_USE_CASES.includes(useCase);
}

// Procurement is a universal capability, not a use_case-specific one: any business — even a
// pure-services or mixed goods+services tenant — can buy from suppliers and raise LPOs/RFQs.
// These keys are therefore never hidden by use_case (they remain subject to subscription gating
// via MODULE_FEATURE, e.g. purchase_orders).
export const UNIVERSAL_MODULES = new Set<string>([
  'requisitions', 'rfqs', 'purchase_orders', 'returns', 'contracts', 'suppliers',
  // Bundles spans retail kits, hospitality room-rate/board plans, and service sessions — not
  // scoped to one use case. Reservations is a stock concept underlying order fulfillment for
  // any use case that tracks stock (every use case already has 'stock' in its module list).
  'bundles', 'reservations',
]);

// Gating is driven by the SELECTED outlet's use_case for everyone (admins included).
// When no specific outlet is selected — the HQ "All Outlets" view, where useCase is
// undefined — the full module superset is shown. An unrecognised use_case also falls
// through to "show all" so a new use_case never silently hides modules.
export function hasModule(key: string | undefined, useCase: string | undefined): boolean {
  if (!key) return true; // no key = always visible
  if (UNIVERSAL_MODULES.has(key)) return true; // procurement is available to every business type
  if (!useCase) return true; // no outlet selected (HQ aggregate) → full superset
  const modules = USE_CASE_MODULES[useCase];
  if (!modules) return true; // unknown use_case → don't hide anything
  return modules.includes(key);
}
