# Inventory UI - Architecture

**Framework:** Next.js 15 (App Router)
**Language:** TypeScript
**Backend:** inventory-api at `inventoryapi.codevertexitsolutions.com`
**Auth:** OIDC/OAuth2 via auth-ui (`sso.codevertexitsolutions.com`)
**Last updated:** 2026-05-21
**Status:** Fully implemented — Sprint 1 MVP + Phase 15 post-MVP pages all shipped

---

## High-Level Overview

```
┌──────────────┐     OIDC      ┌──────────────┐
│   auth-ui    │◄──────────────│  inventory-ui │
│   (SSO)      │───────────────►│  Next.js 15  │
└──────────────┘   JWT tokens   └──────┬───────┘
                                       │
                              REST (JWT auth)
                                       │
                                ┌──────▼───────┐
                                │ inventory-api │
                                │   :4003       │
                                └──────────────┘
```

---

## Implemented Route Structure (as of 2026-05-21)

```
src/app/
  layout.tsx                                  # Root layout (providers)
  page.tsx                                    # Redirect to /[orgSlug]/dashboard
  not-found.tsx                               # 404 page
  [orgSlug]/
    layout.tsx                                # Tenant layout (sidebar, header)
    dashboard/page.tsx                        # Stock overview dashboard
    catalog/page.tsx                          # Item catalog with search/pagination
    catalog/[id]/page.tsx                     # Item detail (stock levels, activity, pricing tiers)
    catalog/[id]/recipe/page.tsx              # Recipe/BOM viewer
    warehouses/page.tsx                       # Warehouse list
    warehouses/[id]/locations/page.tsx        # Warehouse locations (placeholder)
    adjustments/page.tsx                      # Stock adjustment form
    suppliers/page.tsx                        # Supplier management
    purchase-orders/page.tsx                  # Purchase orders list
    transfers/page.tsx                        # Stock transfers
    lots/page.tsx                             # Lots & batches
    reservations/page.tsx                     # Reservation browser
    modifiers/page.tsx                        # Modifier groups
    recipes/page.tsx                          # Recipes list
    recipes/[recipeId]/page.tsx               # Recipe detail
    categories/page.tsx                       # Item categories
    units/page.tsx                            # Units of measure
    stock/page.tsx                            # Stock list view
    settings/page.tsx                         # Settings
    platform/page.tsx                         # Platform admin (super_admin/admin only)
    unauthorized/page.tsx                     # 403 access denied
    auth/callback/page.tsx                    # OIDC callback
    auth/login/page.tsx                       # Login redirect
```

---

## Authentication Flow

1. User navigates to inventory-ui
2. `AuthProvider` checks for valid JWT in local storage
3. If no token: redirect to auth-ui login page (`sso.codevertexitsolutions.com`)
4. auth-ui authenticates user, redirects back with authorization code
5. inventory-ui exchanges code for JWT tokens (access + refresh)
6. Axios interceptor attaches `Authorization: Bearer <token>` to all API calls
7. On 401: interceptor attempts token refresh; if that fails, redirect to login

---

## Data Fetching Strategy

| Layer | Tool | Use Case |
|-------|------|----------|
| Server components | `fetch()` with revalidation | Initial page data (SSR) |
| Client components | TanStack Query | Interactive data, polling, mutations |
| Global state | Zustand | Auth tokens, tenant context, UI preferences |

**Caching policy:**
- Stock levels: `staleTime: 30s`, `refetchInterval: 60s` (near-real-time)
- Item metadata: `staleTime: 5m` (changes infrequently)
- Reservations: `staleTime: 10s` (operational data)

---

## API Client

Axios instance configured with:
- `baseURL`: `https://inventoryapi.codevertexitsolutions.com/v1/{tenantID}`
- Request interceptor: attach JWT from Zustand auth store
- Response interceptor: handle 401 (token refresh), 403 (redirect to unauthorized page)
- Timeout: 10 seconds

Key API functions:

```typescript
getStockAvailability(sku: string): Promise<StockAvailability>
bulkAvailability(skus: string[]): Promise<StockAvailability[]>
createAdjustment(data: AdjustmentRequest): Promise<AdjustmentResponse>
```

---

## Component Architecture

### Layout Components

- **RootLayout:** Wraps app with AuthProvider, QueryClientProvider, ThemeProvider
- **TenantLayout:** Sidebar navigation + header. Reads tenant slug from URL params. Shows outlet selector (Busia only for MVP).

### Page Components

- **DashboardPage:** Summary cards (total items, low stock count, recent movements) + stock overview table
- **StockListPage:** Full-width data table with sorting, filtering, search. Columns: SKU, Name, Category, On Hand, Available, Reserved, Status
- **ItemDetailPage:** Stock levels per warehouse, recent reservations/consumptions, adjustment history

### Shared Components

- **StockStatusBadge:** Green (in stock), Yellow (low), Red (out of stock)
- **AvailabilityBar:** Visual bar showing on_hand breakdown (available vs reserved)
- **DataTable:** Reusable table with TanStack Table for sorting/filtering/pagination

---

## Tenant Routing

URL structure: `/{tenant-slug}/...`

For MVP, only `urban-loft` is active. The tenant slug is extracted from the URL and used to:
1. Set the API base URL path segment
2. Scope all data queries
3. Display tenant name in the header

Post-MVP: tenant discovery from JWT claims, redirect to correct tenant path.

---

## Styling

- **Tailwind CSS** for utility-first styling
- **Shadcn UI** for pre-built accessible components (Table, Card, Badge, Dialog, Form, Button)
- **Dark mode** support via `next-themes` (toggle in header)
- Design tokens aligned with BengoBox design system
