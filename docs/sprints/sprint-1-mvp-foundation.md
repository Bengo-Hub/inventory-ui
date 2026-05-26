# Sprint 1 - MVP Foundation (March 17, 2026)

**Status:** ✅ Complete — SSO, multi-outlet, sidebar revamp, PWA, RBAC, all pages data-integrated including post-MVP Phase 15 pages (recipe viewer, POs, suppliers, transfers, lots, reservations, warehouse locations, pricing tiers); Phase 2 (2026-05-27): admin outlet handling, design overhaul (DM_Sans/Outfit fonts, micro-animations), analytics API + hooks, full dashboard revamp with recharts
**Start:** 2026-03-06
**Deadline:** 2026-03-17
**Goal:** Ship a functional inventory-ui with SSO, stock visibility, and operational dashboard for Urban Loft Cafe (Busia outlet)

---

## Progress Update (March 6, 2026)

**Scaffold complete.** Full Next.js 16 app with SSO/PKCE, multi-tenant `[orgSlug]`, Zustand auth, PWA, Tailwind v4. Pages: dashboard, catalog (list + detail), warehouses, adjustments, settings, platform admin (role-gated). Auth callback, API client (inventoryapi.codevertexitsolutions.com), sidebar with platform section. **RBAC & data (2026-03-07):** Current user (roles + permissions) from auth-api `GET /me` cached with TanStack Query (`useMe`, staleTime 5 min); `hasRole`/`hasPermission` on useMe; permission-based sidebar using codes from inventory-api `docs/rbac-and-seed.md`: `items:read` (Catalog), `warehouses:read`, `adjustments:read`; route protection in AuthProvider (redirect unauthenticated to SSO, 403 from /me to `/[orgSlug]/unauthorized`); 404 not-found and 403 unauthorized pages. Page data fetches use TanStack Query; tenant and branding APIs use raw fetch (optional: migrate to useQuery later). **DevOps:** build.sh, Dockerfile, .github/workflows/deploy.yml in repo root; Helm values at `devops-k8s/apps/inventory-ui/values.yaml`. **Tenant/brand:** UI uses [orgSlug] or NEXT_PUBLIC_TENANT_SLUG; tenant from auth-api GET /api/v1/tenants/by-slug/{slug}; branding from notifications-api GET /api/v1/{tenantId}/branding (BrandingProvider pattern). Inventory-api: auth-api is source of truth for roles/permissions; no cmd/seed (see inventory-api `docs/rbac-and-seed.md`).

---

## Context

The inventory-ui repo is scaffolded (Next.js 16, React 19) with implemented pages. The inventory-api backend is live with 8 endpoints and 39 seeded items. This sprint delivers the minimum viable frontend for warehouse operators to view and manage stock. Remaining work: API data integration and production deploy.

---

## Tasks

### Project Setup

- [x] **F1-01:** Initialize Next.js 15 project with App Router, TypeScript strict mode
  - Configure `next.config.ts` with environment variables
  - Set up Tailwind CSS + Shadcn UI
  - Install core dependencies: TanStack Query, Zustand, Axios
- [x] **F1-02:** Configure path aliases and project structure
  - `@/components`, `@/lib`, `@/stores`, `@/types`
  - Set up ESLint + Prettier config aligned with BengoBox standards

### Authentication (SSO)

- [x] **F1-03:** OIDC login flow with auth-ui (`lib/auth/api.ts`, `providers/auth-provider.tsx`)
- [x] **F1-04:** `AuthProvider` wraps app; exposes `user`, auth status, auto-refresh
- [x] **F1-05:** Route protection in `AuthProvider`; redirects unauthenticated to SSO; 403 → `/unauthorized`

### API Client

- [x] **F1-06:** Axios instance (`lib/api/client.ts`) with inventory-api base URL, auth headers, outlet header
  - Request interceptor: attach JWT Bearer token
  - Response interceptor: handle 401 (refresh), 403 (unauthorized page)
  - Base URL: `https://inventoryapi.codevertexitsolutions.com/v1/{tenantID}`
