# Inventory UI - MVP Plan

**Last updated:** 2026-03-07
**MVP deadline:** 2026-03-17
**Framework:** Next.js 15 (App Router) + React 19 + TypeScript
**Styling:** Tailwind CSS + Shadcn UI
**Backend:** inventory-api (`inventoryapi.codevertexitsolutions.com`, port 4003)
**Auth:** SSO via auth-ui (OIDC/OAuth2 from `sso.codevertexitsolutions.com`)

---

## Current State

The inventory-ui repository is scaffolded with SSO, [orgSlug] routes, dashboard, catalog, warehouses, adjustments, settings, and platform admin.

**RBAC (2026-03-07):**
- **useMe:** `hooks/useMe.ts` loads current user and RBAC from auth-api `GET /me` using **TanStack Query** with 5 min TTL (`staleTime`/`gcTime`); returns `user`, `roles`, `permissions`, `hasRole`, `hasPermission`, `isAuthenticated`.
- **hasRole / hasPermission:** Exposed by useMe; used for nav visibility and optional per-route checks. Permission codes align with inventory-api `docs/rbac-and-seed.md`: `items:read`, `warehouses:read`, `adjustments:read`, etc.
- **Permission-based nav/sidebar:** `components/sidebar.tsx` filters routes by `hasPermission(permission)` (e.g. Catalog → `items:read`, Warehouses → `warehouses:read`, Adjustments → `adjustments:read`); platform admin section gated by `hasRole('super_admin')` or `hasRole('admin')`.
- **Route protection:** `providers/auth-provider.tsx` redirects unauthenticated users to SSO; on 403 from `GET /me` redirects to `/[orgSlug]/unauthorized`.
- **403 and 404 pages:** `app/[orgSlug]/unauthorized/page.tsx` (access denied), `app/not-found.tsx` (404).
- **Data fetches:** Page-level data uses **TanStack Query** (catalog, warehouses, adjustments, dashboard, settings, platform). Tenant lookup (`lib/api/tenant.ts`) and branding (`lib/api/branding.ts`) use raw `fetch`; consider wrapping in useQuery for caching/TTL consistency later.

Inventory-api uses auth-api as source of truth for roles/permissions; see inventory-api `docs/rbac-and-seed.md`. DevOps: see **DevOps file locations** below.

---

## MVP Scope (March 17 Deliverables)

### P0 - Must Ship

| # | Task | Status |
|---|------|--------|
| 1 | SSO integration: login/logout via auth-ui OIDC flow | Not started |
| 2 | Tenant-aware routing: `/[tenant]/...` URL structure | Not started |
| 3 | Dashboard shell: sidebar nav, header with user info, outlet selector (Busia only) | Not started |
| 4 | Stock overview page: table of all items with current on_hand, available, reserved | Not started |
| 5 | Single item detail view: stock levels, reservation history | Not started |
| 6 | API client setup: Axios with JWT interceptor calling inventory-api | Not started |

### P1 - Should Ship

| # | Task | Status |
|---|------|--------|
| 7 | Stock adjustment form: manual corrections with reason code | Not started |
| 8 | Low-stock indicators: highlight items below threshold | Not started |
| 9 | Search and filter: by category, SKU, name, stock status | Not started |
| 10 | Platform admin vs tenant admin view separation | Not started |

### P2 - Post-MVP

| # | Task | Status |
|---|------|--------|
| 11 | Recipe/BOM viewer: show ingredient breakdown per menu item | Not started |
| 12 | Reservation browser: view active reservations by order | Not started |
| 13 | PWA support: offline-capable with service worker | Not started |
| 14 | Superset embedded dashboards for BI | Not started |

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
