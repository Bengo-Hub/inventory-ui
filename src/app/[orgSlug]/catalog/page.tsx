'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { BarcodeDialog } from '@/components/inventory/BarcodeDialog';
import { BarcodeScanButton } from '@/components/inventory/BarcodeScanner';
import { PrintLabelsDialog } from '@/components/inventory/PrintLabelsDialog';
import { ProductsExportDialog } from '@/components/inventory/ExportDialogs';
import { DetailDrawer, type DetailField } from '@/components/inventory/DetailDrawer';
import { useItemPricing, usePricingTiers } from '@/hooks/usePricing';
import { useBulkItemStatus, useCreateItem, useHardDeleteItemAdmin, useItems, useMarkItemEOL, useRestoreItemEOL, useSetItemPrice, useUpdateItem } from '@/hooks/useItems';
import { useStock, useItemStockHistory } from '@/hooks/useStock';
import type { StockLevel } from '@/lib/api/stock';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { DataTable, type BulkAction, type DataTableColumn, type SortState } from '@bengo-hub/shared-ui-lib/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useCreateFromQuery } from '@/hooks/useCreateFromQuery';
import { useCategories } from '@/hooks/useCategories';
import { useUnits } from '@/hooks/useUnits';
import { useBulkImport } from '@/hooks/useBulkImport';
import { type CreateItemInput, type UpdateItemInput, type Item, type BulkImportResult } from '@/lib/api/items';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, BadgeCheck, Ban, Barcode, ClipboardEdit, ClipboardList, Edit2, ExternalLink, Eye, FileSpreadsheet, Filter, History, Loader2, Package, PackageX, Pencil, Plus, Printer, RotateCcw, Search, ShoppingCart, Trash2, Upload, X } from 'lucide-react';
import { ProductStockHistoryModal } from '@/components/inventory/ProductStockHistoryModal';
import { MoveStockDialog, type MoveStockItem } from '@/components/inventory/MoveStockDialog';
import { BulkAdjustStockDialog, type BulkAdjustStockItem } from '@/components/inventory/BulkAdjustStockDialog';
import { useOutletStore } from '@/store/outlet';
import { useNomenclature, useCatalogScope, catalogScopeFor, ITEM_USE_CASE_LABEL } from '@/lib/use-case-nomenclature';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeBadge } from '@bengo-hub/shared-ui-lib/subscription';
import { usePermissions, P } from '@/hooks/usePermissions';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { parseDecimal } from '@/lib/utils';


// Item types that hold physical on-hand stock — mirrors the backend's stockableTypes filter
// (extras_stock.go) and stock/page.tsx's STOCKABLE_TYPES. Gates the Move-stock action, the
// drawer's Locations panel, and the EOL-while-in-stock warning.
const STOCKABLE_TYPES = ['GOODS', 'INGREDIENT', 'EQUIPMENT'] as const;

const KES = (n?: number | null) =>
  n == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(n);

function MiniStat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

// itemToUpdateInput mirrors the item's CURRENT values into a full update payload. The item PUT
// unconditionally Sets booleans (is_active, tax_inclusive, track_*…), so a partial patch would
// clobber them to false — we resend the current values and only the caller's changed field differs.
function itemToUpdateInput(item: Item): UpdateItemInput {
  return {
    name: item.name,
    type: item.type,
    description: item.description ?? undefined,
    category_id: item.category_id ?? undefined,
    unit_id: item.unit_id ?? undefined,
    barcode: item.barcode ?? undefined,
    barcode_type: item.barcode_type ?? undefined,
    reorder_level: item.reorder_level ?? undefined,
    reorder_quantity: item.reorder_quantity ?? undefined,
    cost_price: item.cost_price ?? undefined,
    min_selling_price: item.min_selling_price ?? undefined,
    max_selling_price: item.max_selling_price ?? undefined,
    target_margin_percent: item.target_margin_percent ?? undefined,
    tax_code_id: item.tax_code_id || undefined,
    tax_inclusive: item.tax_inclusive ?? false,
    // eTIMS/KRA classification + customs fields — MUST be resent on every full-object PUT
    // (Set semantics), otherwise an inline price/field quick-edit clobbers a previously-set
    // eTIMS classification and breaks the treasury eTIMS item sync for this SKU.
    etims_item_cls_cd: item.etims_item_cls_cd ?? undefined,
    etims_pkg_unit_cd: item.etims_pkg_unit_cd ?? undefined,
    etims_qty_unit_cd: item.etims_qty_unit_cd ?? undefined,
    country_of_origin: item.country_of_origin ?? undefined,
    hs_code: item.hs_code ?? undefined,
    is_active: item.is_active,
    requires_age_verification: item.requires_age_verification,
    is_controlled_substance: item.is_controlled_substance ?? false,
    is_perishable: item.is_perishable,
    track_lots: item.track_lots,
    track_serial_numbers: item.track_serial_numbers,
    shelf_life_days: item.shelf_life_days ?? undefined,
    weight_kg: item.weight_kg ?? undefined,
    duration_minutes: item.duration_minutes ?? undefined,
    tags: item.tags,
    image_url: item.image_url ?? undefined,
    metadata: item.metadata,
    use_case: item.use_case,
    total_capacity: item.total_capacity ?? undefined,
  };
}

// PriceCell — inline-editable price in a data-table row. Click to edit, Enter/blur to save,
// Esc to cancel. Read-only (plain value) when not editable.
function PriceCell({ value, editable, saving, onSave }: {
  value: number | null;
  editable: boolean;
  saving?: boolean;
  onSave: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!editable) {
    return <span className="font-mono text-sm text-foreground">{value != null ? value.toLocaleString() : '—'}</span>;
  }

  if (editing) {
    const commit = () => {
      setEditing(false);
      const n = parseDecimal(draft, NaN);
      if (!isNaN(n) && n >= 0 && n !== value) onSave(n);
    };
    return (
      <input
        type="number"
        min="0"
        step="0.0001"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setEditing(false); }
        }}
        className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm text-right font-mono focus:ring-1 focus:ring-ring focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value != null ? String(value) : ''); setEditing(true); }}
      title="Click to edit price"
      className="group inline-flex items-center gap-1.5 font-mono text-sm text-foreground hover:text-primary transition-colors"
    >
      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : (value != null ? value.toLocaleString() : '—')}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

