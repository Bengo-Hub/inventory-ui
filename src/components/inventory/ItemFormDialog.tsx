'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { RecurrenceEditor, generateRecurrencePattern } from '@/components/inventory/RecurrenceEditor';
import { FoodCostBudgetBar } from '@/components/inventory/FoodCostBudgetBar';
import { RecipeIngredientRow, type IngredientRowValue } from '@/components/inventory/RecipeIngredientRow';
import { apiClient } from '@/lib/api/client';
import { type CreateItemInput, type Item, type ItemUseCase, type RecurrenceConfig, type MenuItemCompositeRequest, itemsApi, ITEM_USE_CASES, MEAL_PLANS } from '@/lib/api/items';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Image as ImageIcon, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  code?: string;
  slug?: string;
}

// Frontend type → allowed-category map. Categories are domain groupings (Beverages, Pizza,
// Events…) and only map cleanly to item type for events, so that is the one filter we apply;
// every other type shows all categories. The "Events & Experiences" category is seeded with
// code EVT / slug "events" (see cmd/seed/seed_categories.go).
const EVENT_CATEGORY_CODES = ['EVT'];
const EVENT_CATEGORY_SLUGS = ['events'];

function isEventCategory(c: Category): boolean {
  return (
    EVENT_CATEGORY_CODES.includes((c.code ?? '').toUpperCase()) ||
    EVENT_CATEGORY_SLUGS.includes((c.slug ?? '').toLowerCase())
  );
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

interface TicketTier {
  name: string;
  price: number;
  capacity: number;
}

interface Props {
  orgSlug: string;
  item?: Item | null;
  defaultDate?: string;
  /** Lock the form to event editing: type fixed to SERVICE; category/unit/type read-only (predefined). */
  lockToEvent?: boolean;
  onClose: () => void;
  onSubmit: (data: CreateItemInput) => void;
  isPending: boolean;
}

const ITEM_TYPES = ['GOODS', 'SERVICE', 'RECIPE', 'INGREDIENT', 'VOUCHER', 'EQUIPMENT'] as const;

const inputCls =
  'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const selectCls = `${inputCls} appearance-none`;

function toLocalDatetimeValue(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16); // "YYYY-MM-DDTHH:mm"
}