- [x] **F1-07:** Typed API functions per module (`lib/api/recipes.ts`, `lib/api/modifiers.ts`, etc.)
  - _Note: original F1-07 placeholder (getStockAvailability/bulkAvailability) was superseded by per-module API files; those specific helpers were not implemented as standalone functions — all stock reads go through `lib/api/stock.ts` and the `useStock` hook instead._
- [x] **F1-08:** TanStack Query client configured; `QueryClientProvider` in root layout; custom hooks (`useMe`, `use-recipes`, `use-modifiers`)

### Layout & Navigation

- [x] **F1-09:** Create root layout with providers
  - AuthProvider, QueryClientProvider, ThemeProvider (next-themes)
  - Global styles, font loading (Inter + JetBrains Mono)
- [x] **F1-10:** Create tenant layout with sidebar and header
  - Sidebar: Dashboard, Stock, Adjustments (P1) links
  - Header: user info, tenant name, outlet selector (Busia only), dark mode toggle
  - Responsive: full sidebar on desktop, collapsed on tablet, hidden on mobile
- [x] **F1-11:** Outlet selector: `store/outlet.ts` (Zustand persist); `auth/select-outlet` page; `apiClient.setOutletID()` on rehydrate

### Dashboard Page

- [x] **F1-12:** Dashboard page (`app/[orgSlug]/page.tsx`): 4 KPI cards + recent activity feed
- [x] **F1-13:** Summary card components with icons, colors, loading states

### Stock List / Catalog Page

- [x] **F1-14:** Catalog page (`app/[orgSlug]/catalog/page.tsx`): item table with search, pagination, status badges
- [x] **F1-15:** Pagination component (`components/ui/pagination.tsx`)
- [x] **F1-16:** Row click → item detail at `/catalog/[id]`

### Item Detail Page

- [x] **F1-17:** Item detail page (`app/[orgSlug]/catalog/[id]/page.tsx`)
- [x] **F1-18:** Recent adjustments/activity shown in detail view

### Platform Admin vs Tenant Admin (P1)

- [x] **F1-19:** Role-based view via `components/auth/authorization-gate.tsx` + `permission-action-button.tsx`
- [x] **F1-20:** Platform section hidden for non-platform-owner users (sidebar `isPlatformOwner` gate)

### Stock Adjustment Form (P1)

- [x] **F1-21:** Adjustment form at `/adjustments` with item ID, type, quantity, reason, warehouse
- [x] **F1-22:** Form validation, toast success/error, TanStack Query mutation invalidation

---

## Definition of Done

- [x] SSO login/logout works with auth-ui (PKCE flow)
- [x] Dashboard loads and displays stock summary KPIs
- [x] Catalog table is searchable and paginated
- [x] Item detail page shows balances from inventory-api
- [x] Responsive layout: full sidebar on desktop, mobile overlay
- [x] Multi-outlet selector with last-used sorting
- [ ] Deployed to staging environment (pending devops)

---

## Dependencies

| Blocked By | Task |
|------------|------|
| inventory-api deployed to staging | F1-06 through F1-18 |
| auth-ui OIDC endpoints available | F1-03, F1-04, F1-05 |
| Shadcn UI installed and configured | F1-09, F1-10 |
| inventory-api `/adjustments` endpoint (P1) | F1-21, F1-22 |

---

## Out of Scope (original Sprint 1)

- PWA/offline support
- Superset embedded dashboards
- Notification preferences UI

---

## Post-MVP Pages (Phase 15 — 2026-05-20)

The following pages were added after Sprint 1 MVPcompletion as part of Phase 15:

### 15.1 Recipe / BOM Viewer
- `app/[orgSlug]/catalog/[id]/recipe/page.tsx` — fetches `GET /items/{id}/recipe`, shows ingredient table (name, qty, unit, waste %, cost). "No recipe defined" empty state.
- `catalog/[id]/page.tsx` updated: "View Recipe" link button in header.

### 15.2 Sidebar Revamp — NavGroup Pattern
- Already implemented in Sprint 1 as collapsible `NavGroupSection` with `USE_CASE_MODULES` gating. No changes needed.

### 15.3 Purchase Orders & Supplier Management
- `app/[orgSlug]/purchase-orders/page.tsx` — PO list + inline detail view (line items, grand total). Already existed.
- `app/[orgSlug]/suppliers/page.tsx` — Supplier list + add/edit dialog. Already existed.

