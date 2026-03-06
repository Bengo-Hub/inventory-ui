# Inventory UI - MVP Plan

**Last updated:** 2026-03-06
**MVP deadline:** 2026-03-17
**Framework:** Next.js 15 (App Router) + React 19 + TypeScript
**Styling:** Tailwind CSS + Shadcn UI
**Backend:** inventory-api (`inventoryapi.codevertexitsolutions.com`, port 4003)
**Auth:** SSO via auth-ui (OIDC/OAuth2 from `sso.codevertexitsolutions.com`)

---

## Current State

The inventory-ui repository is scaffolded but has no implemented pages or components. The `docs/plan.md` outlined a 3-sprint roadmap (Foundation, Catalog & Stock, Procurement). For the MVP, the scope is compressed to a single sprint focused on operational visibility.

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

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| inventory-api deployed and accessible | Required | All data comes from API |
| auth-ui SSO flow | Required | Login/logout |
| shared-auth-client JWKS | Required | Token validation |
| Shadcn UI components | Available | Use existing BengoBox component patterns |
