'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { apiClient } from '@/lib/api/client';
import { itemsApi, type Item } from '@/lib/api/items';
import { fetchRecipeBySku, type Recipe } from '@/lib/api/recipes';
import { useDeleteItem, useUpdateItem } from '@/hooks/useItems';
import { useItemPricing, usePricingTiers, useUpsertItemPricing } from '@/hooks/usePricing';
import type { PricingTier } from '@/lib/api/pricing';
import { ITEM_USE_CASE_LABEL } from '@/lib/use-case-nomenclature';
import { usePermissions, P } from '@/hooks/usePermissions';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, BoxIcon, ChefHat, DollarSign, GitBranch, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

const KES = (n?: number | null) =>
  n == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(n);

const STOCKABLE_TYPES = ['GOODS', 'INGREDIENT', 'EQUIPMENT'];

interface SerialRow {
  id: string;
  serial_number: string;
  status: 'available' | 'reserved' | 'sold' | 'returned' | 'defective';
  received_at?: string;
  sold_at?: string | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium mt-1">{value ?? '—'}</dd>
    </div>
  );
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params?.orgSlug as string;
  const id = params?.id as string;
  const [editOpen, setEditOpen] = useState(false);

  const { can } = usePermissions();
  const canEdit = can(P.CATALOG_CHANGE);
  const canDelete = can(P.CATALOG_DELETE);

  const updateItem = useUpdateItem(orgSlug);
  const deleteItem = useDeleteItem(orgSlug);

  // Full, enriched item fetched by UUID (category name, effective/tax price, on-hand, images)
  // via the list ?id= filter — the same shape the catalog list & quick-view drawer render.
  const { data: item, isLoading, isError, refetch } = useQuery<Item | null>({
    queryKey: ['catalog', 'item', orgSlug, id],
    queryFn: () => itemsApi.getById(orgSlug, id),
    enabled: !!id,
  });

  const isRecipe = item?.type === 'RECIPE';
  const isStockable = item ? STOCKABLE_TYPES.includes(item.type) : false;

  // Recipe (BOM) — only for RECIPE items. Looked up by the item's SKU; failures (e.g. an outlet
  // whose use_case can't read recipes) degrade gracefully to no BOM card rather than breaking.
  const { data: recipe } = useQuery<Recipe | null>({
    queryKey: ['catalog', 'recipe', orgSlug, item?.sku],
    queryFn: () => fetchRecipeBySku(orgSlug, item!.sku),
    enabled: !!item && isRecipe,
    retry: false,
  });

  // Per-unit serials (serial-tracked items). The section renders only when rows exist.
  const { data: serialRows } = useQuery<SerialRow[]>({
    queryKey: ['catalog', 'serials', orgSlug, id],
    queryFn: () => apiClient.get(`/api/v1/${orgSlug}/inventory/items/${id}/serials`),
    enabled: !!id && isStockable,
    placeholderData: [],
    retry: false,
  });

  const { data: itemPricing } = useItemPricing(orgSlug, id);
  const { data: pricingTiers } = usePricingTiers(orgSlug);
  const upsertPricing = useUpsertItemPricing(orgSlug);
  const [pricingEditOpen, setPricingEditOpen] = useState(false);
  const [tierPrices, setTierPrices] = useState<Record<string, string>>({});

  function openPricingEditor() {
    const seed: Record<string, string> = {};
    for (const p of itemPricing ?? []) {
      if (p.price > 0) seed[p.pricing_tier_id] = String(p.price);
    }
    setTierPrices(seed);
    setPricingEditOpen(true);
  }

  function savePricing() {
    const entries = Object.entries(tierPrices)
      .map(([pricing_tier_id, v]) => ({ pricing_tier_id, price: parseDecimal(v), currency: 'KES' }))
      .filter((e) => Number.isFinite(e.price) && e.price > 0);
    if (entries.length === 0) {
      toast.error('Enter at least one tier price');
      return;
    }
    upsertPricing.mutate(
      { itemId: id, entries },
      {
        onSuccess: () => { toast.success('Pricing updated'); setPricingEditOpen(false); },
        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update pricing')),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-100">
        <div className="animate-pulse text-muted-foreground">Loading item...</div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
        <p className="text-muted-foreground">{isError ? "Couldn't load this item" : 'Item not found'}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {isError && <Button variant="outline" onClick={() => refetch()}>Retry</Button>}
          <Link href={`/${orgSlug}/catalog`}>
            <Button variant="outline">Back to Catalog</Button>
          </Link>
        </div>
      </div>
    );
  }

  const margin =
    item.cost_price != null && item.selling_price != null && item.selling_price > 0
      ? ((item.selling_price - item.cost_price) / item.selling_price) * 100
      : null;

  const compliance = [
    item.is_perishable && 'Perishable',
    item.requires_age_verification && 'Age Verification',
    item.is_controlled_substance && 'Controlled Substance',
    item.track_lots && 'Track Lots',
    item.track_serial_numbers && 'Serial Tracked',
    item.non_billable && 'Non-billable',
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/${orgSlug}/catalog`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{item.name}</h1>
            <p className="text-muted-foreground font-mono text-sm">{item.sku}</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge variant={item.is_active ? 'success' : 'outline'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>
            <Badge variant="default" className="capitalize">{item.type?.toLowerCase()}</Badge>
            {isRecipe && (
              <Link href={`/${orgSlug}/catalog/${id}/recipe`}>
                <Button variant="outline" size="sm">
                  <ChefHat className="h-4 w-4 mr-2" />
                  View Recipe
                </Button>
              </Link>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive hover:bg-destructive/10"
                disabled={deleteItem.isPending}
                onClick={() => {
                  if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
                  deleteItem.mutate(item.sku, {
                    onSuccess: () => {
                      toast.success('Item deleted');
                      router.push(`/${orgSlug}/catalog`);
                    },
                    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete item')),
                  });
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Item details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BoxIcon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Item Details</h2>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Category" value={item.category_name} />
                <Field label="Use Case" value={item.use_case ? ITEM_USE_CASE_LABEL[item.use_case] ?? item.use_case : null} />
                {item.preferred_supplier_name && <Field label="Preferred Supplier" value={item.preferred_supplier_name} />}
                {item.barcode && <Field label="Barcode" value={<span className="font-mono">{item.barcode}</span>} />}
                {item.tax_code_id && (
                  <Field
                    label="Tax"
                    value={`${item.tax_code_id}${item.tax_rate != null ? ` · ${item.tax_rate}%` : ''}${item.tax_inclusive ? ' (incl.)' : ''}`}
                  />
                )}
                {isStockable && item.shelf_life_days != null && <Field label="Shelf Life" value={`${item.shelf_life_days} days`} />}
                {isStockable && item.weight_kg != null && <Field label="Weight" value={`${item.weight_kg} kg`} />}
                {item.type === 'SERVICE' && item.duration_minutes != null && <Field label="Service Duration" value={`${item.duration_minutes} min`} />}
                <Field label="Created" value={new Date(item.created_at).toLocaleDateString()} />
                <Field label="Updated" value={new Date(item.updated_at).toLocaleDateString()} />
                {item.description && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Description</dt>
                    <dd className="font-medium mt-1 whitespace-pre-wrap">{item.description}</dd>
                  </div>
                )}
              </dl>

              {compliance.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {compliance.map((c) => (
                    <Badge key={c} variant="warning">{c}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock — stockable types only */}
          {isStockable && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Stock</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-black text-foreground tabular-nums">{item.on_hand ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">On hand</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-foreground tabular-nums">{item.available ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Available</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-foreground tabular-nums">{item.reorder_level ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Reorder at</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recipe / BOM — RECIPE items only */}
          {isRecipe && (
            <Card className={isStockable ? undefined : 'lg:col-span-1'}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Recipe / BOM</h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {recipe ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Field label="Yield" value={`${recipe.output_qty ?? 1} portion(s)`} />
                      <Field label="Batch Cost" value={KES(recipe.total_cost)} />
                      <Field label="Cost / Portion" value={KES(recipe.cost_per_portion)} />
                      <Field label="Food Cost" value={recipe.food_cost_pct != null ? `${(recipe.food_cost_pct * 100).toFixed(1)}%` : '—'} />
                    </div>
                    {recipe.ingredients?.length > 0 ? (
                      <div className="divide-y divide-border border-t border-border">
                        {recipe.ingredients.map((ing) => (
                          <div key={ing.id ?? `${ing.item_sku}-${ing.item_name}`} className="flex justify-between items-center py-2 text-sm">
                            <span className="font-medium truncate mr-2">{ing.item_name}</span>
                            <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                              {ing.quantity} {ing.unit_of_measure}
                              {ing.waste_percent ? ` · ${ing.waste_percent}% waste` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No ingredients defined yet.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recipe defined yet. Use <strong>Edit</strong> or <strong>View Recipe</strong> to add ingredients.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Pricing</h2>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={openPricingEditor}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Selling price</p>
                <p className="text-lg font-black text-primary leading-tight mt-0.5">{KES(item.selling_price)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Cost</p>
                <p className="text-sm font-semibold mt-1">{KES(item.cost_price)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Margin</p>
                <p className="text-sm font-semibold mt-1">{margin != null ? `${margin.toFixed(1)}%` : '—'}</p>
              </div>
              {/* INGREDIENT items are never sold — hide meaningless wholesale/retail. */}
              {item.type !== 'INGREDIENT' && (
                <>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Min (Wholesale)</p>
                    <p className="text-sm font-semibold mt-1">{KES(item.min_selling_price)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Max (Retail)</p>
                    <p className="text-sm font-semibold mt-1">{KES(item.max_selling_price)}</p>
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-[11px] text-muted-foreground mb-2">Price profiles</p>
              {(itemPricing?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No price profiles set — the selling price above is derived from the item&apos;s {isRecipe ? 'recipe' : 'max/retail'} price.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Pricing Tier</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Basis</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {itemPricing?.map((p) => (
                        <tr key={`${p.pricing_tier_id}-${p.outlet_id ?? 'all'}`}>
                          <td className="px-4 py-2 font-medium">{p.tier_name ?? p.tier_code ?? p.pricing_tier_id}{p.outlet_id ? ' (outlet)' : ''}</td>
                          <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell capitalize">{(p.tier_basis ?? 'default').replace(/_/g, ' ')}</td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums">{(p.currency ?? 'KES')} {p.price.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Serial units — only for serial-tracked items that have received units */}
        {(serialRows?.length ?? 0) > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Serial Units</h2>
                <div className="flex gap-1.5">
                  {(['available', 'sold', 'returned', 'defective'] as const).map((st) => {
                    const n = (serialRows ?? []).filter((s) => s.status === st).length;
                    return n > 0 ? <Badge key={st} variant={st === 'available' ? 'success' : 'outline'}>{n} {st}</Badge> : null;
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">Serial Number</th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Received</th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Sold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(serialRows ?? []).map((s) => (
                      <tr key={s.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-6 py-3 font-mono">{s.serial_number}</td>
                        <td className="px-6 py-3">
                          <Badge variant={s.status === 'available' ? 'success' : 'outline'} className="capitalize">{s.status}</Badge>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground hidden sm:table-cell">{s.received_at ? new Date(s.received_at).toLocaleDateString() : '—'}</td>
                        <td className="px-6 py-3 text-muted-foreground hidden sm:table-cell">{s.sold_at ? new Date(s.sold_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {pricingEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPricingEditOpen(false)} />
            <div className="relative z-50 w-full max-w-md mx-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Edit Pricing</h2>
                    <button onClick={() => setPricingEditOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {((pricingTiers ?? []) as PricingTier[]).filter((t) => t.is_active).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pricing profiles defined yet. Create them under Pricing Profiles first.</p>
                  ) : (
                    <div className="space-y-3">
                      {((pricingTiers ?? []) as PricingTier[]).filter((t) => t.is_active).map((t) => (
                        <div key={t.id} className="flex items-center gap-3">
                          <label className="flex-1 text-sm font-medium">
                            {t.name}
                            {t.is_default && <span className="ml-1 text-xs text-muted-foreground">(default)</span>}
                          </label>
                          <div className="relative w-36">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">KES</span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step={DECIMAL_STEP}
                              className="pl-10 text-right"
                              placeholder="0"
                              value={tierPrices[t.id] ?? ''}
                              onChange={(e) => setTierPrices((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPricingEditOpen(false)}>Cancel</Button>
                    <Button type="button" className="flex-1" onClick={savePricing} disabled={upsertPricing.isPending}>
                      {upsertPricing.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {editOpen && (
        <ItemFormDialog
          orgSlug={orgSlug}
          item={item}
          onClose={() => setEditOpen(false)}
          isPending={updateItem.isPending}
          onSubmit={(data) => {
            updateItem.mutate({ sku: item.sku, data }, {
              onSuccess: () => {
                toast.success('Item updated');
                setEditOpen(false);
                refetch();
              },
              onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update item')),
            });
          }}
        />
      )}
    </>
  );
}