### 15.4 Stock Transfers
- `app/[orgSlug]/transfers/page.tsx` — Transfer list + create dialog. Already existed.

### 15.5 Lots & Batches
- `app/[orgSlug]/lots/page.tsx` — Lot table with expiry warnings (yellow within 30 days, red expired). Already existed.

### 15.6 Reservation Browser
- `app/[orgSlug]/reservations/page.tsx` — Active reservations table with status filter (confirmed / consumed / released).

### 15.7 Warehouse Locations
- `app/[orgSlug]/warehouses/[id]/locations/page.tsx` — Fully implemented (NOT a placeholder): hierarchical bin/shelf/aisle/zone tree using `useWarehouseLocations`, `useCreateLocation`, `useDeleteLocation` hooks. Supports add/delete with a create dialog, inline `LocationNode` recursive tree render, and empty state. _Doc previously said "Coming Soon placeholder" — this was outdated; the page is production-ready._

### 15.8 Pricing Tiers on Item Detail
- `catalog/[id]/page.tsx` updated: Pricing Tiers card (min qty, max qty, unit price). Shows "No custom pricing tiers" when empty.

---

## Phase 2 — Design Overhaul + Admin Outlet Handling + Dashboard Revamp (2026-05-27)

### 2.1 Admin/Manager Outlet Handling

- **Select-outlet page** (`auth/select-outlet/page.tsx`): HQ users (admin, inventory_admin, manager, store_manager, superuser, super_admin, isPlatformOwner, isSuperUser) see full outlet picker + "All Outlets" option at top. Non-HQ staff auto-select their assigned outlet (`user.outlet_id` fallback first active outlet) with no picker shown — mirrors pos-service pattern.
- **Header** (`components/header.tsx`): All hardcoded `slate-*` colors replaced with semantic tokens (`text-foreground`, `bg-accent`, `hover:bg-accent`, `bg-primary/20`). `OutletFilter` component already handles HQ switching.
- **Sidebar** (`components/sidebar.tsx`): Admin/manager users bypass `USE_CASE_MODULES` gating via `isAdmin` flag — all nav items (suppliers, purchase orders, lots, reservations, etc.) are always visible for admin roles.

### 2.2 Design Polish

- **Font upgrade** (`app/layout.tsx`): Replaced Geist/Geist_Mono with `DM_Sans` + `Outfit` + `JetBrains_Mono` (CSS vars `--font-dm-sans`, `--font-outfit`, `--font-jetbrains`). Matches pos-ui font stack.
- **Micro-animations** (`app/globals.css`): Added `fade-up`, `scale-in`, `shimmer`, `slide-in-right` keyframes; `.animate-*` utilities; `.stagger-children` with 40 ms nth-child delays; `.skeleton` shimmer class using `hsl(var(--muted))`.

### 2.3 Analytics API + Hooks

- **`src/lib/api/analytics.ts`** (new): `analyticsApi` object with `getTopItems`, `getStockTrends`, `getDistribution`, `getReorderAlerts`, `getEnhancedSummary`. Interfaces: `TopItem`, `StockTrendPoint`, `CategoryDistribution`, `ReorderAlert`, `AnalyticsSummary`.
- **`src/hooks/useAnalytics.ts`** (new): `useTopItems`, `useStockTrends`, `useInventoryDistribution`, `useReorderAlerts`, `useAnalyticsSummary` — all TanStack Query hooks with staleTime 2–5 min.

### 2.4 Dashboard Charts Component

- **`src/app/[orgSlug]/_components/DashboardCharts.tsx`** (new): Four exported components:
  - `StockTrendsChart` — recharts `LineChart` with brand color `#F77F00`, semantic border/tooltip colors, `ResponsiveContainer` 220 px height
  - `DistributionChart` — recharts donut `PieChart`, top 6 categories, `CHART_COLORS` array, `innerRadius=55`/`outerRadius=80`
  - `ReorderAlertsTable` — top 5 reorder alerts, destructive/amber color coding, warehouse name column
  - `TopItemsTable` — top 5 items by movement, relative progress bar per item using `units_moved / maxUnits`