export function ItemFormDialog({ orgSlug, item, defaultDate, lockToEvent, onClose, onSubmit, isPending }: Props) {
  const [name, setName] = useState(item?.name ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [type, setType] = useState<string>(item?.type ?? (lockToEvent ? 'SERVICE' : 'GOODS'));
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '');
  const [unitId, setUnitId] = useState(item?.unit_id ?? '');
  const [barcode, setBarcode] = useState(item?.barcode ?? '');
  const [reorderLevel, setReorderLevel] = useState(String(item?.reorder_level ?? ''));
  const [reorderQty, setReorderQty] = useState(String(item?.reorder_quantity ?? ''));
  const [costPrice, setCostPrice] = useState(item?.cost_price != null ? String(item.cost_price) : '');
  const [taxCode, setTaxCode] = useState(item?.tax_code_id ?? '');
  const [taxInclusive, setTaxInclusive] = useState(item?.tax_inclusive ?? false);
  const [requiresAge, setRequiresAge] = useState(item?.requires_age_verification ?? false);
  const [isPerishable, setIsPerishable] = useState(item?.is_perishable ?? false);
  const [trackLots, setTrackLots] = useState(item?.track_lots ?? false);
  const [isActive, setIsActive] = useState(item?.is_active !== false);

  // Image
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Event fields
  const [eventStartAt, setEventStartAt] = useState(toLocalDatetimeValue(item?.event_start_at ?? defaultDate));
  const [eventEndAt, setEventEndAt] = useState(toLocalDatetimeValue(item?.event_end_at));
  const [eventVenue, setEventVenue] = useState(item?.event_venue ?? '');
  const [totalCapacity, setTotalCapacity] = useState(item?.total_capacity != null ? String(item.total_capacity) : '');

  // Hospitality fields (SERVICE items: rooms / facilities / amenities)
  const [useCase, setUseCase] = useState<ItemUseCase>(item?.use_case ?? 'RETAIL');
  const [mealPlan, setMealPlan] = useState<string>(item?.meal_plan ?? '');
  const [occupancyBasis, setOccupancyBasis] = useState<string>(item?.occupancy_basis ?? '');
  const [maxAdults, setMaxAdults] = useState(item?.max_adults != null ? String(item.max_adults) : '');
  const [maxChildren, setMaxChildren] = useState(item?.max_children != null ? String(item.max_children) : '');
  const [singleSupplement, setSingleSupplement] = useState(item?.single_supplement != null ? String(item.single_supplement) : '');
  const [extraBedAllowed, setExtraBedAllowed] = useState(item?.extra_bed_allowed ?? false);

  // Ticket tiers (stored in metadata.ticket_tiers)
  const existingTiers: TicketTier[] = (item?.metadata?.ticket_tiers as TicketTier[]) ?? [];
  const [tiers, setTiers] = useState<TicketTier[]>(existingTiers);

  // Structured recurrence config
  const existingRc = item?.metadata?.recurrence_config as RecurrenceConfig | undefined;
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig | null>(
    (item?.metadata?.is_recurring && existingRc) ? existingRc : null
  );

  // Recipe fields — shown when type === 'RECIPE'
  const [sellingPrice, setSellingPrice] = useState('');
  const [servings, setServings] = useState('1');
  const [recipeIngredients, setRecipeIngredients] = useState<IngredientRowValue[]>([]);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const queryClient = useQueryClient();
  const compositeMut = useMutation({
    mutationFn: (payload: MenuItemCompositeRequest) => itemsApi.createMenuItemComposite(orgSlug, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items', orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['recipes', orgSlug] });
      if (data.warnings?.length) {
        toast.warning(data.warnings.join('; '));
      } else {
        toast.success('Menu item created');
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isRecipe = type === 'RECIPE';
  // Event mode (the dedicated Events pages pass lockToEvent): type is fixed to SERVICE and the
  // category is preset to "Events & Experiences". isStockable gates goods-only fields (cost,
  // reorder, perishable/lot/age) so they don't render for services/events/vouchers.
  const isEventMode = !!lockToEvent;
  const isStockable = ['GOODS', 'INGREDIENT', 'EQUIPMENT'].includes(type);
  const batchCost = recipeIngredients.reduce((sum, row) => {
    if (!row.qty || !(row.cost_price ?? 0)) return sum;
    return sum + row.qty * (row.cost_price ?? 0) * (1 + (row.waste_percent ?? 0) / 100);
  }, 0);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setSku(item.sku);
      setDescription(item.description ?? '');
      setType(item.type);
      setCategoryId(item.category_id ?? '');
      setUnitId(item.unit_id ?? '');
      setBarcode(item.barcode ?? '');
      setReorderLevel(String(item.reorder_level ?? ''));
      setReorderQty(String(item.reorder_quantity ?? ''));
      setCostPrice(item.cost_price != null ? String(item.cost_price) : '');
      setTaxCode(item.tax_code_id ?? '');
      setTaxInclusive(item.tax_inclusive ?? false);
      setRequiresAge(item.requires_age_verification);
      setIsPerishable(item.is_perishable);
      setTrackLots(item.track_lots);
      setIsActive(item.is_active !== false);
      setImageUrl(item.image_url ?? '');
      setEventStartAt(toLocalDatetimeValue(item.event_start_at));
      setEventEndAt(toLocalDatetimeValue(item.event_end_at));
      setEventVenue(item.event_venue ?? '');
      setTotalCapacity(item.total_capacity != null ? String(item.total_capacity) : '');
      setUseCase(item.use_case ?? 'RETAIL');
      setMealPlan(item.meal_plan ?? '');
      setOccupancyBasis(item.occupancy_basis ?? '');
      setMaxAdults(item.max_adults != null ? String(item.max_adults) : '');
      setMaxChildren(item.max_children != null ? String(item.max_children) : '');
      setSingleSupplement(item.single_supplement != null ? String(item.single_supplement) : '');
      setExtraBedAllowed(item.extra_bed_allowed ?? false);
      const trs = (item.metadata?.ticket_tiers as TicketTier[]) ?? [];
      setTiers(trs);
      const rc = item.metadata?.recurrence_config as RecurrenceConfig | undefined;
      setRecurrenceConfig((item.metadata?.is_recurring && rc) ? rc : null);
    }
  }, [item]);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories', orgSlug],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Category[]; total: number } | Category[]>(`/api/v1/${orgSlug}/inventory/categories`);
      return Array.isArray(res) ? res : (res as { data: Category[] }).data ?? [];
    },
    placeholderData: [],
  });

  const { data: units } = useQuery<Unit[]>({
    queryKey: ['units', orgSlug],
    queryFn: () => apiClient.get<Unit[]>(`/api/v1/${orgSlug}/inventory/units`),
    placeholderData: [],
  });

  // In event mode show only event categories; fall back to all if the tenant has none seeded.
  const eventCategories = categories?.filter(isEventCategory) ?? [];
  const visibleCategories = isEventMode
    ? (eventCategories.length > 0 ? eventCategories : categories)
    : categories;

  // Preset the "Events & Experiences" category for a new event once categories have loaded.
  useEffect(() => {
    if (!isEventMode || item || categoryId) return;
    const evt = categories?.find(isEventCategory);
    if (evt) setCategoryId(evt.id);
  }, [isEventMode, item, categories, categoryId]);

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2 MB');
      return;
    }
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<{ url: string }>('/api/v1/media/upload', form);
      setImageUrl(res.url);
    } finally {
      setUploadingImage(false);
    }
  }

  function addTier() {
    setTiers((prev) => [...prev, { name: '', price: 0, capacity: 0 }]);
  }

  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateTier(i: number, field: keyof TicketTier, value: string | number) {
    setTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    // Ticket tiers can never allocate more seats than the event's total capacity.
    if (type === 'SERVICE') {
      const totalCap = totalCapacity !== '' ? parseInt(totalCapacity, 10) || 0 : 0;
      const allocated = tiers.reduce((sum, t) => sum + (t.capacity || 0), 0);
      if (totalCap > 0 && allocated > totalCap) {
        toast.error(`Ticket tiers total ${allocated} seats but the event capacity is only ${totalCap}. Reduce tier capacities.`);
        return;
      }
    }

    // Composite path: RECIPE type with ingredients defined inline
    if (isRecipe && recipeIngredients.length > 0 && sellingPrice) {
      compositeMut.mutate({
        name: name.trim(),
        sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        category_name: categories?.find((c) => c.id === categoryId)?.name,
        selling_price: parseFloat(sellingPrice),
        servings: parseFloat(servings) || 1,
        tags: [],
        is_perishable: isPerishable,
        image_url: imageUrl || undefined,
        ingredients: recipeIngredients.map((row) => ({
          ingredient_name: row.ingredient_name,
          ingredient_sku:  row.ingredient_sku || undefined,
          qty:             row.qty,
          unit:            row.unit,
          waste_percent:   row.waste_percent || 0,
          notes:           row.notes || undefined,
          cost_price:      row.cost_price,
        })),
      });
      return;
    }

    const metadata: Record<string, unknown> = {};
    if (type === 'SERVICE') {
      if (tiers.length > 0) metadata.ticket_tiers = tiers;
      if (recurrenceConfig) {
        metadata.is_recurring = true;
        metadata.recurrence_config = recurrenceConfig;
        metadata.recurrence_pattern = generateRecurrencePattern(recurrenceConfig);
      }
    }

    onSubmit({
      name: name.trim(),
      sku: sku.trim() || undefined,
      description: description.trim() || undefined,
      type,
      category_id: categoryId || undefined,
      unit_id: unitId || undefined,
      barcode: barcode.trim() || undefined,
      reorder_level: reorderLevel ? parseInt(reorderLevel, 10) : undefined,
      reorder_quantity: reorderQty ? parseInt(reorderQty, 10) : undefined,
      cost_price: costPrice !== '' ? parseFloat(costPrice) : undefined,
      tax_code_id: taxCode.trim() || undefined,
      tax_inclusive: taxInclusive,
      requires_age_verification: requiresAge,
      is_perishable: isPerishable,
      track_lots: trackLots,
      is_active: isActive,
      image_url: imageUrl || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      total_capacity: totalCapacity ? parseInt(totalCapacity, 10) : undefined,
      event_start_at: eventStartAt ? new Date(eventStartAt).toISOString() : undefined,
      event_end_at: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
      event_venue: eventVenue.trim() || undefined,
      // Hospitality (SERVICE items)
      use_case: isService && useCase !== 'RETAIL' ? useCase : undefined,
      meal_plan: isService && useCase === 'HOSPITALITY_ROOM' && mealPlan ? (mealPlan as CreateItemInput['meal_plan']) : undefined,
      occupancy_basis: isService && useCase === 'HOSPITALITY_ROOM' && occupancyBasis ? (occupancyBasis as CreateItemInput['occupancy_basis']) : undefined,
      max_adults: isService && useCase === 'HOSPITALITY_ROOM' && maxAdults ? parseInt(maxAdults, 10) : undefined,
      max_children: isService && useCase === 'HOSPITALITY_ROOM' && maxChildren ? parseInt(maxChildren, 10) : undefined,
      single_supplement: isService && useCase === 'HOSPITALITY_ROOM' && singleSupplement ? parseFloat(singleSupplement) : undefined,
      extra_bed_allowed: isService && useCase === 'HOSPITALITY_ROOM' ? extraBedAllowed : undefined,
    });
  }

  const isService = type === 'SERVICE';
  // Ticket-tier capacity gating: the sum of tier capacities must never exceed the event total.
  const totalCapNum = totalCapacity !== '' ? parseInt(totalCapacity, 10) || 0 : 0;
  const tiersAllocated = tiers.reduce((sum, t) => sum + (t.capacity || 0), 0);
  const tiersOverCapacity = isService && totalCapNum > 0 && tiersAllocated > totalCapNum;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-3xl mx-4 max-h-[92vh] overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{lockToEvent ? (item ? 'Edit Event' : 'New Event') : (item ? 'Edit Item' : 'New Item')}</h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Identity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SKU</label>
                  <Input placeholder="Auto-generated if blank" value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type *</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} disabled={lockToEvent} className={`${selectCls} ${lockToEvent ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Barcode</label>
                  <Input placeholder="Barcode (optional)" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={lockToEvent} className={`${selectCls} ${lockToEvent ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <option value="">No category</option>
                    {visibleCategories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit</label>
                  <select value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={lockToEvent} className={`${selectCls} ${lockToEvent ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <option value="">No unit</option>
                    {units?.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  placeholder="Optional description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                />
              </div>

              {/* Image */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Item Image</label>
                <div className="flex items-center gap-3">
                  {imageUrl ? (
                    <div className="relative h-16 w-16 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Item" className="h-16 w-16 rounded-lg object-cover border border-input" />
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-input flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                      {uploadingImage ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading…</> : 'Upload Image'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">JPEG or PNG · max 2 MB</p>
                  </div>
                </div>
              </div>

              {/* Cost Price */}
              {['GOODS', 'INGREDIENT', 'EQUIPMENT'].includes(type) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cost Price (KES)</label>
                  <Input type="number" min="0" step="0.01" placeholder="Unit cost from supplier" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used for recipe costing and food cost variance reports</p>
                </div>
              )}

              {/* Tax & compliance — per-item override of the tenant Tax & Compliance defaults */}
              {['GOODS', 'RECIPE', 'SERVICE', 'VOUCHER'].includes(type) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tax Code <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <Input placeholder="e.g. VAT-16" value={taxCode} onChange={(e) => setTaxCode(e.target.value.toUpperCase())} />
                    <p className="text-xs text-muted-foreground">KRA/eTIMS code. Leave blank to use the tenant default.</p>
                  </div>
                  <label className="flex items-start gap-2 text-sm cursor-pointer sm:pt-7">
                    <input type="checkbox" checked={taxInclusive} onChange={(e) => setTaxInclusive(e.target.checked)} className="rounded mt-0.5" />
                    <span>Price is inclusive of tax (VAT)<br /><span className="text-xs text-muted-foreground font-normal">Tax is computed backwards from the price.</span></span>
                  </label>
                </div>
              )}

              {/* Stock-only fields — irrelevant for services/events/vouchers/recipes */}
              {isStockable && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reorder Level</label>
                      <Input type="number" min="0" placeholder="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reorder Quantity</label>
                      <Input type="number" min="0" placeholder="0" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={requiresAge} onChange={(e) => setRequiresAge(e.target.checked)} className="rounded" />
                      Requires Age Verification
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={isPerishable} onChange={(e) => setIsPerishable(e.target.checked)} className="rounded" />
                      Perishable
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={trackLots} onChange={(e) => setTrackLots(e.target.checked)} className="rounded" />
                      Track Lots
                    </label>
                  </div>
                </>
              )}

              {/* Recipe section — RECIPE type only */}
              {isRecipe && (
                <div className="space-y-3 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setRecipeOpen((o) => !o)}
                    className="flex items-center justify-between w-full text-sm font-semibold"
                  >
                    <span>Recipe / BOM Ingredients</span>
                    {recipeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {recipeOpen && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Selling Price (KES) *</label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="e.g. 900"
                            value={sellingPrice}
                            onChange={(e) => setSellingPrice(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">The price customers pay. Never overwritten by the system.</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Servings (yield)</label>
                          <Input
                            type="number"
                            min={0.1}
                            step={0.5}
                            placeholder="1"
                            value={servings}
                            onChange={(e) => setServings(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">Portions this batch produces.</p>
                        </div>
                      </div>

                      {/* Ingredient rows */}
                      <div className="space-y-0">
                        <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_72px_72px_64px_104px_100px_36px] gap-2 py-1 text-xs font-medium text-muted-foreground border-b border-border">
                          <span>Ingredient</span><span>Qty</span><span>Unit</span><span>Waste%</span><span>EP Cost</span><span>Line</span><span/>
                        </div>
                        {recipeIngredients.map((row, i) => (
                          <RecipeIngredientRow
                            key={i}
                            orgSlug={orgSlug}
                            row={row}
                            index={i}
                            onChange={(idx, updated) =>
                              setRecipeIngredients((prev) => prev.map((r, j) => j === idx ? updated : r))
                            }
                            onRemove={(idx) =>
                              setRecipeIngredients((prev) => prev.filter((_, j) => j !== idx))
                            }
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setRecipeIngredients((prev) => [...prev, {
                            ingredient_name: '', ingredient_sku: '', qty: 0, unit: 'g', waste_percent: 0, notes: '',
                          }])}
                          className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        >
                          <Plus className="h-3 w-3" /> Add Ingredient
                        </button>
                      </div>

                      {/* Live budget bar */}
                      {sellingPrice && parseFloat(sellingPrice) > 0 && (
                        <FoodCostBudgetBar
                          sellingPrice={parseFloat(sellingPrice)}
                          batchCost={batchCost}
                          servings={parseFloat(servings) || 1}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Hospitality — non-event SERVICE items only (rooms / facilities / amenities) */}
              {isService && !isEventMode && (
                <div className="space-y-4 border-t border-border pt-4">
                  <p className="text-sm font-semibold">Hospitality</p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Use Case</label>
                    <select value={useCase} onChange={(e) => setUseCase(e.target.value as ItemUseCase)} className={selectCls}>
                      {ITEM_USE_CASES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                    <p className="text-xs text-muted-foreground">Drives how this service is sold &amp; priced in POS. Rates are set under Pricing tiers.</p>
                  </div>

                  {useCase === 'HOSPITALITY_ROOM' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Meal Plan</label>
                          <select value={mealPlan} onChange={(e) => setMealPlan(e.target.value)} className={selectCls}>
                            <option value="">— Select —</option>
                            {MEAL_PLANS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Occupancy Basis</label>
                          <select value={occupancyBasis} onChange={(e) => setOccupancyBasis(e.target.value)} className={selectCls}>
                            <option value="">— Select —</option>
                            <option value="per_room">Per Room</option>
                            <option value="per_person_sharing">Per Person Sharing</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Max Adults</label>
                          <Input type="number" min="0" placeholder="2" value={maxAdults} onChange={(e) => setMaxAdults(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Max Children</label>
                          <Input type="number" min="0" placeholder="0" value={maxChildren} onChange={(e) => setMaxChildren(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Single Supplement (KES)</label>
                          <Input type="number" min="0" step="0.01" placeholder="0" value={singleSupplement} onChange={(e) => setSingleSupplement(e.target.value)} />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={extraBedAllowed} onChange={(e) => setExtraBedAllowed(e.target.checked)} className="rounded" />
                        Extra bed allowed
                      </label>
                    </>
                  )}
                </div>
              )}

              {/* Event Details — event-mode SERVICE items only */}
              {isService && isEventMode && (
                <div className="space-y-4 border-t border-border pt-4">
                  <p className="text-sm font-semibold">Event Details</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={eventStartAt}
                        onChange={(e) => setEventStartAt(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">End Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={eventEndAt}
                        onChange={(e) => setEventEndAt(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Venue / Location</label>
                      <Input placeholder="e.g. Urban Loft Busia" value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Total Capacity (tickets)</label>
                      <Input type="number" min="0" placeholder="e.g. 100" value={totalCapacity} onChange={(e) => setTotalCapacity(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <RecurrenceEditor value={recurrenceConfig} onChange={setRecurrenceConfig} />
                  </div>

                  {/* Ticket tiers */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Ticket Tiers</label>
                      <button type="button" onClick={addTier} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <Plus className="h-3 w-3" /> Add Tier
                      </button>
                    </div>
                    {tiers.length === 0 && (
                      <p className="text-xs text-muted-foreground">No tiers — single-price event. Add tiers for General / VIP / VVIP pricing.</p>
                    )}
                    {tiers.map((tier, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                        <div className="space-y-1">
                          {i === 0 && <label className="text-xs text-muted-foreground">Name</label>}
                          <Input placeholder="e.g. VIP" value={tier.name} onChange={(e) => updateTier(i, 'name', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          {i === 0 && <label className="text-xs text-muted-foreground">Price (KES)</label>}
                          <Input type="number" min="0" placeholder="0" value={tier.price || ''} onChange={(e) => updateTier(i, 'price', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1">
                          {i === 0 && <label className="text-xs text-muted-foreground">Capacity</label>}
                          <Input type="number" min="0" max={totalCapNum || undefined} placeholder="0" value={tier.capacity || ''} onChange={(e) => updateTier(i, 'capacity', parseInt(e.target.value, 10) || 0)} />
                        </div>
                        <button type="button" onClick={() => removeTier(i)} className="pb-0.5 text-destructive hover:opacity-70">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {tiers.length > 0 && totalCapNum > 0 && (
                      <p className={`text-xs ${tiersOverCapacity ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        Allocated {tiersAllocated} of {totalCapNum} tickets
                        {tiersOverCapacity
                          ? ` — ${tiersAllocated - totalCapNum} over the event capacity`
                          : ` · ${totalCapNum - tiersAllocated} unallocated`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={isPending || tiersOverCapacity}>
                  {isPending ? 'Saving...' : item ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
