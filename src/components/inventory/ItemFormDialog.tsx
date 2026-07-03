'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { InfoHint } from '@/components/ui/info-hint';
import { RecurrenceEditor, generateRecurrencePattern } from '@/components/inventory/RecurrenceEditor';
import { FoodCostBudgetBar } from '@/components/inventory/FoodCostBudgetBar';
import { RecipeIngredientRow, type IngredientRowValue } from '@/components/inventory/RecipeIngredientRow';
import { TaxCodeCombobox } from '@/components/inventory/TaxCodeCombobox';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { SupplierCombobox } from '@/components/inventory/SupplierCombobox';
import { SupplierFormDialog } from '@/components/inventory/SupplierFormDialog';
import { AddCategoryDialog } from '@/components/inventory/CategoryCombobox';
import { UnitQuickCreateDialog } from '@/components/inventory/UnitQuickCreateDialog';
import { useCreateSupplier } from '@/hooks/useSuppliers';
import { type CreateSupplierInput } from '@/lib/api/suppliers';
import { apiErrorMessage } from '@/lib/api/error-message';
import { ItemImagesManager } from '@/components/inventory/ItemImagesManager';
import { apiClient } from '@/lib/api/client';
import { useOutletStore } from '@/store/outlet';
import { catalogScopeFor, nomenclatureFor } from '@/lib/use-case-nomenclature';
import { type CreateItemInput, type Item, type ItemUseCase, type RecurrenceConfig, type MenuItemCompositeRequest, itemsApi, ITEM_USE_CASES, MEAL_PLANS } from '@/lib/api/items';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  /** Seed the name in create mode (e.g. from a "Create <typed text>" inline-create flow). */
  initialName?: string;
  /** Lock the form to event editing: type fixed to SERVICE; category/unit/type read-only (predefined). */
  lockToEvent?: boolean;
  onClose: () => void;
  onSubmit: (data: CreateItemInput) => void;
  isPending: boolean;
}

const inputCls =
  'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const selectCls = `${inputCls} appearance-none`;

function toLocalDatetimeValue(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16); // "YYYY-MM-DDTHH:mm"
}

