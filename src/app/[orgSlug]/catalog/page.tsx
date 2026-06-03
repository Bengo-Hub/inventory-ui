'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCreateItem, useDeleteItem, useItems, useUpdateItem } from '@/hooks/useItems';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCategories } from '@/hooks/useCategories';
import { useBulkImport } from '@/hooks/useBulkImport';
import { type CreateItemInput, type Item, type BulkImportResult } from '@/lib/api/items';
import { useQueryClient } from '@tanstack/react-query';
import { Pagination } from '@/components/ui/pagination';
import { Edit2, Eye, FileSpreadsheet, Filter, Package, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useOutletStore } from '@/store/outlet';
import { useSubscription } from '@/hooks/use-subscription';
import { usePermissions, P } from '@/hooks/usePermissions';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

function ItemDrawer({ item, onClose, onEdit, canEdit }: { item: Item; onClose: () => void; onEdit: () => void; canEdit: boolean }) {
  return (
    <Sheet open onClose={onClose} width="md">
      <SheetHeader>
        <SheetTitle>{item.name}</SheetTitle>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
            </Button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </SheetHeader>
      <SheetContent>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={item.is_active ? 'success' : 'outline'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>
          <Badge variant="outline" className="font-mono">{item.sku}</Badge>
          <Badge variant="default" className="capitalize">{item.type?.toLowerCase()}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Category</p>
            <p className="text-sm font-medium">{item.category_name ?? '—'}</p>
          </div>
          {item.barcode && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Barcode</p>
              <p className="text-sm font-mono">{item.barcode}</p>
            </div>
          )}
          {item.cost_price != null && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cost Price</p>
              <p className="text-sm font-semibold text-primary">
                {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(item.cost_price)}
              </p>
            </div>
          )}
          {item.suggested_price != null && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Suggested Price</p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(item.suggested_price)}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Reorder Level</p>
            <p className="text-sm font-medium">{item.reorder_level ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Reorder Quantity</p>
            <p className="text-sm font-medium">{item.reorder_quantity ?? '—'}</p>
          </div>
        </div>

        {item.description && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-foreground">{item.description}</p>
          </div>
        )}

        {(item.is_perishable || item.requires_age_verification || item.track_lots) && (
          <div className="flex flex-wrap gap-2">
            {item.is_perishable && <Badge variant="warning">Perishable</Badge>}
            {item.requires_age_verification && <Badge variant="warning">Age Verification</Badge>}
            {item.track_lots && <Badge variant="outline">Track Lots</Badge>}
          </div>
        )}

        {item.tags && item.tags.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Tags</p>
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-3 border-t border-border space-y-1">
          <p>Created: {new Date(item.created_at).toLocaleDateString()}</p>
          <p>Updated: {new Date(item.updated_at).toLocaleDateString()}</p>
        </div>
      </SheetContent>
    </Sheet>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { hasFeature } = useSubscription();
  const canBulkImport = hasFeature('bulk_import');
  const { can } = usePermissions();
  const canAdd = can(P.CATALOG_ADD);
  const canChange = can(P.CATALOG_CHANGE);
  const canDelete = can(P.CATALOG_DELETE);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [useCaseFilter, setUseCaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);

  const createItem = useCreateItem(orgSlug);
  const updateItem = useUpdateItem(orgSlug);
  const deleteItemMut = useDeleteItem(orgSlug);
  const { data: categories } = useCategories(orgSlug);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [selectedWarehouseCode, setSelectedWarehouseCode] = useState('');

  const { bulkImport, isPending: isImporting, templateUrl } = useBulkImport(orgSlug);
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
      onError: () => toast.error('Import failed. Check file format and try again.'),
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
      onError: () => toast.error('Failed to delete item'),
    });
  }

  const { data: itemsPage, isLoading } = useItems(orgSlug, {
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
            <h1 className="text-2xl font-bold tracking-tight">Stock Catalog</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {outlet ? (
                <>Showing items for <span className="font-medium text-foreground">{outlet.name}</span></>
              ) : (
                'Manage your inventory items'
              )}
            </p>
          </div>

          {/* Action toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xlsm" className="hidden" onChange={handleFileChange} />

            {/* Bulk-import group — gated by subscription feature */}
            {canBulkImport && (
              <>
                {warehouses && warehouses.length > 0 && (
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

                <Button variant="outline" size="sm" asChild>
                  <a
                    href={templateUrl}
                    download="inventory-template.xlsx"
                    title="Download XLSX template — fill and re-upload to bulk-add menu items"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />Template
                  </a>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setImportResult(null); fileInputRef.current?.click(); }}
                  disabled={isImporting}
                  title="Import a filled XLSX or CSV template"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  {isImporting ? 'Importing…' : 'Import'}
                </Button>

                {/* Visual separator between import and create groups */}
                <div className="h-6 w-px bg-border" />
              </>
            )}

            {/* Create actions */}
            {canAdd && (
              <>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />New Item
                </Button>
                <Button size="sm" onClick={() => router.push(`/${orgSlug}/catalog/new-menu-item`)}>
                  <Plus className="h-4 w-4 mr-1.5" />New Menu Item
                </Button>
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
                placeholder="Search by SKU or name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
              />
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
              {/* Type filter */}
              <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {(['', 'GOODS', 'INGREDIENT', 'RECIPE', 'SERVICE', 'VOUCHER', 'EQUIPMENT'] as const).map((t) => (
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
              {/* Use-case filter (hospitality) */}
              <select
                value={useCaseFilter}
                onChange={(e) => { setUseCaseFilter(e.target.value); setPage(1); }}
                className="shrink-0 rounded-lg border border-input bg-transparent px-3 py-1.5 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                title="Filter by hospitality use-case"
              >
                <option value="">All Use Cases</option>
                <option value="RETAIL">Retail</option>
                <option value="FOOD_BEVERAGE">Food &amp; Beverage</option>
                <option value="HOSPITALITY_ROOM">Hotel Rooms</option>
                <option value="HOSPITALITY_FACILITY">Facilities</option>
                <option value="CONFERENCE">Conference</option>
                <option value="SALON_SERVICE">Salon / Spa</option>
                <option value="AMENITY">Amenities</option>
              </select>
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
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">No items found</p>
                        {(search || categoryId || typeFilter || statusFilter !== 'active') && (
                          <button
                            className="text-sm text-primary hover:underline mt-1"
                            onClick={() => { setSearch(''); setCategoryId(''); setTypeFilter(''); setUseCaseFilter(''); setStatusFilter('active'); setPage(1); }}
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
              onError: () => toast.error('Failed to create item'),
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
                onError: () => toast.error('Failed to update item'),
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
    </>
  );
}
