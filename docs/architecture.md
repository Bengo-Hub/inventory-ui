# Inventory UI - Architecture

**Framework:** Next.js 15 (App Router)
**Language:** TypeScript
**Backend:** inventory-api at `inventoryapi.codevertexitsolutions.com`
**Auth:** OIDC/OAuth2 via auth-ui (`sso.codevertexitsolutions.com`)

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

## Project Layout (Target)

```
inventory-ui/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (providers, global styles)
│   │   ├── page.tsx                # Redirect to /[tenant]/dashboard
│   │   ├── login/page.tsx          # OIDC login redirect
│   │   └── [tenant]/
│   │       ├── layout.tsx          # Tenant layout (sidebar, header)
│   │       ├── dashboard/page.tsx  # Stock overview dashboard
│   │       ├── stock/
│   │       │   ├── page.tsx        # Stock list table
│   │       │   └── [sku]/page.tsx  # Item detail view
│   │       └── adjustments/
│   │           └── new/page.tsx    # Stock adjustment form (P1)
│   ├── components/
│   │   ├── ui/                     # Shadcn UI primitives
│   │   ├── layout/                 # Sidebar, Header, OutletSelector
│   │   ├── stock/                  # StockTable, StockCard, AvailabilityBadge
│   │   └── auth/                   # AuthProvider, ProtectedRoute
│   ├── lib/
│   │   ├── api/                    # Axios client, endpoint functions
│   │   ├── auth/                   # OIDC config, token management
│   │   └── utils/                  # Formatters, helpers
│   ├── stores/
│   │   ├── auth-store.ts           # Zustand: user, tokens, tenant
│   │   └── ui-store.ts             # Zustand: sidebar state, preferences
│   └── types/
│       ├── inventory.ts            # StockAvailability, Reservation, etc.
│       └── auth.ts                 # User, Token types
├── public/
├── docs/
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
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
