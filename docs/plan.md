# Inventory UI - MVP Plan

**Last updated:** 2026-05-22
**MVP deadline:** 2026-03-17
**Framework:** Next.js 15 (App Router) + React 19 + TypeScript
**Styling:** Tailwind CSS + Shadcn UI
**Backend:** inventory-api (`inventoryapi.codevertexitsolutions.com`, port 4003)
**Auth:** SSO via auth-ui (OIDC/OAuth2 from `sso.codevertexitsolutions.com`)

---

## Current State (2026-05-21)

inventory-ui is **fully implemented** — Sprint 1 MVP plus Phase 15 post-MVP pages all shipped. All P0 and P1 tasks are complete. 2026-05-22 audit round added full CRUD: Items create/edit/delete (ItemFormDialog), Warehouses CRUD + location tree (replaced Coming Soon), PO creation dialog with ItemSearchInput, delete actions on categories/units/suppliers, ItemSearchInput autocomplete in adjustments and transfers. URL prefix bugs fixed in modifiers and settings APIs.

**RBAC (2026-03-07):**
- **useMe:** `hooks/useMe.ts` loads current user and RBAC from auth-api `GET /me` using **TanStack Query** with 5 min TTL (`staleTime`/`gcTime`); returns `user`, `roles`, `permissions`, `hasRole`, `hasPermission`, `isAuthenticated`.
- **hasRole / hasPermission:** Exposed by useMe; used for nav visibility and optional per-route checks. Permission codes align with inventory-api `docs/rbac-and-seed.md`: `items:read`, `warehouses:read`, `adjustments:read`, etc.
- **Permission-based nav/sidebar:** `components/sidebar.tsx` filters routes by `hasPermission(permission)` (e.g. Catalog → `items:read`, Warehouses → `warehouses:read`, Adjustments → `adjustments:read`); platform admin section gated by `hasRole('super_admin')` or `hasRole('admin')`.
- **Route protection:** `providers/auth-provider.tsx` redirects unauthenticated users to SSO; on 403 from `GET /me` redirects to `/[orgSlug]/unauthorized`.
- **403 and 404 pages:** `app/[orgSlug]/unauthorized/page.tsx` (access denied), `app/not-found.tsx` (404).
- **Data fetches:** Page-level data uses **TanStack Query** (catalog, warehouses, adjustments, dashboard, settings, platform). Tenant lookup (`lib/api/tenant.ts`) and branding (`lib/api/branding.ts`) use raw `fetch`; consider wrapping in useQuery for caching/TTL consistency later.

Inventory-api uses auth-api as source of truth for roles/permissions; see inventory-api `docs/rbac-and-seed.md`. DevOps: see **DevOps file locations** below.

---

## MVP Scope Status (2026-05-21)

### P0 - Completed

| # | Task | Status |
|---|------|--------|
| 1 | SSO integration: login/logout via auth-ui OIDC flow | ✅ Done |
| 2 | Tenant-aware routing: `/[orgSlug]/...` URL structure | ✅ Done |
| 3 | Dashboard shell: sidebar nav, header, outlet selector | ✅ Done |
| 4 | Stock overview page: item table with search, pagination | ✅ Done (`catalog/page.tsx`) |
| 5 | Single item detail view: stock levels, activity | ✅ Done (`catalog/[id]/page.tsx`) |
| 6 | API client setup: Axios with JWT interceptor | ✅ Done |

### P1 - Completed

| # | Task | Status |
|---|------|--------|
| 7 | Stock adjustment form | ✅ Done (`adjustments/page.tsx`) |
| 8 | Low-stock indicators | ✅ Done |
| 9 | Search and filter | ✅ Done |
| 10 | Platform admin vs tenant admin view separation | ✅ Done (via `isPlatformOwner` gate) |

### Phase 15 (Post-MVP) — Completed

