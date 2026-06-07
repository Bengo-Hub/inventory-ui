# Inventory UI — Use-Case-Modularized Pages (Retail POS Revamp)

**Created:** 2026-06-07 · **Driver:** `/.claude/plans/_audit-parts/retail-pos-audit-and-roadmap-2026-06-07.md`
**Principle source:** user directive 2026-06-07 — *separate dashboards, pages, and UX components
(buttons, forms, filters, select options) by **use case**, not only by role.*

## Core principle
The generic single "Items" page conflates retail products, restaurant menu items, raw materials,
service items, and hospitality masters. **Split it into use-case-specific pages** and render only
the nav, buttons, forms, filters, categories, and select options that belong to that use case.
A page must **exclude** anything that doesn't fit its use-case data — e.g. the Retail Products page
must NOT show "Create Menu Item", recipe/modifier editors, course/station, meal-plan, or menu
categories; the Manufacturing pages must NOT show retail pricing tiers or menu modifiers.

Use case is **per-outlet** (`OutletSetting`/outlet `use_case` — see `CROSS-SERVICE-DATA-OWNERSHIP.md`),
not per-tenant. A multi-format tenant (e.g. a hotel with a retail shop + a kitchen) sees multiple
page sets, each scoped to the active outlet's use case. Gating is **(role permission) AND
(outlet use_case)** — role alone is not enough.

## Page split (from the single Items page)

### 1. Products — Retail  (`use_case ∈ {GENERAL_RETAIL, WHOLESALE, RETAIL, BOUTIQUE, HARDWARE, ELECTRONICS, PHARMACY, ...}`)
- **Columns:** Image · Product · SKU · Barcode · UOM · Cost · Retail Price · Wholesale (W.Price) · Stock · Reorder · Status.
- **Buttons:** Add Product · Import CSV · Generate Barcodes · Print Labels · Edit Multiple · Export · Refresh.
- **Filters:** Category (**retail product categories only**) · Brand · Supplier · Stock status (in/low/out) · Tax class (A/B/C/D) · Serialized · Batch/Expiry (only if perishable) · Price tier.
- **Forms/modals:** Product form (identity, barcode, UOM, pricing tiers, tax class, stock min/max, compliance flags); Pricing tiers (Retail default + Wholesale); Batch & Expiry; Serial numbers.
- **EXCLUDE:** Create Menu Item, Recipe/BOM editor, Modifiers/Modifier groups, Course/Station, meal-plan/room-rate fields, menu categories.

### 2. Catalog / Menu Items — Hospitality  (`use_case ∈ {HOSPITALITY, RESTAURANT, CAFE, BAR}`)
- **Buttons:** Create Menu Item · Menu Categories · Modifiers / Modifier Groups · Recipes (BOM) · Course/Station mapping.
- **Filters:** Menu category · Station · Course · Dietary tags · Modifier group · Availability window (happy hour).
- **Forms:** Menu item (recipe link, modifiers, prep station, course, dietary tags); Recipe (ingredients + **waste %**); Modifier group/options.
- **EXCLUDE:** Wholesale price column, retail barcode-label batch tools (allowed but secondary), serialized goods.

### 3. Manufacturing / Production  (`use_case` includes manufacturing)
- **Pages:** Raw Materials · Bill of Materials (Recipes) · Production Batches · **Breakdowns** (bulk→retail unit) · Manufactured In/Out · Production Inventory Transfer.
- **Buttons:** New Production · New Breakdown · Define BOM · Manage Raw Materials.
- **Filters:** Material type · Batch · Production status · Wastage band · Cost center.
- **Forms:** Production (product, ingredients, input qty, **wastage %**, final/yield qty, ingredient cost, labour/overhead, unit cost); Breakdown (parent SKU/UOM → child SKU/UOM, conversion factor, cost split); BOM editor.
- **EXCLUDE:** Retail pricing tiers and menu modifiers (unless the finished good is also sold — then it appears on the Retail/Catalog page in its own right).

### 4. Service Items — Services/Salon/Repair  (`use_case ∈ {SALON_SERVICE, SERVICE, REPAIR}`)
- Service items (no stock), durations, commissionable flag, linked staff; parts list for repair (drawn from retail/raw stock).
- **EXCLUDE:** stock min/max, batch/expiry, barcode label batches.

### 5. Hospitality Masters — Rooms/Facilities/Packages  (`use_case ∈ {HOSPITALITY_ROOM, HOSPITALITY_FACILITY, CONFERENCE}`)
- Room-types, facilities, conference bundles + **rates** (inventory owns rates via `ItemPricing`/`Bundle`).
- Distinct page; never shown on Retail Products.

### 6. Assets — Asset Register  (admin, any use case)
- Fixed-asset register (warranty alerts, allocation, maintenance, depreciation) — separate from sellable inventory.

## Dashboards by use case
- **Retail:** sales, stock value, deadstock, fast/slow movers, reorder due, margin.
- **Hospitality:** menu engineering (stars/dogs), food-cost %, station throughput, recipe cost variance.
- **Manufacturing:** production output, **wastage %**, raw-material consumption, WIP, breakdown yield.
- **Services/Repair:** job throughput, technician utilisation, parts consumption.
(POS-side dashboards mirror this: retail register vs restaurant floor/KDS vs salon calendar vs repair job board.)

## Mechanism (shared, drives both inventory-ui and pos-ui)
- A per-outlet **`useCaseConfig`** (derived from outlet `use_case` + `OutletSetting`) drives: visible nav
  items, page routing, visible action buttons, filter sets, **category/tax/UOM select sources**, and
  the **form schema** rendered. Implement as a typed config map keyed by `use_case`.
- Category/tax/UOM option lists are **sourced per use case** (retail categories vs menu categories vs
  raw-material categories) so a page never offers options outside its domain.
- Each action button is gated `hasPermission(...) && useCaseAllows(action)`.
- Backend already scopes data by `use_case`; the UI must not surface cross-use-case fields/filters.

## Where this lands in the plan
- **Phase 4 (inventory-ui):** build the page split + `useCaseConfig`; do NOT ship a single generic Items page.
- **Phase 2 (pos-ui):** the retail register and product grid are the retail use-case surface; exclude
  hospitality (course/station/modifier) controls and menu categories. See
  `pos-service/pos-ui/docs/use-case-designs/retail-pos.md`.
- Shared lib opportunity: a `@bengo-hub` use-case-config hook reused by pos-ui + inventory-ui.
