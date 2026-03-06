# Sprint 1 - MVP Foundation (March 17, 2026)

**Status:** In Progress (scaffold complete)
**Start:** 2026-03-06
**Deadline:** 2026-03-17
**Goal:** Ship a functional inventory-ui with SSO, stock visibility, and operational dashboard for Urban Loft Cafe (Busia outlet)

---

## Progress Update (March 6, 2026)

**Scaffold complete.** Full Next.js 16 app with SSO/PKCE, multi-tenant `[orgSlug]`, Zustand auth, PWA, Tailwind v4. Pages: dashboard, catalog (list + detail), warehouses, adjustments, settings, platform admin (role-gated). Auth callback, API client (inventoryapi.codevertexitsolutions.com), sidebar with platform section. **RBAC & data (2026-03-06):** Roles/permissions from auth-api `GET /me` via TanStack Query with 5 min TTL (`hooks/useMe`); used for nav visibility (platform admin for super_admin/admin) and route protection. All fetches use TanStack Query (QueryClientProvider in layout). **Remaining:** Replace mock/placeholder data with real API calls; run `pnpm install` and `pnpm build`; deploy via devops-k8s (values.yaml at `apps/inventory-ui/`). **Tenant/brand:** UI uses [orgSlug] or NEXT_PUBLIC_TENANT_SLUG; tenant from auth-api GET /api/v1/tenants/by-slug/{slug}; branding from notifications-api GET /api/v1/{tenantId}/branding (BrandingProvider pattern). Inventory-api: auth-api is source of truth for roles/permissions; Redis and NATS/outbox documented in plan.md.

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

- [ ] **F1-03:** Implement OIDC login flow with auth-ui
  - Redirect to `sso.codevertexitsolutions.com` for login
  - Handle callback, exchange code for tokens
  - Store tokens in secure cookie or local storage
- [ ] **F1-04:** Create `AuthProvider` component
  - Wrap app in auth context
  - Expose `user`, `isAuthenticated`, `login()`, `logout()`
  - Auto-refresh tokens before expiry
- [ ] **F1-05:** Create `ProtectedRoute` wrapper
  - Redirect to login if not authenticated
  - Extract tenant slug from JWT claims

### API Client

- [ ] **F1-06:** Set up Axios instance with inventory-api base URL
  - Request interceptor: attach JWT Bearer token
  - Response interceptor: handle 401 (refresh), 403 (unauthorized page)
  - Base URL: `https://inventoryapi.codevertexitsolutions.com/v1/{tenantID}`
- [ ] **F1-07:** Create typed API functions
  - `getStockAvailability(sku)` -> `StockAvailability`
  - `bulkAvailability(skus)` -> `StockAvailability[]`
  - Define TypeScript interfaces matching API response shapes
- [ ] **F1-08:** Configure TanStack Query client
  - Default `staleTime: 30s` for stock data
  - Set up `QueryClientProvider` in root layout
  - Create custom hooks: `useStockAvailability`, `useBulkAvailability`

### Layout & Navigation

- [x] **F1-09:** Create root layout with providers
  - AuthProvider, QueryClientProvider, ThemeProvider (next-themes)
  - Global styles, font loading (Inter + JetBrains Mono)
- [x] **F1-10:** Create tenant layout with sidebar and header
  - Sidebar: Dashboard, Stock, Adjustments (P1) links
  - Header: user info, tenant name, outlet selector (Busia only), dark mode toggle
  - Responsive: full sidebar on desktop, collapsed on tablet, hidden on mobile
- [ ] **F1-11:** Implement outlet selector component
  - MVP: single option (Busia - MAIN warehouse)
  - Store selected outlet in Zustand for filtering

### Dashboard Page

- [ ] **F1-12:** Build dashboard page at `/[tenant]/dashboard`
  - 4 summary cards: total items, low stock count, out of stock count, total value
  - Stock overview table: top items by lowest availability
  - Auto-refresh every 60 seconds
- [ ] **F1-13:** Create summary card components
  - Animated count-up numbers
  - Color-coded borders (green/amber/red)
  - Loading skeletons

### Stock List Page

- [ ] **F1-14:** Build stock list page at `/[tenant]/stock`
  - Data table with columns: SKU, Name, Category, On Hand, Available, Reserved, Status
  - Sortable columns, text search, category filter dropdown
  - Status badges: In Stock (green), Low (amber), Out of Stock (red)
- [ ] **F1-15:** Implement pagination
  - 25 items per page
  - Client-side pagination (39 items fits in memory for MVP)
- [ ] **F1-16:** Add row click navigation to item detail

### Item Detail Page

- [ ] **F1-17:** Build item detail page at `/[tenant]/stock/[sku]`
  - Item header: name, SKU, category, UoM
  - Stock summary card with availability bar visualization
  - Warehouse balance table (single row for MAIN)
- [ ] **F1-18:** Show recent reservations/consumptions for this item
  - Timeline component showing last 10 operations
  - If no data available, show empty state

### Platform Admin vs Tenant Admin (P1)

- [ ] **F1-19:** Implement role-based view separation
  - Platform admin sees tenant switcher, system config
  - Tenant admin sees only their outlet data
  - Read role from JWT claims
- [ ] **F1-20:** Hide admin-only navigation items for non-admin users

### Stock Adjustment Form (P1)

- [ ] **F1-21:** Build adjustment form at `/[tenant]/adjustments/new`
  - Item selector (searchable by SKU/name)
  - Quantity input (positive/negative)
  - Reason dropdown (Waste, Damage, Recount, Transfer, Other)
  - Notes textarea
- [ ] **F1-22:** Implement form validation and submission
  - Validate against API, show success/error toast
  - Redirect to stock list after success

---

## Definition of Done

- [ ] SSO login/logout works with auth-ui
- [ ] Dashboard loads and displays stock summary for all 39 items
- [ ] Stock list table is searchable, sortable, and paginated
- [ ] Item detail page shows correct balances from inventory-api
- [ ] Responsive layout works on desktop and tablet
- [ ] No console errors, no TypeScript strict-mode violations
- [ ] Deployed to staging environment

---

## Dependencies

| Blocked By | Task |
|------------|------|
| inventory-api deployed to staging | F1-06 through F1-18 |
| auth-ui OIDC endpoints available | F1-03, F1-04, F1-05 |
| Shadcn UI installed and configured | F1-09, F1-10 |
| inventory-api `/adjustments` endpoint (P1) | F1-21, F1-22 |

---

## Out of Scope

- Recipe/BOM viewer UI
- Reservation browser
- PWA/offline support
- Superset embedded dashboards
- Procurement/supplier management
- Notification preferences UI
