'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { BarcodeDialog } from '@/components/inventory/BarcodeDialog';
import { BarcodeScanButton } from '@/components/inventory/BarcodeScanner';
import { PrintLabelsDialog } from '@/components/inventory/PrintLabelsDialog';
import { DetailDrawer, type DetailField } from '@/components/inventory/DetailDrawer';
import { useItemPricing, usePricingTiers } from '@/hooks/usePricing';
import { useCreateItem, useDeleteItem, useItems, useUpdateItem } from '@/hooks/useItems';
import { useCreateFromQuery } from '@/hooks/useCreateFromQuery';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCategories } from '@/hooks/useCategories';
import { useBulkImport } from '@/hooks/useBulkImport';
import { type CreateItemInput, type Item, type BulkImportResult } from '@/lib/api/items';
import { useQueryClient } from '@tanstack/react-query';
import { Pagination } from '@/components/ui/pagination';
import { AlertTriangle, Barcode, ClipboardList, Edit2, ExternalLink, Eye, FileSpreadsheet, Filter, Package, Plus, Printer, Search, Trash2, Upload, X } from 'lucide-react';
import { useOutletStore } from '@/store/outlet';
import { useNomenclature, useCatalogScope, catalogScopeFor, ITEM_USE_CASE_LABEL } from '@/lib/use-case-nomenclature';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeBadge } from '@bengo-hub/shared-ui-lib/subscription';
import { usePermissions, P } from '@/hooks/usePermissions';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

const ITEMS_PER_PAGE = 20;

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

function ItemDrawer({ item, onClose, onEdit, canEdit }: { item: Item; onClose: () => void; onEdit: () => void; canEdit: boolean }) {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const router = useRouter();
  const { canAny } = usePermissions();
  const canAdjust = canAny([P.ADJUSTMENTS_ADD, P.ADJUSTMENTS_MANAGE]);
  const isStockable = ['GOODS', 'INGREDIENT', 'EQUIPMENT'].includes(item.type);

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

      {/* Stock — on-hand / available (stockable item types only). */}
      {isStockable && (
        <div className="rounded-xl border border-border p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Stock</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-black text-foreground tabular-nums">{item.on_hand ?? '—'}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">On hand</p>
            </div>
            <div>
              <p className="text-xl font-black text-foreground tabular-nums">{item.available ?? '—'}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Available</p>
            </div>
            <div>
              <p className="text-xl font-black text-foreground tabular-nums">{item.reorder_level ?? '—'}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Reorder at</p>
            </div>
          </div>
        </div>
      )}

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

function DeleteConfirm({
  itemName,
  onConfirm,
  onCancel,
  isPending,
}: {
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-50 bg-background rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
        <h3 className="font-semibold text-lg">Delete Item</h3>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{' '}
          <span className="font-medium text-foreground">{itemName}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
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
    const subscribeUrl = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL || 'https://pricing.codevertexitsolutions.com';
    toast.info('Bulk import needs a plan upgrade', {
      description: 'Upgrade your plan to import items in bulk from a spreadsheet.',
      action: { label: 'Upgrade', onClick: () => window.open(`${subscribeUrl}/subscribe`, '_blank') },
    });
    return false;
  }
  const { can, canAny } = usePermissions();
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
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  useCreateFromQuery(() => setCreateOpen(true), 'item'); // mobile quick-add → open Add Item
  const [viewItem, setViewItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);
  const [barcodeItem, setBarcodeItem] = useState<Item | null>(null);
  const [printLabelsOpen, setPrintLabelsOpen] = useState(false);

  const createItem = useCreateItem(orgSlug);
  const updateItem = useUpdateItem(orgSlug);
  const deleteItemMut = useDeleteItem(orgSlug);
  const { data: categories } = useCategories(orgSlug);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [selectedWarehouseCode, setSelectedWarehouseCode] = useState('');

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
  const { data: warehouses } = useWarehouses(orgSlug);

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

  function handleDelete() {
    if (!deleteItem) return;
    deleteItemMut.mutate(deleteItem.sku, {
      onSuccess: () => {
        toast.success('Item deleted');
        setDeleteItem(null);
        if (viewItem?.id === deleteItem.id) setViewItem(null);
      },
      onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete item')),
    });
  }

  const { data: itemsPage, isLoading, isError, refetch } = useItems(orgSlug, {
    ...(search ? { search } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(useCaseFilter ? { use_case: useCaseFilter } : {}),
    status: statusFilter,
    page,
    limit: ITEMS_PER_PAGE,
  });

  const items = itemsPage?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((itemsPage?.total ?? 0) / ITEMS_PER_PAGE));

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Title */}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{nomenclature.catalog}</h1>
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
                {canBulkImport && warehouses && warehouses.length > 0 && (
                  <select
                    value={selectedWarehouseCode}
                    onChange={(e) => setSelectedWarehouseCode(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring focus:outline-none max-w-[200px]"
                    title="Target warehouse for import"
                  >
                    <option value="">All Warehouses</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.code}>{wh.name}</option>
                    ))}
                  </select>
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

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">SKU</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        Loading items...
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                        <p className="text-muted-foreground">Couldn&apos;t load items</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">No {nomenclature.itemPlural.toLowerCase()} found</p>
                        {(search || categoryId || typeFilter || statusFilter !== 'active') && (
                          <button
                            className="text-sm text-primary hover:underline mt-1"
                            onClick={() => { setSearch(''); setCategoryId(''); setTypeFilter(''); setUseCaseFilter(scope.defaultItemUseCase ?? ''); setStatusFilter('active'); setPage(1); }}
                          >
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{item.sku}</td>
                        <td className="px-6 py-4">
                          <button
                            className="font-medium hover:text-primary transition-colors text-left"
                            onClick={() => setViewItem(item)}
                          >
                            {item.name}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                          {item.category_name ?? '—'}
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <Badge variant="outline" className="capitalize">
                            {item.type?.toLowerCase() ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={item.is_active ? 'success' : 'outline'}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              title="View details"
                              aria-label="View item details"
                              onClick={() => setViewItem(item)}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              title="Show / print barcode"
                              aria-label="Show item barcode"
                              onClick={() => setBarcodeItem(item)}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Barcode className="h-4 w-4" />
                            </button>
                            {canChange && (
                              <button
                                title="Edit item"
                                aria-label="Edit item"
                                onClick={() => setEditItem(item)}
                                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                title="Delete item"
                                aria-label="Delete item"
                                onClick={() => setDeleteItem(item)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && items.length > 0 && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
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
        />
      )}

      {/* Delete confirmation */}
      {deleteItem && (
        <DeleteConfirm
          itemName={deleteItem.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
          isPending={deleteItemMut.isPending}
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
    </>
  );
}