export function ItemFormDialog({ orgSlug, item, defaultDate, initialName, lockToEvent, onClose, onSubmit, isPending }: Props) {
  // Selected-outlet use_case drives which item types / use-cases / sections are offered.
  // Event mode (the Events pages) is unrestricted: type is fixed to SERVICE regardless.
  const outletUseCase = useOutletStore((s) => s.outlet?.use_case);
  const scope = catalogScopeFor(lockToEvent ? null : outletUseCase);
  const itemNoun = nomenclatureFor(outletUseCase).item;
  // Type options scoped to the outlet; always keep the item's own type when editing so an
  // out-of-scope legacy item stays editable.
  const baseTypes: string[] = lockToEvent ? ['SERVICE'] : scope.itemTypes;
  const typeOptions = item?.type && !baseTypes.includes(item.type) ? [item.type, ...baseTypes] : baseTypes;
  const hospitalityUseCases = ITEM_USE_CASES.filter((u) => scope.itemUseCases.includes(u.value));

  const [name, setName] = useState(item?.name ?? initialName ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [type, setType] = useState<string>(
    item?.type ?? (lockToEvent ? 'SERVICE' : (catalogScopeFor(useOutletStore.getState().outlet?.use_case).itemTypes[0] ?? 'GOODS')),
  );
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '');
  const [unitId, setUnitId] = useState(item?.unit_id ?? '');
  // Preferred supplier (procurement). preferredSupplierName seeds the combobox label in edit
  // mode before its page loads. addVendorOpen drives the inline "+ Add new vendor" dialog.
  const [preferredSupplierId, setPreferredSupplierId] = useState(item?.preferred_supplier_id ?? '');
  const [preferredSupplierName, setPreferredSupplierName] = useState(item?.preferred_supplier_name ?? '');
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const createSupplierMut = useCreateSupplier(orgSlug);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [barcode, setBarcode] = useState(item?.barcode ?? '');
  const [reorderLevel, setReorderLevel] = useState(String(item?.reorder_level ?? ''));
  const [reorderQty, setReorderQty] = useState(String(item?.reorder_quantity ?? ''));
  // Opening stock — create mode only. Seeds on-hand in the default warehouse as an
  // opening_balance adjustment; afterwards stock is managed via Adjustments / Stock Take.
  const [initialQty, setInitialQty] = useState('');
  const [costPrice, setCostPrice] = useState(item?.cost_price != null ? String(item.cost_price) : '');
  const [minSellingPrice, setMinSellingPrice] = useState(item?.min_selling_price != null ? String(item.min_selling_price) : '');
  const [maxSellingPrice, setMaxSellingPrice] = useState(item?.max_selling_price != null ? String(item.max_selling_price) : '');
  const [targetMargin, setTargetMargin] = useState(item?.target_margin_percent != null ? String(item.target_margin_percent) : '');
  const [taxCode, setTaxCode] = useState(item?.tax_code_id ?? '');
  const [taxInclusive, setTaxInclusive] = useState(item?.tax_inclusive ?? false);
  const [requiresAge, setRequiresAge] = useState(item?.requires_age_verification ?? false);
  const [isControlledSubstance, setIsControlledSubstance] = useState(item?.is_controlled_substance ?? false);
  const [isPerishable, setIsPerishable] = useState(item?.is_perishable ?? false);
  const [trackLots, setTrackLots] = useState(item?.track_lots ?? false);
  const [trackSerial, setTrackSerial] = useState(item?.track_serial_numbers ?? false);
  const [shelfLifeDays, setShelfLifeDays] = useState(item?.shelf_life_days != null ? String(item.shelf_life_days) : '');
  const [barcodeType, setBarcodeType] = useState(item?.barcode_type ?? '');
  const [weightKg, setWeightKg] = useState(item?.weight_kg != null ? String(item.weight_kg) : '');
  const [dimLength, setDimLength] = useState(item?.dimensions_cm?.length != null ? String(item.dimensions_cm.length) : '');
  const [dimWidth, setDimWidth] = useState(item?.dimensions_cm?.width != null ? String(item.dimensions_cm.width) : '');
  const [dimHeight, setDimHeight] = useState(item?.dimensions_cm?.height != null ? String(item.dimensions_cm.height) : '');
  const [durationMinutes, setDurationMinutes] = useState(item?.duration_minutes != null ? String(item.duration_minutes) : '');
  const [isActive, setIsActive] = useState(item?.is_active !== false);

  // Image — primary image URL (mirrored to image_url). The multi-image gallery is managed
  // by ItemImagesManager; this holds the create-mode single-image fallback / primary URL.
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '');

  // Event fields
  const [eventStartAt, setEventStartAt] = useState(toLocalDatetimeValue(item?.event_start_at ?? defaultDate));
  const [eventEndAt, setEventEndAt] = useState(toLocalDatetimeValue(item?.event_end_at));
  const [eventVenue, setEventVenue] = useState(item?.event_venue ?? '');
  const [totalCapacity, setTotalCapacity] = useState(item?.total_capacity != null ? String(item.total_capacity) : '');

  // Hospitality fields (SERVICE items: rooms / facilities / amenities). Default to the
  // outlet's item use_case (e.g. services → SALON_SERVICE) so new entries are scoped.
  const [useCase, setUseCase] = useState<ItemUseCase>(
    item?.use_case ?? (catalogScopeFor(useOutletStore.getState().outlet?.use_case).defaultItemUseCase ?? 'RETAIL'),
  );
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
      setPreferredSupplierId(item.preferred_supplier_id ?? '');
      setPreferredSupplierName(item.preferred_supplier_name ?? '');
      setBarcode(item.barcode ?? '');
      setReorderLevel(String(item.reorder_level ?? ''));
      setReorderQty(String(item.reorder_quantity ?? ''));
      setCostPrice(item.cost_price != null ? String(item.cost_price) : '');
      setMinSellingPrice(item.min_selling_price != null ? String(item.min_selling_price) : '');
      setMaxSellingPrice(item.max_selling_price != null ? String(item.max_selling_price) : '');
      setTargetMargin(item.target_margin_percent != null ? String(item.target_margin_percent) : '');
      setTaxCode(item.tax_code_id ?? '');
      setTaxInclusive(item.tax_inclusive ?? false);
      setRequiresAge(item.requires_age_verification);
      setIsControlledSubstance(item.is_controlled_substance ?? false);
      setIsPerishable(item.is_perishable);
      setTrackLots(item.track_lots);
      setTrackSerial(item.track_serial_numbers ?? false);
      setShelfLifeDays(item.shelf_life_days != null ? String(item.shelf_life_days) : '');
      setBarcodeType(item.barcode_type ?? '');
      setWeightKg(item.weight_kg != null ? String(item.weight_kg) : '');
      setDimLength(item.dimensions_cm?.length != null ? String(item.dimensions_cm.length) : '');
      setDimWidth(item.dimensions_cm?.width != null ? String(item.dimensions_cm.width) : '');
      setDimHeight(item.dimensions_cm?.height != null ? String(item.dimensions_cm.height) : '');
      setDurationMinutes(item.duration_minutes != null ? String(item.duration_minutes) : '');
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
    if (minSellingPrice !== '' && maxSellingPrice !== '' && parseFloat(minSellingPrice) > parseFloat(maxSellingPrice)) {
      toast.error('Min selling price cannot exceed max selling price.');
      return;
    }

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
      // Preferred supplier: send the chosen uuid; when editing and cleared, send the nil UUID
      // so the backend explicitly unassigns it (nil/omitted would leave it untouched). On
      // create, omit when empty.
      preferred_supplier_id: preferredSupplierId
        ? preferredSupplierId
        : item
          ? '00000000-0000-0000-0000-000000000000'
          : undefined,
      unit_id: unitId || undefined,
      barcode: barcode.trim() || undefined,
      // Opening stock is a create-time seed only — on edit, stock is changed via Adjustments /
      // Stock Take so the ledger stays the single source of truth (avoids double-counting).
      initial_quantity: !item && isStockable && initialQty !== '' ? parseInt(initialQty, 10) : undefined,
      reorder_level: reorderLevel ? parseInt(reorderLevel, 10) : undefined,
      reorder_quantity: reorderQty ? parseInt(reorderQty, 10) : undefined,
      cost_price: costPrice !== '' ? parseFloat(costPrice) : undefined,
      min_selling_price: minSellingPrice !== '' ? parseFloat(minSellingPrice) : undefined,
      max_selling_price: maxSellingPrice !== '' ? parseFloat(maxSellingPrice) : undefined,
      target_margin_percent: targetMargin !== '' ? parseFloat(targetMargin) : undefined,
      tax_code_id: taxCode.trim() || undefined,
      tax_inclusive: taxInclusive,
      barcode_type: barcodeType || undefined,
      requires_age_verification: requiresAge,
      is_controlled_substance: isControlledSubstance,
      is_perishable: isPerishable,
      track_lots: trackLots,
      track_serial_numbers: trackSerial,
      shelf_life_days: shelfLifeDays !== '' ? parseInt(shelfLifeDays, 10) : undefined,
      weight_kg: weightKg !== '' ? parseFloat(weightKg) : undefined,
      dimensions_cm: (dimLength !== '' || dimWidth !== '' || dimHeight !== '')
        ? {
            ...(dimLength !== '' ? { length: parseFloat(dimLength) } : {}),
            ...(dimWidth !== '' ? { width: parseFloat(dimWidth) } : {}),
            ...(dimHeight !== '' ? { height: parseFloat(dimHeight) } : {}),
          }
        : undefined,
      duration_minutes: isService && durationMinutes !== '' ? parseInt(durationMinutes, 10) : undefined,
      is_active: isActive,
      image_url: imageUrl || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      total_capacity: totalCapacity ? parseInt(totalCapacity, 10) : undefined,
      event_start_at: eventStartAt ? new Date(eventStartAt).toISOString() : undefined,
      event_end_at: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
      event_venue: eventVenue.trim() || undefined,
      // Use-case tag: SERVICE items carry the chosen hospitality/service use_case; other
      // items inherit the outlet's default (e.g. pharmacy goods → PHARMACY) so they surface
      // on the right per-use-case page. RETAIL is the backend default, so it's left implicit.
      use_case: isService
        ? (useCase && useCase !== 'RETAIL' ? useCase : undefined)
        : (!isEventMode && scope.defaultItemUseCase && scope.defaultItemUseCase !== 'RETAIL' ? scope.defaultItemUseCase : undefined),
      meal_plan: isService && useCase === 'HOSPITALITY_ROOM' && mealPlan ? (mealPlan as CreateItemInput['meal_plan']) : undefined,
      occupancy_basis: isService && useCase === 'HOSPITALITY_ROOM' && occupancyBasis ? (occupancyBasis as CreateItemInput['occupancy_basis']) : undefined,
      max_adults: isService && useCase === 'HOSPITALITY_ROOM' && maxAdults ? parseInt(maxAdults, 10) : undefined,
      max_children: isService && useCase === 'HOSPITALITY_ROOM' && maxChildren ? parseInt(maxChildren, 10) : undefined,
      single_supplement: isService && useCase === 'HOSPITALITY_ROOM' && singleSupplement ? parseFloat(singleSupplement) : undefined,
      extra_bed_allowed: isService && useCase === 'HOSPITALITY_ROOM' ? extraBedAllowed : undefined,
    });
  }

  const isService = type === 'SERVICE';
  // Selling-price guardrail helpers (GOODS/EQUIPMENT): live margin→price hint + min≤max check.
  const minNum = minSellingPrice !== '' ? parseFloat(minSellingPrice) : null;
  const maxNum = maxSellingPrice !== '' ? parseFloat(maxSellingPrice) : null;
  const minMaxInvalid = minNum != null && maxNum != null && minNum > maxNum;
  const marginNum = targetMargin !== '' ? parseFloat(targetMargin) : null;
  const costNum = costPrice !== '' ? parseFloat(costPrice) : null;
  const suggestedFromMargin =
    costNum != null && costNum > 0 && marginNum != null && marginNum > 0 && marginNum < 100
      ? costNum / (1 - marginNum / 100)
      : null;
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
              <h2 className="text-lg font-semibold">{lockToEvent ? (item ? 'Edit Event' : 'New Event') : (item ? `Edit ${itemNoun}` : `New ${itemNoun}`)}</h2>
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
                    {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Barcode</label>
                  <Input placeholder="Barcode (optional)" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                  {scope.showBarcodeType && (
                    <select value={barcodeType} onChange={(e) => setBarcodeType(e.target.value)} className={`${selectCls} mt-2`}>
                      <option value="">Barcode type (auto)</option>
                      <option value="EAN13">EAN-13</option>
                      <option value="UPC">UPC</option>
                      <option value="CODE128">CODE128</option>
                      <option value="QR">QR</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <CreatableSelect
                    value={categoryId}
                    onChange={setCategoryId}
                    options={(visibleCategories ?? []).map((c) => ({ id: c.id, name: c.name }))}
                    placeholder="No category"
                    disabled={lockToEvent}
                    onAddClick={lockToEvent ? undefined : () => setAddCategoryOpen(true)}
                    addLabel="Add category"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit</label>
                  <CreatableSelect
                    value={unitId}
                    onChange={setUnitId}
                    options={(units ?? []).map((u) => ({ id: u.id, name: `${u.name}${u.abbreviation ? ` (${u.abbreviation})` : ''}` }))}
                    placeholder="No unit"
                    disabled={lockToEvent}
                    onAddClick={lockToEvent ? undefined : () => setAddUnitOpen(true)}
                    addLabel="Add unit"
                  />
                </div>
              </div>

              {/* Preferred Supplier — procurement attribute (drives per-vendor PO split). Shown
                  for stockable items; searchable combobox with an inline "+ Add new vendor". */}
              {isStockable && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preferred Supplier <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <SupplierCombobox
                    orgSlug={orgSlug}
                    value={preferredSupplierId}
                    valueLabel={preferredSupplierName}
                    onChange={(id) => {
                      setPreferredSupplierId(id);
                      if (!id) setPreferredSupplierName('');
                    }}
                    onAddNew={() => setAddVendorOpen(true)}
                  />
                  <p className="text-xs text-muted-foreground">Default vendor used when auto-cutting purchase orders for this item.</p>
                </div>
              )}

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

              {/* Images — multi-image gallery (edit mode) with single-image fallback (create mode).
                  The primary image is mirrored to image_url for backward compatibility. */}
              <ItemImagesManager
                orgSlug={orgSlug}
                itemId={item?.id}
                primaryUrl={imageUrl}
                onPrimaryChange={setImageUrl}
              />

              {/* Cost Price */}
              {['GOODS', 'INGREDIENT', 'EQUIPMENT'].includes(type) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cost Price (KES)</label>
                  <Input type="number" min="0" step="0.01" placeholder="Unit cost from supplier" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used for recipe costing and food cost variance reports</p>
                </div>
              )}

              {/* Selling-price guardrails + goods margin (GOODS/EQUIPMENT) */}
              {['GOODS', 'EQUIPMENT'].includes(type) && (
                <div className="space-y-3 border border-border rounded-lg p-3">
                  <p className="text-sm font-semibold">Selling-price guardrails</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Min Selling Price (KES)</label>
                      <Input type="number" min="0" step="0.01" placeholder="Floor" value={minSellingPrice} onChange={(e) => setMinSellingPrice(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Selling Price (KES)</label>
                      <Input type="number" min="0" step="0.01" placeholder="Ceiling" value={maxSellingPrice} onChange={(e) => setMaxSellingPrice(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Target Margin (%)</label>
                      <Input type="number" min="0" max="99.9" step="0.1" placeholder="e.g. 30" value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)} />
                    </div>
                  </div>
                  {minMaxInvalid && (
                    <p className="text-xs text-destructive">Min selling price cannot exceed max selling price.</p>
                  )}
                  {suggestedFromMargin != null && (
                    <p className="text-xs text-muted-foreground">
                      At {targetMargin}% margin, suggested price ≈ <span className="font-semibold">KES {suggestedFromMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      {' '}(price = cost ÷ (1 − margin)). Tier prices are set per profile on the product page and are hard-capped to this band.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Prices outside [min, max] are rejected on price updates and require a manager override at POS.</p>
                </div>
              )}

              {/* Tax & compliance — per-item override of the tenant Tax & Compliance defaults */}
              {['GOODS', 'RECIPE', 'SERVICE', 'VOUCHER'].includes(type) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tax Code <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <TaxCodeCombobox orgSlug={orgSlug} value={taxCode} onChange={setTaxCode} />
                    <p className="text-xs text-muted-foreground">KRA/eTIMS code from treasury. Leave blank to use the tenant default.</p>
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
                  {/* Opening stock — create mode only. Edits go through Adjustments / Stock Take. */}
                  {!item ? (
                    <div className="space-y-2 rounded-lg border border-border bg-accent/20 p-3">
                      <label className="text-sm font-medium inline-flex items-center gap-1">
                        Initial Stock on Hand <span className="text-muted-foreground font-normal">(optional)</span>
                        <InfoHint title="Opening balance">
                          The quantity you already have of this item right now, in its base unit. It seeds on-hand stock
                          in your default warehouse and is logged as an <em>opening balance</em> adjustment. Leave blank
                          (or 0) to start empty. After creation, change stock only via <strong>Stock&nbsp;›&nbsp;Adjustments</strong>
                          or a <strong>Stock Take</strong> so the ledger stays accurate.
                        </InfoHint>
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={initialQty}
                        onChange={(e) => setInitialQty(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Whole units in the item&apos;s base unit, added to the default warehouse. For per-warehouse counts or
                        corrections later, use Adjustments or a Stock Take.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground -mt-1">
                      To change stock levels, use <strong>Stock&nbsp;›&nbsp;Adjustments</strong> or a <strong>Stock Take</strong> — opening stock is set once, at creation.
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium inline-flex items-center gap-1">Reorder Level
                        <InfoHint title="Reorder point">When on-hand falls to or below this number, the item flags as low stock (and can auto-raise a purchase order). This is a threshold, not a stock quantity.</InfoHint>
                      </label>
                      <Input type="number" min="0" placeholder="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium inline-flex items-center gap-1">Reorder Quantity
                        <InfoHint title="Reorder quantity">How much to reorder when the level is hit — the default order/top-up amount. Not your current stock.</InfoHint>
                      </label>
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
                      Track Lots / Batches
                    </label>
                    {scope.showControlledSubstance && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={isControlledSubstance} onChange={(e) => setIsControlledSubstance(e.target.checked)} className="rounded" />
                        Controlled Substance
                      </label>
                    )}
                    {scope.showSerialTracking && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={trackSerial} onChange={(e) => setTrackSerial(e.target.checked)} className="rounded" />
                        Track Serial Numbers
                      </label>
                    )}
                  </div>

                  {/* Shelf life — only meaningful for perishable / lot-tracked goods. Per-batch
                      expiry dates are entered at goods receipt (Lots); this seeds them. */}
                  {scope.showShelfLife && (isPerishable || trackLots) && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default Shelf Life (days)</label>
                      <Input type="number" min="0" placeholder="e.g. 365" value={shelfLifeDays} onChange={(e) => setShelfLifeDays(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Used to auto-fill a batch&apos;s expiry date at goods receipt when none is entered. Exact expiry is set per lot on the Lots &amp; Batches page.</p>
                    </div>
                  )}

                  {scope.showWeightDimensions && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Weight (kg)</label>
                        <Input type="number" min="0" step="0.001" placeholder="Unit weight for shipping/logistics" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Dimensions (cm) — L × W × H</label>
                        <div className="grid grid-cols-3 gap-2">
                          <Input type="number" min="0" step="0.1" placeholder="L" value={dimLength} onChange={(e) => setDimLength(e.target.value)} />
                          <Input type="number" min="0" step="0.1" placeholder="W" value={dimWidth} onChange={(e) => setDimWidth(e.target.value)} />
                          <Input type="number" min="0" step="0.1" placeholder="H" value={dimHeight} onChange={(e) => setDimHeight(e.target.value)} />
                        </div>
                        <p className="text-xs text-muted-foreground">Used for shipping/packing and shelf planning.</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Service duration — services (salon/barber) appointment length */}
              {isService && !isEventMode && scope.showServiceDuration && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service Duration (minutes)</label>
                  <Input type="number" min="0" placeholder="e.g. 45" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used for appointment scheduling at POS.</p>
                </div>
              )}

              {/* Recipe section — RECIPE type only */}
              {isRecipe && (
                <div className="space-y-3 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setRecipeOpen((o) => !o)}
                    className="flex items-center justify-between w-full text-sm font-semibold"
                  >
                    <span className="inline-flex items-center gap-1">Recipe / BOM Ingredients
                      <InfoHint title="Recipe defines consumption, not stock">
                        These ingredients are what one batch of this item <em>uses up</em> when sold or produced — they are
                        not this item&apos;s own stock (a recipe/menu item holds no stock of its own). New ingredients are
                        auto-created empty; set each ingredient&apos;s opening stock on its own item, via Adjustments, or a
                        Stock Take.
                      </InfoHint>
                    </span>
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
                            units={units}
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

              {/* Hospitality — non-event SERVICE items in hospitality/services outlets only
                  (rooms / facilities / amenities / salon services). Hidden for retail, pharmacy,
                  manufacturing etc. where SERVICE items carry no hospitality semantics. */}
              {isService && !isEventMode && scope.showHospitality && (
                <div className="space-y-4 border-t border-border pt-4">
                  <p className="text-sm font-semibold">Service Details</p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Use Case</label>
                    <select value={useCase} onChange={(e) => setUseCase(e.target.value as ItemUseCase)} className={selectCls}>
                      {(hospitalityUseCases.length > 0 ? hospitalityUseCases : ITEM_USE_CASES).map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
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
                <Button type="submit" className="flex-1" disabled={isPending || tiersOverCapacity || minMaxInvalid}>
                  {isPending ? 'Saving...' : item ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {addCategoryOpen && (
        <AddCategoryDialog
          orgSlug={orgSlug}
          initialName=""
          categories={[]}
          onClose={() => setAddCategoryOpen(false)}
          onCreated={(cat) => { setCategoryId(cat.id); setAddCategoryOpen(false); }}
        />
      )}
      {addUnitOpen && (
        <UnitQuickCreateDialog
          orgSlug={orgSlug}
          onClose={() => setAddUnitOpen(false)}
          onCreated={(u) => { setUnitId(u.id); setAddUnitOpen(false); }}
        />
      )}

      {/* Inline "+ Add new vendor" — creates a supplier via the inventory-api master, then
          appends + selects it as the item's preferred supplier. Rendered as a sibling overlay
          so the item form stays mounted and NONE of its in-progress state is lost. */}
      {addVendorOpen && (
        <SupplierFormDialog
          editing={null}
          isPending={createSupplierMut.isPending}
          onClose={() => setAddVendorOpen(false)}
          onSubmit={(data: CreateSupplierInput) => {
            createSupplierMut.mutate(data, {
              onSuccess: (created) => {
                setPreferredSupplierId(created.id);
                setPreferredSupplierName(created.name);
                setAddVendorOpen(false);
                toast.success('Vendor added and set as preferred supplier');
              },
              onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to add vendor')),
            });
          }}
        />
      )}
    </div>
  );
}
