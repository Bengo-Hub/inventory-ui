# Inventory UI - UX/UI Specification

**Target users:** Warehouse managers, stock keepers, tenant admins at Urban Loft Cafe
**Device:** Desktop-first (responsive down to tablet)
**Design system:** Shadcn UI + Tailwind CSS (BengoBox theme)

---

## User Roles (MVP)

| Role | Access |
|------|--------|
| Platform Admin | All tenants, all features, system configuration |
| Tenant Admin | Own tenant: full stock visibility, adjustments, reports |
| Stock Keeper | Own tenant: view stock, make adjustments |
| Viewer | Own tenant: read-only stock visibility |

---

## Page Specifications

### 1. Dashboard (`/[tenant]/dashboard`)

**Purpose:** At-a-glance operational overview of stock health.

**Layout:**
- **Top row:** 4 summary cards
  - Total active items (count)
  - Low stock items (count, red if > 0)
  - Out of stock items (count)
  - Total stock value (KES)
- **Main area:** Stock overview table (top 20 items by lowest availability ratio)
- **Sidebar widget:** Recent stock movements (last 10)

**Data source:** `POST /availability` with all active SKUs.

**Refresh:** Auto-refresh every 60 seconds via TanStack Query.

---

### 2. Stock List (`/[tenant]/stock`)

**Purpose:** Full inventory browser with search, filter, and sort.

**Table columns:**

| Column | Source | Sortable | Filterable |
|--------|--------|----------|------------|
| SKU | `sku` | Yes | Text search |
| Name | `name` (from item metadata) | Yes | Text search |
| Category | `category` | Yes | Dropdown filter |
| On Hand | `on_hand` | Yes | Range filter |
| Available | `available` | Yes | Range filter |
| Reserved | `reserved` | Yes | -- |
| Status | Derived | Yes | Dropdown: In Stock, Low, Out of Stock |
| Unit | `unit_of_measure` | -- | -- |

**Status logic:**
- **In Stock:** `available > low_stock_threshold` (default: 10% of initial on_hand)
- **Low Stock:** `0 < available <= low_stock_threshold`
- **Out of Stock:** `available == 0`

**Actions per row:**
- Click row: navigate to item detail
- Quick adjust button (P1): opens inline adjustment form

**Pagination:** 25 items per page, server-side if item count exceeds 100.

---

### 3. Item Detail (`/[tenant]/stock/[sku]`)

**Purpose:** Deep view into a single item's stock position.

**Sections:**

1. **Header:** Item name, SKU, category, unit of measure, active status
2. **Stock summary card:** On hand / Available / Reserved with visual bar
3. **Warehouse breakdown:** Table showing per-warehouse balances (MVP: single row for MAIN)
4. **Recent activity:** Timeline of recent reservations and consumptions for this item
5. **Adjustment history** (P1): List of manual adjustments with reason codes

**Actions:**
- Adjust stock button (P1): opens adjustment form pre-filled with this item
- Back to stock list

---

### 4. Stock Adjustment Form (`/[tenant]/adjustments/new`) -- P1

**Purpose:** Record manual stock corrections.

**Form fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Item | Searchable select | Yes | Typeahead by SKU or name |
| Quantity | Number input | Yes | Positive or negative delta |
| Reason | Dropdown | Yes | Waste, Damage, Recount, Transfer, Other |
| Notes | Textarea | No | Free text for context |

**Validation:**
- Item must exist and be active
- Quantity must not result in negative on_hand
- Reason is required

**On submit:** Call `POST /adjustments` and show success/error toast.

---

## Navigation Structure

```
Sidebar:
├── Dashboard
├── Stock
│   ├── All Items
│   └── Low Stock (filtered view)
├── Adjustments (P1)
│   └── New Adjustment
└── Settings (P2)
    ├── Thresholds
    └── Users
```

---

## Visual Design Guidelines

### Color Palette

- **Primary:** BengoBox brand blue
- **Success / In Stock:** Green (`emerald-500`)
- **Warning / Low Stock:** Amber (`amber-500`)
- **Danger / Out of Stock:** Red (`red-500`)
- **Neutral:** Slate tones for text and borders

### Typography

- **Headings:** Inter, semi-bold
- **Body:** Inter, regular
- **Monospace (SKUs, numbers):** JetBrains Mono

### Component Patterns

- **Cards:** Rounded corners, subtle shadow, white background (dark mode: slate-900)
- **Tables:** Striped rows, sticky header, horizontal scroll on mobile
- **Badges:** Pill-shaped with status color, small text
- **Forms:** Stacked layout, clear labels, inline validation errors
- **Toasts:** Bottom-right position, auto-dismiss after 5 seconds

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1280px (xl) | Full sidebar + content |
| >= 768px (md) | Collapsed sidebar (icons only) + content |
| < 768px (sm) | Hidden sidebar, hamburger menu, stacked cards |

---

## Loading & Empty States

- **Loading:** Skeleton placeholders matching content shape (Shadcn Skeleton component)
- **Empty table:** Illustration + "No items found" message + action button
- **Error:** Red alert banner with retry button
- **No data for filter:** "No items match your filters" with clear-filters button

---

## Accessibility

- All interactive elements keyboard-navigable
- ARIA labels on icon-only buttons
- Color is never the sole indicator (badges include text labels)
- Focus rings on all focusable elements
- Minimum contrast ratio: 4.5:1
