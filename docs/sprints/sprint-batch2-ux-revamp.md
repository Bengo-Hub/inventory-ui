# Sprint: Batch 2 — UX Revamp & Feature Completeness

**Created:** 2026-05-27  
**Status:** ✅ Complete — `pnpm build` clean, pushed to `master` (commit `7f4b543`)  
**Goal:** Close 8 UX gaps and bugs identified after Batch 1 launch; extended with catalog CRUD actions and adjustments crash fix

---

## Changes By File

### New Files
| File | Description |
|------|-------------|
| `src/components/ui/sheet.tsx` | Reusable right-side slide-in `Sheet` panel. Exports: `Sheet`, `SheetHeader`, `SheetTitle`, `SheetContent`. Supports Escape-to-close, backdrop click, width variants (sm/md/lg), and `animate-in slide-in-from-right` animation. |

### Modified Files

| File | Summary of Changes |
|------|-------------------|
| `src/lib/api/recipes.ts` | Fixed URL prefix: `/api/v1/tenants/${orgSlug}/` → `/api/v1/${orgSlug}/` in all 5 functions. Was causing 404 on all recipe operations. |
| `src/lib/api/items.ts` | `list()` params extended: `unit_id?: string`, `category_id?: string` |
| `src/lib/api/units.ts` | `Unit` interface: added `item_count?: number` |
| `src/lib/api/categories.ts` | `Category`: added `parent_id?`, `parent_name?`. Added `CategoryPayload` interface. Added `create()` and `update()` methods to API. |
| `src/hooks/useItems.ts` | `useItems()` params extended with `unit_id?` and `category_id?` |
| `src/components/inventory/ItemSearchInput.tsx` | New `fixedDropdown?: boolean` prop. When true, measures input position via `useLayoutEffect` + `getBoundingClientRect` and renders dropdown with `position:fixed` + absolute coordinates. Prevents clipping inside `overflow:hidden` containers (modals). |
| `src/app/[orgSlug]/adjustments/page.tsx` | Full revamp: tabs removed. History table is now the default view. `AdjustmentModal` component extracted (pre-fill support via `prefillSku`/`prefillName`). `+ New Adjustment` button opens modal. |
| `src/app/[orgSlug]/transfers/page.tsx` | Modal expanded to `max-w-3xl` with `overflow-y-auto` on card body; `ItemSearchInput` uses `fixedDropdown`; `availableQty` shown per item row from balance `available` field. |
| `src/app/[orgSlug]/lots/page.tsx` | `SupplierRefCombobox` local component replaces plain text input for Supplier Reference. Helper texts on Lot Number, Cost Per Unit, Expiry Date, Manufacture Date. |
| `src/app/[orgSlug]/stock/page.tsx` | Full revamp: `StockDrawer` component (Sheet) shows stats grid + toggleable inline adjustment form (uses `useCreateAdjustment`) + recent adjustments (uses `useAdjustments`). `SlidersHorizontal` action button per row. Out-of-stock / low-stock alert banners at top. |
| `src/app/[orgSlug]/units/page.tsx` | Eye button per row opens `UnitDrawer` (Sheet) showing type label + linked items list (`useItems({ unit_id })`). `item_count` from backend displayed in table. |
| `src/app/[orgSlug]/categories/page.tsx` | Parent select in create/edit modal (excludes self to prevent circular refs). "Parent" column in table. Hierarchical sort: roots first, children with `└─` prefix. Replaced `Tag` icon with `FolderTree`. |
| `src/app/[orgSlug]/catalog/page.tsx` | Full revamp: search input in own row, category filter pills in separate scrollable row. Eye button → `ItemDrawer` (Sheet) with details/flags/tags. Edit button → `ItemFormDialog` pre-filled (wired to `useUpdateItem`). Delete button → inline confirmation dialog (wired to `useDeleteItem`). |
| `src/lib/api/stock.ts` | `StockAdjustment` interface rewritten to snake_case matching backend fields (`item_id`, `item_name`, `quantity_change`, `adjusted_at`). `listAdjustments` made async to unwrap `{ data, total }` paginated envelope. |

---

## Architecture Notes

### Sheet Component Pattern
All side drawers follow the same composition:
```tsx
<Sheet open={!!selectedItem} onClose={() => setSelectedItem(null)} width="md">
  <SheetHeader>
    <SheetTitle>...</SheetTitle>
    <button onClick={onClose}><X /></button>
  </SheetHeader>
  <SheetContent>
    {/* content */}
  </SheetContent>
</Sheet>
```
The `Sheet` component handles: fixed positioning, backdrop, z-index, overflow scrolling, Escape key, and slide animation.

### ItemSearchInput fixedDropdown
Needed when `ItemSearchInput` is inside a scrollable/overflow-hidden container (modal). The input ref is measured on each render via `useLayoutEffect`. The dropdown `<ul>` is rendered with `position: fixed`, `top`, `left`, `width` set from the bounding rect. This ensures the dropdown is always visible even if the parent has `overflow: hidden`.

### Category Filter Architecture
Previously hardcoded `const CATEGORIES = ['All', 'Raw Materials', ...]`. Now:
1. `useCategories(orgSlug)` fetches categories from backend
2. Pills render from API data
3. Selected category stores the `id` (UUID), not name
4. `useItems(orgSlug, { category_id: selectedId })` sends filter to backend
5. Backend `GET /inventory/items?category_id={uuid}` applies `WHERE category_id = $1`

---

## Testing

| Test | Result |
|------|--------|
| `pnpm build` | ✅ Zero TS errors, 27 routes compiled (commit `7f4b543`) |
| Recipes CRUD | ✅ 201/200 (URL fixed) |
| Adjustments modal | ✅ History visible by default, modal opens correctly |
| Adjustments crash | ✅ `TypeError: N?.slice` fixed — snake_case interface + envelope unwrap |
| Transfers dropdown | ✅ Dropdown visible above modal content |
| Units drawer | ✅ Eye button → Sheet with type + items |
| Categories parent | ✅ Parent select available, └─ hierarchy rendered |
| Catalog filter | ✅ Pills from API, category_id passed to items query |
| Catalog CRUD | ✅ Eye/Edit/Delete buttons per row; create/edit dialogs; delete confirm |

---

## References

- [Backend Sprint Doc](../../inventory-api/docs/sprints/sprint-batch2-ux-rbac.md)
- [UX/UI Spec](../ux-ui.md)
- [Architecture](../architecture.md)