### 2.5 Dashboard Page Revamp

- **`src/app/[orgSlug]/page.tsx`** (rewritten): Full dashboard with:
  - Outlet-aware welcome message (name or "all outlets" per store)
  - 4 quick action links: Adjust Stock, Purchase Order, Transfer, Stock Levels
  - 4 KPI cards: Total Items, Low Stock, Out of Stock, Pending POs (from `useAnalyticsSummary`)
  - Charts row: `StockTrendsChart` (2/3 width, `lg:col-span-2`) + `DistributionChart` (1/3 width)
  - Tables row: `ReorderAlertsTable` + `TopItemsTable` (side by side)
  - Recent activity feed with skeleton loaders, delta badges, type icons
  - `animate-fade-up` on main container; `stagger-children` + `animate-scale-in` on KPI cards

---

## Audit Notes (2026-05-26)

**Audit performed against actual codebase. Corrections and undocumented work recorded below.**

### Corrections to Sprint Doc

| Task | Claimed Status | Actual Status | Notes |
|------|---------------|---------------|-------|
| F1-07 (original placeholder) | pending | outdated | superseded by per-module API files; `getStockAvailability`/`bulkAvailability` not implemented as standalone helpers — stock reads use `lib/api/stock.ts` + `useStock` |
| 15.7 Warehouse Locations | placeholder/stub | done | Fully implemented with hierarchical tree, create/delete CRUD, and empty state — not a "Coming Soon" page |

### Undocumented Work (in code, not in sprint doc)

The following pages, hooks, and API modules exist in the codebase but were never listed in any sprint task:

**Pages (all in `app/[orgSlug]/`):**
- `categories/page.tsx` — Categories list with add/edit/delete CRUD
- `units/page.tsx` — Units of measurement management
- `modifiers/page.tsx` — Modifier groups list and management
- `recipes/page.tsx` + `recipes/[recipeId]/page.tsx` — Standalone recipes list + recipe detail page (separate from the item-level `catalog/[id]/recipe` viewer)
- `stock/page.tsx` — Stock levels/availability overview page

**Hooks (all in `src/hooks/`):**
- `useCategories.ts` — TanStack Query wrapper for categories API
- `useUnits.ts` — TanStack Query wrapper for units API
- `useInventorySettings.ts` — Inventory settings CRUD hook
- `usePricing.ts` — Pricing tier management hook
- `useStock.ts` — Stock availability queries
- `useWarehouses.ts` (extended) — includes `useWarehouseLocations`, `useCreateLocation`, `useDeleteLocation`
- `use-app-permissions.ts` — App-level permission resolution hook
- `use-biometric.ts` — PWA biometric authentication hook
- `use-pwa-update.ts` — Service worker update detection hook
- `useRBAC.ts` — Full RBAC admin hooks (listRoles, listPermissions, listAssignments, assignRole, revokeRole, myRoles, myPermissions)
- `use-subscription.ts` — Subscription gating hook with IndexedDB hydration, plan/feature/limit checks, grace period tracking

**API modules (`src/lib/api/`):**
- `categories.ts`, `units.ts`, `inventory-settings.ts`, `pricing.ts`, `stock.ts`, `rbac.ts`, `reservations.ts`, `lots.ts`, `transfers.ts`, `purchase-orders.ts`, `suppliers.ts`, `warehouses.ts` (with locations), `recipes.ts`, `modifiers.ts` — all present and typed

**Components (`src/components/`):**
- `inventory/ItemFormDialog.tsx` — Item add/edit form dialog (used on catalog detail)
- `inventory/ItemSearchInput.tsx` — Debounced item search autocomplete (used in transfers and PO create dialogs)
- `subscription/` directory — Subscription gate/wall components
- `pwa-registration.tsx`, `pwa-update-banner.tsx` — PWA install and update UI
- `outlet-filter.tsx` — Outlet filter selector component

**Other:**
- `store/outlet-filter.ts` — Outlet filter Zustand store (separate from `store/outlet.ts`)
- `store/subscription.ts` — Subscription state store with IndexedDB persistence
- `providers/branding-provider.tsx` — Tenant branding provider (fetches notifications-api branding)