// ItemLocationsPanel — per-warehouse balance breakdown for one item, INCLUDING outlets it's
// currently hidden at (frozen quantity, not cleared — see membership.go's "hide" default).
// Takes the already-fetched locations/isLoading from ItemDrawer (one GET
// /inventory/stock?item_id=&include_hidden=true call) rather than fetching its own copy, so
// this panel and the Stock headline can never disagree about what's where. activeWarehouseId
// (when resolved) highlights "here" — the same warehouse Move Stock and Adjust Stock default
// to — so it's obvious which row the Stock panel's headline number came from. Hidden outlets
// sort after active ones (their stock isn't sellable there right now), active ones by
// available desc as before.
function ItemLocationsPanel({ locations, isLoading, activeWarehouseId }: { locations: StockLevel[]; isLoading: boolean; activeWarehouseId?: string }) {
  const sorted = [...locations].sort((a, b) => {
    if (!!a.removed_from_location !== !!b.removed_from_location) return a.removed_from_location ? 1 : -1;
    return b.available - a.available;
  });
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Locations</p>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-muted/50 animate-pulse" style={{ width: `${70 - i * 15}%` }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not stocked at any location yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((loc) => {
            const hidden = !!loc.removed_from_location;
            return (
              <li key={loc.id} className={`flex items-center justify-between text-sm ${hidden ? 'opacity-60' : ''}`}>
                <span className="flex items-center gap-1.5">
                  {loc.warehouse_name}
                  {loc.warehouse_id === activeWarehouseId && <Badge variant="outline" className="text-[10px]">Here</Badge>}
                  {hidden ? (
                    <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-600/40">Hidden</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Active</Badge>
                  )}
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {loc.available.toLocaleString()}
                  {loc.reserved > 0 && (
                    <span className="text-muted-foreground font-normal"> ({loc.reserved.toLocaleString()} reserved)</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ItemHistoryPreview — a compact last-5-movements preview of the exact same ledger
// ProductStockHistoryModal renders in full (same hook, same data), so the drawer shows
// movement history inline without duplicating the ledger-building logic.
function ItemHistoryPreview({ orgSlug, sku, onViewFull }: { orgSlug: string; sku: string; onViewFull: () => void }) {
  const { data, isLoading } = useItemStockHistory(orgSlug, sku, { limit: 5 });
  const rows = data?.data ?? [];
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Movement History</p>
        <button type="button" onClick={onViewFull} className="text-xs font-medium text-primary hover:underline">
          View full history
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stock movements recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={`${r.type}-${r.occurred_at}-${i}`} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground truncate">
                {r.label}{r.warehouse_name ? ` · ${r.warehouse_name}` : ''}
              </span>
              <span className={`shrink-0 font-mono font-semibold ${r.quantity_change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {r.quantity_change >= 0 ? '+' : ''}{r.quantity_change.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemDrawer({ item, onClose, onEdit, canEdit, onMoveStock, onViewHistory }: {
  item: Item; onClose: () => void; onEdit: () => void; canEdit: boolean;
  onMoveStock: () => void; onViewHistory: () => void;
}) {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const router = useRouter();
  const { can, canAny } = usePermissions();
  const canAdjust = canAny([P.ADJUSTMENTS_ADD, P.ADJUSTMENTS_MANAGE]);
  const canMoveStock = can(P.CATALOG_CHANGE);
  const isStockable = STOCKABLE_TYPES.includes(item.type as typeof STOCKABLE_TYPES[number]);

  // The warehouse Move Stock / Adjust Stock would default to — resolved the same way those
  // actions resolve it, so the Stock panel's headline number always matches what a move from
  // here would actually see (fixes a live-reported mismatch: the item list's aggregate is a
  // cross-outlet total for HQ/admin sessions, which silently disagreed with "available here").
  const activeWH = useActiveWarehouse(orgSlug);
  // include_hidden so the Locations panel below can show outlets the item is currently hidden
  // at too (frozen quantity, not cleared); the headline "Stock at X" numbers derive from
  // `locations` (active-only, filtered client-side) so they're unaffected — identical to what
  // the plain active-only query returned before.
  const { data: allLocations = [], isLoading: locationsLoading } = useStock(orgSlug, { item_id: item.id, include_hidden: true });
  const locations = useMemo(() => allLocations.filter((l) => !l.removed_from_location), [allLocations]);
  const hereBalance = locations.find((l) => l.warehouse_id === activeWH.warehouseId);
  const hereName = activeWH.allWarehouses.find((w) => w.id === activeWH.warehouseId)?.name;

  const { data: pricing = [], isLoading: pricingLoading } = useItemPricing(orgSlug, item.id);
  const { data: tiers = [] } = usePricingTiers(orgSlug);
  const tierMeta = new Map(tiers.map((t) => [t.id, t]));
  // Default tier first, then alphabetical; all-outlet rows before outlet-specific overrides.
  const profiles = [...pricing].sort((a, b) => {
    const ad = tierMeta.get(a.pricing_tier_id)?.is_default ? 0 : 1;
    const bd = tierMeta.get(b.pricing_tier_id)?.is_default ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return (a.tier_name ?? '').localeCompare(b.tier_name ?? '');
  });

  const margin =
    item.cost_price != null && item.selling_price != null && item.selling_price > 0
      ? ((item.selling_price - item.cost_price) / item.selling_price) * 100
      : null;

  const goAdjust = () => {
    router.push(`/${orgSlug}/adjustments?create=1&sku=${encodeURIComponent(item.sku)}&name=${encodeURIComponent(item.name)}`);
  };

  const fields: DetailField[] = [
    { label: 'Category', value: item.category_name },
    { label: 'Preferred Supplier', value: item.preferred_supplier_name, hideIfEmpty: true },
    { label: 'Use Case', value: item.use_case ? ITEM_USE_CASE_LABEL[item.use_case] ?? item.use_case : null, hideIfEmpty: true },
    { label: 'Barcode', value: item.barcode ? <span className="font-mono">{item.barcode}</span> : null, hideIfEmpty: true },
    {
      label: 'Tax',
      value: item.tax_code_id
        ? `${item.tax_code_id}${item.tax_rate != null ? ` · ${item.tax_rate}%` : ''}${item.tax_inclusive ? ' (incl.)' : ''}`
        : null,
      hideIfEmpty: true,
    },
    { label: 'Shelf Life', value: item.shelf_life_days != null ? `${item.shelf_life_days} days` : null, hideIfEmpty: true },
    { label: 'Weight', value: item.weight_kg != null ? `${item.weight_kg} kg` : null, hideIfEmpty: true },
    { label: 'Service Duration', value: item.duration_minutes != null ? `${item.duration_minutes} min` : null, hideIfEmpty: true },
    { label: 'Description', value: item.description, full: true, hideIfEmpty: true },
    { label: 'Created', value: new Date(item.created_at).toLocaleDateString() },
    { label: 'Updated', value: new Date(item.updated_at).toLocaleDateString() },
  ];

  return (
    <DetailDrawer
      open
      onClose={onClose}
      width="md"
      title={item.name}
      subtitle={item.category_name}
      badges={
        <>
          <Badge variant={item.is_active ? 'success' : 'outline'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>
          <Badge variant="outline" className="font-mono">{item.sku}</Badge>
          <Badge variant="default" className="capitalize">{item.type?.toLowerCase()}</Badge>
        </>
      }
      fields={fields}
      actions={
        <>
          {isStockable && canAdjust && (
            <Button size="sm" variant="outline" onClick={goAdjust}>
              <ClipboardList className="h-3.5 w-3.5 mr-1" />Adjust Stock
            </Button>
          )}
          {isStockable && canMoveStock && (
            <Button size="sm" variant="outline" onClick={onMoveStock}>
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />Move Stock
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => router.push(`/${orgSlug}/catalog/${item.id}`)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" />Full details
          </Button>
          {canEdit && (
            <Button size="sm" onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
            </Button>
          )}
        </>
      }
    >
      {/* Pricing — effective price, cost/margin, guardrails, and every tier profile. */}
      <div className="rounded-xl border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pricing</p>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Selling price</p>
            <p className="text-lg font-black text-primary leading-tight">{KES(item.selling_price)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Cost" value={KES(item.cost_price)} />
          <MiniStat label="Margin" value={margin != null ? `${margin.toFixed(1)}%` : '—'} />
          <MiniStat label="Min (Wholesale)" value={KES(item.min_selling_price)} />
          <MiniStat label="Max (Retail)" value={KES(item.max_selling_price)} />
        </div>
        <div className="pt-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground mb-2">Price profiles</p>
          {pricingLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-4 rounded bg-muted/50 animate-pulse" style={{ width: `${70 - i * 15}%` }} />
              ))}
            </div>
          ) : profiles.length > 0 ? (
            <ul className="space-y-1.5">
              {profiles.map((p, i) => {
                const meta = tierMeta.get(p.pricing_tier_id);
                return (
                  <li key={`${p.pricing_tier_id}-${p.outlet_id ?? 'all'}-${i}`} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      {p.tier_name ?? meta?.name ?? 'Tier'}
                      {meta?.is_default && <Badge variant="outline" className="text-[10px]">Default</Badge>}
                      {p.outlet_id && <Badge variant="outline" className="text-[10px]">Outlet</Badge>}
                    </span>
                    <span className="font-mono font-semibold">
                      {(p.currency ?? 'KES')} {p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No price profiles set — the selling price above is derived from the item&apos;s max/retail price.
            </p>
          )}
        </div>
      </div>

      {/* Stock — on-hand / available AT THE CURRENT LOCATION (the warehouse Move/Adjust Stock
          would default to), not a cross-outlet aggregate — so this always agrees with what
          those actions can actually see. Falls back to the item's own (cross-outlet) totals
          only when no specific warehouse is resolved (e.g. an HQ session on "All Outlets"
          with nothing selected yet). */}
      {isStockable && (
        <div className="rounded-xl border border-border p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Stock{hereName ? ` at ${hereName}` : ' (all outlets)'}
          </p>
          {locationsLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 rounded bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-black text-foreground tabular-nums">
                  {hereName ? (hereBalance?.on_hand ?? 0) : item.on_hand ?? '—'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">On hand</p>
              </div>
              <div>
                <p className="text-xl font-black text-foreground tabular-nums">
                  {hereName ? (hereBalance?.available ?? 0) : item.available ?? '—'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Available</p>
              </div>
              <div>
                <p className="text-xl font-black text-foreground tabular-nums">
                  {(hereName ? hereBalance?.reorder_point : undefined) ?? item.reorder_level ?? '—'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Reorder at</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Locations — every warehouse/outlet this item has a balance at, active or hidden (see
          MoveStockDialog's Hide/Move-stock/Move-with-zero-stock modes) — a hidden outlet still
          shows here, badged, with its frozen quantity, so it's never a silent gap. Only a full
          relocation via RelocateItemLocation's wholesale move (not reachable from this UI today)
          drops a row entirely. */}
      {isStockable && (
        <ItemLocationsPanel locations={allLocations} isLoading={locationsLoading} activeWarehouseId={activeWH.warehouseId || undefined} />
      )}

      {/* Movement history — a compact preview of the same per-item ledger (sales, transfers,
          purchases, adjustments) ProductStockHistoryModal shows in full, reused rather than
          duplicated; "View full history" opens that exact modal. */}
      {isStockable && <ItemHistoryPreview orgSlug={orgSlug} sku={item.sku} onViewFull={onViewHistory} />}

      {/* Compliance flags + tags. */}
      {(item.is_perishable || item.requires_age_verification || item.track_lots || item.is_controlled_substance || item.track_serial_numbers) && (
        <div className="flex flex-wrap gap-2">
          {item.is_perishable && <Badge variant="warning">Perishable</Badge>}
          {item.requires_age_verification && <Badge variant="warning">Age Verification</Badge>}
          {item.is_controlled_substance && <Badge variant="warning">Controlled Substance</Badge>}
          {item.track_lots && <Badge variant="outline">Track Lots</Badge>}
          {item.track_serial_numbers && <Badge variant="outline">Serial Tracked</Badge>}
        </div>
      )}

      {item.tags && item.tags.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-2">Tags</p>
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}

export default function CatalogPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params?.orgSlug as string;
  const queryClient = useQueryClient();
  const { outlet } = useOutletStore();
  // Per-use-case scoping driven by the selected outlet: catalog nomenclature
  // (Items/Products/Drugs/Services), the item types & use-cases offered, and a
  // default use-case filter so each outlet's page surfaces its own items.
  const nomenclature = useNomenclature();
  const scope = useCatalogScope();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { hasFeature } = useSubscription();
  const canBulkImport = hasFeature('bulk_import');
  // Bulk-import buttons stay visible even without the feature; a locked tap prompts to upgrade
  // rather than hiding the control. Returns true when the action may proceed.
  function guardBulkImport(): boolean {
    if (canBulkImport) return true;
    const subscribeUrl = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL || 'https://pricing.codevertexafrica.com';
    toast.info('Bulk import needs a plan upgrade', {
      description: 'Upgrade your plan to import items in bulk from a spreadsheet.',
      action: { label: 'Upgrade', onClick: () => window.open(`${subscribeUrl}/subscribe`, '_blank') },
    });
    return false;
  }
  const { can, canAny, isPlatformOwner } = usePermissions();
  const canAdd = can(P.CATALOG_ADD);
  const canChange = can(P.CATALOG_CHANGE);
  const canDelete = can(P.CATALOG_DELETE);
  // Label printing is a privileged item operation (backend gates on inventory.items.manage).
  const canPrintLabels = canAny([P.CATALOG_MANAGE, P.CATALOG_CHANGE]);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  // Preselect the outlet's default item use_case (e.g. pharmacy → PHARMACY) so the
  // page opens on its own items. Mixed-use outlets (hospitality) and HQ have no
  // default and open on "All Use Cases".
  const [useCaseFilter, setUseCaseFilter] = useState(
    () => catalogScopeFor(useOutletStore.getState().outlet?.use_case).defaultItemUseCase ?? '',
  );
  const [statusFilter, setStatusFilter] = useState('active');
  // "Not for selling" filter (mirrors Go-Digital's checkbox): show only items
  // flagged not_for_sale (ingredients, supplies).
  const [notForSaleOnly, setNotForSaleOnly] = useState(false);
  // Server-driven DataTable sort (whitelisted columns on inventory-api).
  // Defaults to lowest-stock-first so low/out-of-stock items surface immediately for triage;
  // still a normal server-driven sort the user can change/clear like any other column.
  const [sort, setSort] = useState<SortState | null>({ key: 'on_hand', dir: 'asc' });
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  // Row selection for bulk multi-select actions (keyed by item id).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<{ action: 'mark_eol' | 'deactivate' | 'activate' | 'not_for_sale_on' | 'not_for_sale_off'; ids: string[] } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  useCreateFromQuery(() => setCreateOpen(true), 'item'); // mobile quick-add → open Add Item
  const [viewItem, setViewItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  // EOL mark/restore confirm — replaces the old hard-delete-by-default flow (tenant-facing
  // off-boarding path). availableQty (when known) drives the "still has stock" warning.
  const [eolConfirm, setEolConfirm] = useState<{ sku: string; name: string; action: 'mark' | 'restore'; availableQty?: number } | null>(null);
  // Permanent hard-delete — platform-owner-only, kept fully separate from the EOL confirm above.
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<Item | null>(null);
  const [moveStockItems, setMoveStockItems] = useState<MoveStockItem[] | null>(null);
  const [bulkAdjustItems, setBulkAdjustItems] = useState<BulkAdjustStockItem[] | null>(null);
  const [barcodeItem, setBarcodeItem] = useState<Item | null>(null);
  const [historySku, setHistorySku] = useState<string | null>(null);
  const [printLabelsOpen, setPrintLabelsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const createItem = useCreateItem(orgSlug);
  const updateItem = useUpdateItem(orgSlug);
  const setItemPrice = useSetItemPrice(orgSlug);
  const markEOL = useMarkItemEOL(orgSlug);
  const restoreEOL = useRestoreItemEOL(orgSlug);
  const hardDeleteAdmin = useHardDeleteItemAdmin(orgSlug);
  const bulkStatus = useBulkItemStatus(orgSlug);
  const { data: categories } = useCategories(orgSlug);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [selectedWarehouseCode, setSelectedWarehouseCode] = useState('');
  const [warehouseCodeTouched, setWarehouseCodeTouched] = useState(false);

  const { bulkImport, isPending: isImporting, downloadTemplate } = useBulkImport(orgSlug);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  async function handleDownloadTemplate() {
    setIsDownloadingTemplate(true);
    try {
      await downloadTemplate();
    } catch {
      toast.error('Could not download the import template. Please try again.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  }
  const bulkImportWH = useActiveWarehouse(orgSlug);
  // Default the bulk-import target to the active outlet's warehouse (consistent with every
  // other write form), but never for an All-Outlets session — there the field stays blank
  // ("All Warehouses") since a per-row warehouse_code/warehouse_name is expected instead.
  useEffect(() => {
    if (warehouseCodeTouched || bulkImportWH.mustPick) return;
    const active = bulkImportWH.allWarehouses.find((w) => w.id === bulkImportWH.warehouseId);
    if (active) setSelectedWarehouseCode(active.code);
  }, [warehouseCodeTouched, bulkImportWH.mustPick, bulkImportWH.warehouseId, bulkImportWH.allWarehouses]);
  // Base-unit abbreviations for the ingredient cost cell ("0.13/g", "45/kg").
  const { data: unitsList } = useUnits(orgSlug);
  const unitAbbrById = new Map((unitsList ?? []).map((u) => [u.id, u.abbreviation]));

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xlsm'].includes(ext ?? '')) {
      toast.error('Unsupported file type. Use .csv or .xlsx');
      return;
    }
    bulkImport(file, {
      onSuccess: (data) => {
        setImportResult(data);
        const total = data.items.created + data.items.updated + data.recipes.created + data.recipes.updated;
        toast.success(`Import complete — ${total} records processed`);
      },
      onError: async (e) => toast.error(await apiErrorMessage(e, 'Import failed. Check file format and try again.')),
    }, selectedWarehouseCode || undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function runEOLConfirm() {
    if (!eolConfirm) return;
    const { sku, name, action } = eolConfirm;
    const mut = action === 'mark' ? markEOL : restoreEOL;
    mut.mutate(sku, {
      onSuccess: () => {
        toast.success(action === 'mark' ? `${name} marked End-of-Life` : `${name} restored`);
        setEolConfirm(null);
      },
      onError: async (e) => toast.error(await apiErrorMessage(e, 'Action failed')),
    });
  }

  function handleHardDelete() {
    if (!hardDeleteConfirm) return;
    hardDeleteAdmin.mutate(hardDeleteConfirm.sku, {
      onSuccess: () => {
        toast.success(`${hardDeleteConfirm.name} permanently deleted`);
        setHardDeleteConfirm(null);
        if (viewItem?.id === hardDeleteConfirm.id) setViewItem(null);
      },
      onError: async (e) =>
        toast.error(await apiErrorMessage(e, 'Failed to permanently delete — it may have transaction history; mark it End-of-Life instead')),
    });
  }

  const { data: itemsPage, isLoading, isError, refetch } = useItems(orgSlug, {
    ...(search ? { search } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(useCaseFilter ? { use_case: useCaseFilter } : {}),
    ...(notForSaleOnly ? { not_for_sale: 'only' as const } : {}),
    ...(sort ? { sort: sort.key, dir: sort.dir } : {}),
    status: statusFilter,
    page,
    limit: pageSize,
  });

  const items = itemsPage?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((itemsPage?.total ?? 0) / pageSize));

  // Bulk multi-select actions — idempotent server-side; the skipped[] breakdown
  // is surfaced in the toast so users see e.g. "2 updated, 1 skipped (in use)".
  const bulkLabel: Record<string, string> = {
    deactivate: 'deactivate', activate: 'activate',
    not_for_sale_on: 'mark not-for-sale', not_for_sale_off: 'mark for sale',
  };
  // Bulk EOL has no single backend batch endpoint (MarkItemEOL is SKU-scoped, one call each) —
  // loop with allSettled so one failure doesn't abort the rest, matching the idempotent-bulk UX
  // every other bulk action here already has.
  async function runBulkEOL(ids: string[]) {
    const targets = items.filter((i) => ids.includes(i.id));
    const results = await Promise.allSettled(targets.map((i) => markEOL.mutateAsync(i.sku)));
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    toast.success(`${succeeded} marked End-of-Life${failed ? `, ${failed} failed` : ''}`);
    setSelected(new Set());
    setBulkConfirm(null);
  }
  function runBulk(action: NonNullable<typeof bulkConfirm>['action'], ids: string[]) {
    if (action === 'mark_eol') {
      void runBulkEOL(ids);
      return;
    }
    const done = (res: { processed: number; skipped: { reason: string }[] }) => {
      const parts = [`${res.processed} ${bulkLabel[action]}${res.processed === 1 ? '' : 'd'}`];
      if (res.skipped.length) parts.push(`${res.skipped.length} skipped`);
      toast.success(parts.join(', '));
      setSelected(new Set());
      setBulkConfirm(null);
    };
    const onError = async (e: unknown) => toast.error(await apiErrorMessage(e, 'Bulk action failed'));
    bulkStatus.mutate({ ids, action }, { onSuccess: done, onError });
  }

  // Selection may reference items no longer on the current page (filter/page change);
  // resolve the currently-visible selected ids for the bulk bar count/actions.
  const selectedIds = [...selected];

  // Inline-editable Cost Price cell. Cost is only a directly-settable field for
  // GOODS/INGREDIENT/EQUIPMENT (mirrors ItemFormDialog's Cost section gate) — RECIPE cost is
  // BOM-derived and SERVICE has no purchase cost, so both stay read-only here.
  function renderCostCell(item: Item) {
    const editable = canChange && ['GOODS', 'INGREDIENT', 'EQUIPMENT'].includes(item.type);
    return (
      <PriceCell
        value={item.cost_price ?? null}
        editable={editable}
        saving={updateItem.isPending && updateItem.variables?.sku === item.sku}
        onSave={(n) =>
          updateItem.mutate(
            { sku: item.sku, data: { ...itemToUpdateInput(item), cost_price: n } },
            {
              onSuccess: () => toast.success(`${item.name} cost price updated`),
              onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update cost price')),
            },
          )
        }
      />
    );
  }

  // Inline-editable Selling Price cell — routed through the dedicated PATCH /items/{sku}/price
  // endpoint (setSellingPrice), the platform's single price-adjustment choke point: it updates
  // guardrails + tier rows, cascades to a linked RECIPE's own selling_price, and publishes
  // inventory.item.updated so POS/treasury pick up the change in real time (no separate refresh
  // needed) — the same reuse this session's "centralize price-adjustment logic" fix wired up for
  // every other price-writing path (goods receipt, manual item edit, pending-price promotion).
  function renderSellingPriceCell(item: Item) {
    return (
      <PriceCell
        value={item.selling_price ?? null}
        editable={canChange}
        saving={setItemPrice.isPending && setItemPrice.variables?.sku === item.sku}
        onSave={(n) =>
          setItemPrice.mutate(
            { sku: item.sku, price: n },
            {
              onSuccess: () => toast.success(`${item.name} selling price updated`),
              onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update selling price')),
            },
          )
        }
      />
    );
  }

  // Inline-editable price cell reused by the Wholesale/Retail columns. INGREDIENT
  // items are never sold — their cell shows the cost basis, not a price.
  function renderPriceCell(item: Item, which: 'min' | 'max') {
    if (item.type === 'INGREDIENT') {
      if (which === 'min') return <span className="text-muted-foreground">—</span>;
      return (
        <span
          className="font-mono text-xs text-muted-foreground tabular-nums"
          title="Cost basis — ingredients are costed (per pack / base unit), not priced"
        >
          {item.purchase_price != null && item.purchase_unit
            ? `${item.purchase_price.toFixed(2).replace(/\.?0+$/, '')}/${item.purchase_unit}`
            : item.cost_price != null
              ? `${item.cost_price.toFixed(4).replace(/\.?0+$/, '')}/${unitAbbrById.get(item.unit_id ?? '') ?? 'unit'}`
              : '—'}
        </span>
      );
    }
    const value = which === 'min' ? (item.min_selling_price ?? null) : (item.max_selling_price ?? item.selling_price ?? null);
    return (
      <PriceCell
        value={value}
        editable={canChange && item.type !== 'RECIPE'}
        saving={updateItem.isPending && updateItem.variables?.sku === item.sku}
        onSave={(n) =>
          updateItem.mutate(
            { sku: item.sku, data: { ...itemToUpdateInput(item), [which === 'min' ? 'min_selling_price' : 'max_selling_price']: n } },
            {
              onSuccess: () => toast.success(`${item.name} ${which === 'min' ? 'wholesale' : 'retail'} price updated`),
              onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update price')),
            },
          )
        }
      />
    );
  }

  const columns: DataTableColumn<Item>[] = [
    { key: 'sku', header: 'SKU', accessor: (i) => i.sku, sortable: true, cellClassName: 'font-mono text-xs text-muted-foreground', render: (i) => i.sku },
    {
      key: 'name', header: 'Name', accessor: (i) => i.name, sortable: true, filterable: true,
      render: (i) => (
        <button className="font-medium hover:text-primary transition-colors text-left" onClick={() => setViewItem(i)}>
          {i.name}
          {i.not_for_sale && <Badge variant="outline" className="ml-1.5 text-[10px]">Not for sale</Badge>}
        </button>
      ),
    },
    { key: 'category_name', header: 'Category', accessor: (i) => i.category_name ?? '—', filterable: true, hideBelow: 'md', cellClassName: 'text-muted-foreground' },
    {
      key: 'type', header: 'Type', accessor: (i) => i.type, sortable: true, filterable: true, hideBelow: 'sm',
      render: (i) => <Badge variant="outline" className="capitalize">{i.type?.toLowerCase() ?? '—'}</Badge>,
    },
    {
      key: 'on_hand', header: 'In Stock', align: 'right', sortable: true, hideBelow: 'sm',
      accessor: (i) => i.on_hand,
      cellClassName: 'font-mono text-xs tabular-nums',
      render: (i) => {
        if (i.on_hand == null) return <span className="text-muted-foreground">—</span>;
        const out = i.on_hand <= 0;
        const low = !out && i.reorder_level != null && i.on_hand <= i.reorder_level;
        return (
          <button
            type="button"
            onClick={() => setViewItem(i)}
            title="Cross-outlet total — click to see the per-outlet breakdown, including any hidden outlets"
            className={`hover:underline underline-offset-2 ${out ? 'font-semibold text-destructive' : low ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-foreground'}`}
          >
            {i.on_hand.toLocaleString()}
          </button>
        );
      },
    },
    {
      key: 'cost_price', header: 'Cost', align: 'right', sortable: true, hideBelow: 'md',
      accessor: (i) => i.cost_price, cellClassName: 'font-mono text-xs text-muted-foreground tabular-nums',
      render: (i) => renderCostCell(i),
    },
    {
      key: 'selling_price', header: 'Selling Price', align: 'right', sortable: true,
      accessor: (i) => i.selling_price, cellClassName: 'font-mono text-xs tabular-nums',
      render: (i) => renderSellingPriceCell(i),
    },
    { key: 'min_selling_price', header: 'Wholesale', align: 'right', sortable: true, hideBelow: 'lg', defaultHidden: true, accessor: (i) => i.min_selling_price, render: (i) => renderPriceCell(i, 'min') },
    { key: 'max_selling_price', header: 'Retail', align: 'right', sortable: true, defaultHidden: true, accessor: (i) => i.max_selling_price ?? i.selling_price, render: (i) => renderPriceCell(i, 'max') },
    {
      key: 'is_active', header: 'Status', accessor: (i) => (i.is_active ? 'Active' : 'Inactive'), sortable: true, filterable: true,
      render: (i) => <Badge variant={i.is_active ? 'success' : 'outline'}>{i.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right', exportable: false,
      render: (item) => {
        const isStockable = STOCKABLE_TYPES.includes(item.type as typeof STOCKABLE_TYPES[number]);
        const isEOL = !!item.end_of_life_at;
        return (
          <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button title="View details" aria-label="View item details" onClick={() => setViewItem(item)}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Eye className="h-4 w-4" /></button>
            <button title="Product stock history" aria-label="Product stock history" onClick={() => setHistorySku(item.sku)}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><History className="h-4 w-4" /></button>
            <button title="Show / print barcode" aria-label="Show item barcode" onClick={() => setBarcodeItem(item)}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Barcode className="h-4 w-4" /></button>
            {isStockable && canChange && (
              <button title="Move stock to another outlet/warehouse" aria-label="Move stock" onClick={() => setMoveStockItems([{ itemId: item.id, name: item.name, sku: item.sku }])}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ArrowRightLeft className="h-4 w-4" /></button>
            )}
            {canChange && (
              <button title="Edit item" aria-label="Edit item" onClick={() => setEditItem(item)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="h-4 w-4" /></button>
            )}
            {canDelete && (
              isEOL ? (
                <button title="Restore item" aria-label="Restore item" onClick={() => setEolConfirm({ sku: item.sku, name: item.name, action: 'restore' })}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-muted-foreground hover:text-emerald-600 transition-colors"><RotateCcw className="h-4 w-4" /></button>
              ) : (
                <button title="Mark End-of-Life" aria-label="Mark item End-of-Life" onClick={() => setEolConfirm({
                  sku: item.sku, name: item.name, action: 'mark',
                  availableQty: isStockable ? (item.available ?? 0) : undefined,
                })}
                  className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 text-muted-foreground hover:text-amber-600 transition-colors"><PackageX className="h-4 w-4" /></button>
              )
            )}
            {isPlatformOwner && (
              <button title="Permanently delete (platform admin)" aria-label="Permanently delete item" onClick={() => setHardDeleteConfirm(item)}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        );
      },
    },
  ];

  // Bulk actions gated by the same permissions as the single-row actions.
  const bulkActions: BulkAction[] = [];
  if (canChange) {
    bulkActions.push(
      { key: 'activate', label: 'Activate', icon: <BadgeCheck className="h-3.5 w-3.5" />, onClick: (ids) => setBulkConfirm({ action: 'activate', ids }) },
      { key: 'deactivate', label: 'Deactivate', icon: <PackageX className="h-3.5 w-3.5" />, onClick: (ids) => setBulkConfirm({ action: 'deactivate', ids }) },
      { key: 'nfs_on', label: 'Mark not-for-sale', icon: <Ban className="h-3.5 w-3.5" />, onClick: (ids) => setBulkConfirm({ action: 'not_for_sale_on', ids }) },
      { key: 'nfs_off', label: 'Mark for sale', icon: <ShoppingCart className="h-3.5 w-3.5" />, onClick: (ids) => setBulkConfirm({ action: 'not_for_sale_off', ids }) },
      {
        key: 'move', label: 'Move to location', icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
        onClick: (ids) => {
          const targets = items.filter((i) => ids.includes(i.id) && STOCKABLE_TYPES.includes(i.type as typeof STOCKABLE_TYPES[number]));
          if (targets.length === 0) {
            toast.error('None of the selected items can hold stock');
            return;
          }
          setMoveStockItems(targets.map((i) => ({ itemId: i.id, name: i.name, sku: i.sku })));
        },
      },
      {
        key: 'bulk_adjust', label: 'Adjust stock', icon: <ClipboardEdit className="h-3.5 w-3.5" />,
        onClick: (ids) => {
          const targets = items.filter((i) => ids.includes(i.id) && STOCKABLE_TYPES.includes(i.type as typeof STOCKABLE_TYPES[number]));
          if (targets.length === 0) {
            toast.error('None of the selected items can hold stock');
            return;
          }
          setBulkAdjustItems(targets.map((i) => ({ sku: i.sku, name: i.name })));
        },
      },
    );
  }
  if (canDelete) {
    bulkActions.push({ key: 'mark_eol', label: 'Mark End-of-Life', icon: <PackageX className="h-3.5 w-3.5" />, variant: 'destructive', onClick: (ids) => setBulkConfirm({ action: 'mark_eol', ids }) });
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Title */}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Catalog</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {outlet ? (
                <>Showing {nomenclature.itemPlural.toLowerCase()} for <span className="font-medium text-foreground">{outlet.name}</span></>
              ) : (
                `Manage your inventory ${nomenclature.itemPlural.toLowerCase()}`
              )}
            </p>
          </div>

          {/* Action toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xlsm" className="hidden" onChange={handleFileChange} />

            {/* Bulk-import group — always shown; when the plan lacks bulk_import the buttons
                carry an upgrade badge and a tap prompts to upgrade instead of being hidden. */}
            {canAdd && (
              <>
                {canBulkImport && bulkImportWH.allWarehouses.length > 0 && (
                  <div className="w-50" title="Target warehouse for import">
                    <CreatableSelect
                      value={selectedWarehouseCode}
                      onChange={(v) => {
                        setWarehouseCodeTouched(true);
                        setSelectedWarehouseCode(v);
                      }}
                      options={bulkImportWH.allWarehouses.map((wh) => ({ id: wh.code, name: wh.name }))}
                      placeholder="All Warehouses"
                    />
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { if (!guardBulkImport()) return; handleDownloadTemplate(); }}
                  disabled={isDownloadingTemplate}
                  title="Download XLSX template — fill and re-upload to bulk-add menu items"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                  {isDownloadingTemplate ? 'Preparing…' : 'Template'}
                  {!canBulkImport && <UpgradeBadge className="ml-1.5" />}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { if (!guardBulkImport()) return; setImportResult(null); fileInputRef.current?.click(); }}
                  disabled={isImporting}
                  title="Import a filled XLSX or CSV template"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  {isImporting ? 'Importing…' : 'Import'}
                  {!canBulkImport && <UpgradeBadge className="ml-1.5" />}
                </Button>

                {/* Visual separator between import and create groups */}
                <div className="h-6 w-px bg-border" />
              </>
            )}

            {/* Bulk label printing — by category / supplier / PO / selection */}
            {canPrintLabels && (
              <Button variant="outline" size="sm" onClick={() => setPrintLabelsOpen(true)} title="Print barcode labels in bulk">
                <Printer className="h-4 w-4 mr-1.5" />Print Labels
              </Button>
            )}

            {/* Branded PDF/CSV export of the current catalog — filters/outlet-aware */}
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} title="Export products as PDF or CSV">
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />Export
            </Button>

            {/* Create actions */}
            {canAdd && (
              <>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />New {nomenclature.item}
                </Button>
                {/* Menu/recipe composite — only for recipe-capable use cases (hospitality, QSR, manufacturing). */}
                {scope.showRecipe && (
                  <Button size="sm" onClick={() => router.push(`/${orgSlug}/catalog/new-menu-item`)}>
                    <Plus className="h-4 w-4 mr-1.5" />New Menu Item
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {importResult && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Import Results</p>
              <button onClick={() => setImportResult(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { label: 'Items',     data: importResult.items },
                { label: 'Recipes',   data: importResult.recipes },
                { label: 'Modifiers', data: importResult.modifiers },
                { label: 'Stock',     data: importResult.stock },
              ] as const).map(({ label, data }) => (
                <div key={label} className="rounded-md bg-background border border-border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <p className="text-xs">
                    <span className="text-emerald-600 font-semibold">{data.created ?? 0} created</span>
                    {', '}
                    <span className="text-blue-600 font-semibold">{data.updated ?? 0} updated</span>
                    {(data.failed ?? 0) > 0 && (
                      <>, <span className="text-red-600 font-semibold">{data.failed} failed</span></>
                    )}
                  </p>
                </div>
              ))}
            </div>
            {(importResult.items.errors?.length ?? 0) > 0 && (
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer font-medium">
                  {(importResult.items.errors?.length ?? 0) + (importResult.recipes.errors?.length ?? 0)} error(s) — click to expand
                </summary>
                <ul className="mt-1 list-disc list-inside space-y-0.5">
                  {[...(importResult.items.errors ?? []), ...(importResult.recipes.errors ?? [])].slice(0, 20).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <Card>
          <CardHeader className="space-y-3">
            {/* Search row */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by SKU, name, or barcode..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10 pr-12"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <BarcodeScanButton
                  title="Scan barcode to search"
                  hint="Point the camera at the product barcode."
                  className="h-8 w-8 rounded-lg"
                  onScan={(code) => { setSearch(code); setPage(1); }}
                />
              </div>
            </div>
            {/* Status + Type filter row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status tabs */}
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/30">
                {(['active', 'inactive', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                      statusFilter === s
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              {/* Not-for-selling filter (Go-Digital parity) — surface only the items
                  hidden from every sales interface (ingredients, supplies). */}
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground cursor-pointer select-none rounded-lg border border-border px-3 py-1.5">
                <input
                  type="checkbox"
                  checked={notForSaleOnly}
                  onChange={(e) => { setNotForSaleOnly(e.target.checked); setPage(1); }}
                  className="rounded border-input"
                />
                Not for selling
              </label>
              {/* Type filter — scoped to the item types relevant to this outlet's use_case */}
              <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {['', ...scope.itemTypes].map((t) => (
                  <Button
                    key={t || 'all'}
                    variant={typeFilter === t ? 'primary' : 'outline'}
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => { setTypeFilter(t); setPage(1); }}
                  >
                    {t || 'All Types'}
                  </Button>
                ))}
              </div>
              {/* Use-case filter — options scoped to this outlet's use_case. Hidden when the
                  outlet has a single use-case (already preselected, nothing to choose). */}
              {scope.itemUseCases.length > 1 && (
                <select
                  value={useCaseFilter}
                  onChange={(e) => { setUseCaseFilter(e.target.value); setPage(1); }}
                  className="shrink-0 rounded-lg border border-input bg-transparent px-3 py-1.5 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                  title="Filter by use-case"
                >
                  <option value="">All Use Cases</option>
                  {scope.itemUseCases.map((uc) => (
                    <option key={uc} value={uc}>{ITEM_USE_CASE_LABEL[uc]}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Category filter pills row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Button
                variant={categoryId === '' ? 'primary' : 'outline'}
                size="sm"
                className="shrink-0"
                onClick={() => { setCategoryId(''); setPage(1); }}
              >
                All
              </Button>
              {(categories ?? []).map((cat) => (
                <Button
                  key={cat.id}
                  variant={categoryId === cat.id ? 'primary' : 'outline'}
                  size="sm"
                  className="shrink-0"
                  onClick={() => { setCategoryId(cat.id); setPage(1); }}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0 border-0">
            <DataTable<Item>
              columns={columns}
              rows={items}
              rowKey={(i) => i.id}
              loading={isLoading}
              loadingRows={8}
              error={isError}
              onRetry={() => refetch()}
              emptyText={`No ${nomenclature.itemPlural.toLowerCase()} found`}
              storageKey="inventory-catalog"
              selectable={canChange || canDelete}
              selected={selected}
              onSelectedChange={setSelected}
              bulkActions={bulkActions}
              sort={sort}
              onSortChange={(s) => { setSort(s); setPage(1); }}
              showExportCsv
              exportFileName="catalog"
              pageSize={pageSize}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              total={itemsPage?.total}
              className="px-2 pb-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Create dialog — for GOODS, INGREDIENT, SERVICE, EQUIPMENT, VOUCHER */}
      {createOpen && (
        <ItemFormDialog
          orgSlug={orgSlug}
          item={null}
          onClose={() => setCreateOpen(false)}
          isPending={createItem.isPending}
          onSubmit={(data: CreateItemInput) => {
            createItem.mutate(data, {
              onSuccess: () => { toast.success('Item created'); setCreateOpen(false); },
              onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create item')),
            });
          }}
        />
      )}

      {/* Edit dialog */}
      {editItem && (
        <ItemFormDialog
          orgSlug={orgSlug}
          item={editItem}
          onClose={() => setEditItem(null)}
          isPending={updateItem.isPending}
          onSubmit={(data: CreateItemInput) => {
            updateItem.mutate(
              { sku: editItem.sku, data },
              {
                onSuccess: () => { toast.success('Item updated'); setEditItem(null); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update item')),
              },
            );
          }}
        />
      )}

      {/* Item detail drawer */}
      {viewItem && (
        <ItemDrawer
          item={viewItem}
          onClose={() => setViewItem(null)}
          onEdit={() => { setEditItem(viewItem); setViewItem(null); }}
          canEdit={canChange}
          onMoveStock={() => setMoveStockItems([{ itemId: viewItem.id, name: viewItem.name, sku: viewItem.sku }])}
          onViewHistory={() => setHistorySku(viewItem.sku)}
        />
      )}

      {/* EOL mark/restore confirmation — the tenant-facing off-boarding path (replaces hard delete). */}
      <ConfirmDialog
        open={!!eolConfirm}
        variant={eolConfirm?.action === 'mark' ? 'danger' : 'info'}
        title={eolConfirm?.action === 'mark' ? 'Mark End-of-Life?' : 'Restore item?'}
        description={
          eolConfirm?.action === 'mark'
            ? (eolConfirm.availableQty && eolConfirm.availableQty > 0
                ? `"${eolConfirm.name}" still has ${eolConfirm.availableQty.toLocaleString()} unit(s) in stock. An item should ideally only be marked End-of-Life once it's out of stock — proceeding will still hide it from the POS, catalog, and ordering immediately, and permanently delete it after the retention window. You can restore it before then from Stock → End of Life.`
                : `"${eolConfirm?.name}" will be hidden from the POS, catalog, and ordering, and permanently deleted after the retention window. You can restore it before then from Stock → End of Life.`)
            : `"${eolConfirm?.name}" will be re-activated and reappear in the catalog and POS.`
        }
        confirmLabel={eolConfirm?.action === 'mark' ? 'Mark End-of-Life' : 'Restore'}
        onConfirm={runEOLConfirm}
        onCancel={() => setEolConfirm(null)}
      />

      {/* Permanent hard-delete — platform admin only. */}
      {hardDeleteConfirm && (
        <ConfirmDialog
          open
          variant="danger"
          title="Permanently delete this item?"
          description={`"${hardDeleteConfirm.name}" and all its pricing, stock, and lot records will be permanently deleted. This cannot be undone. If it has any transaction history (purchases, sales, adjustments), the deletion will be refused — mark it End-of-Life instead.`}
          confirmLabel={hardDeleteAdmin.isPending ? 'Deleting...' : 'Permanently delete'}
          onConfirm={handleHardDelete}
          onCancel={() => setHardDeleteConfirm(null)}
        />
      )}

      {/* Move stock between outlets/warehouses — single item or batch. */}
      {moveStockItems && moveStockItems.length > 0 && (
        <MoveStockDialog
          orgSlug={orgSlug}
          items={moveStockItems}
          onClose={() => setMoveStockItems(null)}
          onDone={() => refetch()}
        />
      )}

      {/* Bulk stock adjustment — the same shared dialog the Stock Levels and Adjustments
          pages open. */}
      {bulkAdjustItems && bulkAdjustItems.length > 0 && (
        <BulkAdjustStockDialog
          orgSlug={orgSlug}
          items={bulkAdjustItems}
          onClose={() => setBulkAdjustItems(null)}
          onDone={() => refetch()}
        />
      )}

      {/* Single-item barcode (show/print/download) */}
      {barcodeItem && (
        <BarcodeDialog orgSlug={orgSlug} item={barcodeItem} onClose={() => setBarcodeItem(null)} />
      )}

      {/* Bulk label printing */}
      {printLabelsOpen && (
        <PrintLabelsDialog orgSlug={orgSlug} onClose={() => setPrintLabelsOpen(false)} />
      )}

      {/* Branded PDF/CSV export */}
      {exportOpen && (
        <ProductsExportDialog
          orgSlug={orgSlug}
          initial={{
            ...(search ? { search } : {}),
            ...(categoryId ? { category_id: categoryId } : {}),
            ...(typeFilter ? { type: typeFilter } : {}),
            status: statusFilter,
            ...(useCaseFilter ? { use_case: useCaseFilter } : {}),
          }}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Product stock history ledger (per-row button) */}
      {historySku && (
        <ProductStockHistoryModal orgSlug={orgSlug} sku={historySku} onClose={() => setHistorySku(null)} />
      )}

      {/* Bulk action confirmation */}
      {bulkConfirm && (
        <ConfirmDialog
          open
          title={`${bulkConfirm.action === 'mark_eol' ? 'Mark End-of-Life' : bulkConfirm.action === 'activate' ? 'Activate' : bulkConfirm.action === 'deactivate' ? 'Deactivate' : bulkConfirm.action === 'not_for_sale_on' ? 'Mark not-for-sale' : 'Mark for sale'} ${bulkConfirm.ids.length} item${bulkConfirm.ids.length === 1 ? '' : 's'}?`}
          description={
            bulkConfirm.action === 'mark_eol'
              ? (() => {
                  const withStock = items.filter(
                    (i) => bulkConfirm.ids.includes(i.id) && STOCKABLE_TYPES.includes(i.type as typeof STOCKABLE_TYPES[number]) && (i.available ?? 0) > 0,
                  ).length;
                  const base = 'The selected items will be hidden from the POS, catalog, and ordering, and permanently deleted after the retention window. You can restore any of them before then from Stock → End of Life.';
                  return withStock > 0
                    ? `${withStock} of the ${bulkConfirm.ids.length} selected item(s) still have stock. An item should ideally only be marked End-of-Life once it's out of stock. ${base}`
                    : base;
                })()
              : bulkConfirm.action === 'not_for_sale_on'
                ? 'The selected items will be hidden from every sales interface (POS, ordering). They stay stockable and purchasable.'
                : bulkConfirm.action === 'not_for_sale_off'
                  ? 'The selected items will become sellable again on the POS and ordering surfaces.'
                  : `The selected items will be ${bulkConfirm.action}d. Items already in that state are skipped.`
          }
          variant={bulkConfirm.action === 'mark_eol' ? 'danger' : 'info'}
          confirmLabel={bulkConfirm.action === 'mark_eol' ? 'Mark End-of-Life' : 'Confirm'}
          onCancel={() => setBulkConfirm(null)}
          onConfirm={() => runBulk(bulkConfirm.action, bulkConfirm.ids)}
        />
      )}
    </>
  );
}