| # | Task | Status |
|---|------|--------|
| 11 | Recipe/BOM viewer (`catalog/[id]/recipe/page.tsx`) | ✅ Done |
| 12 | Reservation browser (`reservations/page.tsx`) | ✅ Done |
| 13 | PWA support | ✅ Done |
| 14 | Purchase Orders (`purchase-orders/page.tsx`) | ✅ Done |
| 15 | Suppliers (`suppliers/page.tsx`) | ✅ Done |
| 16 | Stock Transfers (`transfers/page.tsx`) | ✅ Done |
| 17 | Lots & Batches (`lots/page.tsx`) | ✅ Done |
| 18 | Warehouse Locations (`warehouses/[id]/locations/page.tsx`) | ✅ Done (full CRUD tree — 2026-05-22) |
| 19 | Pricing Tiers on item detail | ✅ Done |
| 20 | Categories page (`categories/page.tsx`) | ✅ Done |
| 21 | Units page (`units/page.tsx`) | ✅ Done |
| 22 | Modifiers page (`modifiers/page.tsx`) | ✅ Done |
| 23 | Recipes page (`recipes/page.tsx`, `recipes/[recipeId]/page.tsx`) | ✅ Done |

### Added — 2026-05-22 Audit

| # | Task | Status |
|---|------|--------|
| 24 | Item CRUD (create/edit/delete) in catalog — ItemFormDialog | ✅ Done |
| 25 | Warehouse CRUD (create/edit/delete) | ✅ Done |
| 26 | Warehouse location tree (replaced Coming Soon) | ✅ Done |
| 27 | PO creation dialog with line items and ItemSearchInput | ✅ Done |
| 28 | ItemSearchInput autocomplete in adjustments + transfers | ✅ Done |
| 29 | Delete actions on categories, units, suppliers | ✅ Done |
| 30 | Fix URL prefix bug in modifiers.ts + inventory-settings.ts | ✅ Done |
| 31 | Standalone modifier-group list/get (modifiers page fix) | ✅ Done |

### Remaining

- [ ] Superset embedded dashboards — not started

---

## Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15 (App Router) | Server components for data fetching |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS + Shadcn UI | Consistent with other BengoBox frontends |
| State (global) | Zustand | Auth state, tenant context |
| State (server) | TanStack Query v5 | API caching, refetching |
| API client | Axios | Interceptors for JWT refresh |
| Auth | OIDC via auth-ui | Redirect flow, token storage |
| PWA | @ducanh2912/next-pwa | Post-MVP |

---

## Key Pages (MVP)

| Route | Page | Data Source |
|-------|------|-------------|
| `/[tenant]/dashboard` | Stock overview dashboard | `POST /availability` (all SKUs) |
| `/[tenant]/stock` | Stock list with table view | `POST /availability` (paginated) |
| `/[tenant]/stock/[sku]` | Item detail + balance history | `GET /items/{sku}` |
| `/[tenant]/adjustments/new` | Stock adjustment form (P1) | `POST /adjustments` |

---

## Constraints

- **Single outlet MVP:** Only Busia warehouse `MAIN` is active. Outlet selector shows one option.
- **Read-heavy:** MVP UI is primarily read-only. Write operations limited to stock adjustments (P1).
- **No recipe management UI** in MVP. Recipes are seeded via backend.
- **No procurement/PO workflows** in MVP.

---

## DevOps file locations (reference only; do not change in this task)

| Asset | Location |
|-------|----------|
| Build script | `inventory-ui/build.sh` (repo root) |
| Dockerfile | `inventory-ui/Dockerfile` (repo root) |
| Deploy workflow | `inventory-ui/.github/workflows/deploy.yml` |
| Helm values | `devops-k8s/apps/inventory-ui/values.yaml` |

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| inventory-api deployed and accessible | Required | All data comes from API |
| auth-ui SSO flow | Required | Login/logout |
| shared-auth-client JWKS | Required | Token validation |
| Shadcn UI components | Available | Use existing BengoBox component patterns |
