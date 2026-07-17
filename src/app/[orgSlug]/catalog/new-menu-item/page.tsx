'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { InfoHint } from '@/components/ui/info-hint';
import { CategoryCombobox } from '@/components/inventory/CategoryCombobox';
import { DuplicateNameWarning } from '@/components/inventory/DuplicateNameWarning';
import { FoodCostBudgetBar } from '@/components/inventory/FoodCostBudgetBar';
import { RECIPE_GRID_HEADER, RecipeIngredientRow, ingredientCostForSubmit, ingredientLineForSubmit, recipeLineCost, type IngredientRowValue } from '@/components/inventory/RecipeIngredientRow';
import { ItemSearchInput, type ItemResult } from '@/components/inventory/ItemSearchInput';
import { useDuplicateNameWarning } from '@/hooks/useDuplicateNameWarning';
import { apiClient } from '@/lib/api/client';
import { itemsApi, type Item, type MenuItemCompositeRequest } from '@/lib/api/items';
import { useUnits } from '@/hooks/useUnits';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

const STEPS = ['Basic Info', 'Ingredients', 'Modifiers'] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
            i < current  ? 'bg-primary border-primary text-primary-foreground' :
            i === current ? 'border-primary text-primary' :
                            'border-border text-muted-foreground'
          }`}>
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={`text-sm ${i === current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
          {i < STEPS.length - 1 && <div className="hidden sm:block h-px w-8 bg-border" />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1 ─────────────────────────────────────────────────────────────────────

interface Step1Data {
  name:         string;
  sku:          string;
  categoryName: string;
  description:  string;
  sellingPrice: string;
  servings:     string;
  targetMargin: string;
  /** Reusable menu component: other recipes may consume this item (sub-recipe). */
  usableInRecipes: boolean;
  /** Content of one portion (e.g. 300 ml pot of tea) — lets other recipes use ml/g lines. */
  contentQty:  string;
  contentUom:  string;
}

function Step1({ orgSlug, data, onChange }: { orgSlug: string; data: Step1Data; onChange: (d: Step1Data) => void }) {
  function set(key: keyof Step1Data, val: string | boolean) {
    onChange({ ...data, [key]: val });
  }

  // Duplicate-name warning — debounced server search restricted to RECIPE (menu) items,
  // mirroring ItemFormDialog's item dup-check. Informational only; this wizard has no
  // natural "pick existing instead" target, unlike the inline create-from-search flow.
  const [dupSearch, setDupSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDupSearch(data.name.trim()), 300);
    return () => clearTimeout(t);
  }, [data.name]);
  const { data: dupCandidates } = useQuery<Item[]>({
    queryKey: ['item-dup-check', orgSlug, dupSearch, 'RECIPE'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Item[]; total: number } | Item[]>(
        `/api/v1/${orgSlug}/inventory/items`,
        { search: dupSearch, type: 'RECIPE' },
      );
      return Array.isArray(res) ? res : (res as { data: Item[] }).data ?? [];
    },
    enabled: !!orgSlug && dupSearch.length >= 2,
    placeholderData: [],
    staleTime: 15_000,
  });
  const dupMatches = useDuplicateNameWarning(dupCandidates, data.name);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Menu Item Name *</label>
          <Input placeholder="e.g. Beef Grilled (200g)" value={data.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">SKU <span className="text-muted-foreground font-normal">(auto-generated if blank)</span></label>
          <Input placeholder="e.g. BEE006" value={data.sku} onChange={(e) => set('sku', e.target.value)} />
        </div>
      </div>

      {dupMatches.length > 0 && (
        <DuplicateNameWarning matches={dupMatches} entityLabel="menu item" renderDetail={(i) => i.sku} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <CategoryCombobox orgSlug={orgSlug} value={data.categoryName} onChange={(name) => set('categoryName', name)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Selling Price (KES) *</label>
          <Input type="number" min={0} step={DECIMAL_STEP} placeholder="e.g. 900" value={data.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium inline-flex items-center gap-1">Servings (batch yield)
            <InfoHint title="Batch yield">The number of portions the ingredient quantities in Step 2 produce. Enter 1 if you list ingredients for a single serving; enter 10 if the recipe is written for a batch of 10. Cost per portion = batch cost ÷ servings.</InfoHint>
          </label>
          <Input type="number" min={0.1} step={DECIMAL_STEP} placeholder="1" value={data.servings} onChange={(e) => set('servings', e.target.value)} />
          <p className="text-xs text-muted-foreground">How many portions this batch produces (usually 1).</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium inline-flex items-center gap-1">Target Margin % <span className="text-muted-foreground font-normal">(optional)</span>
            <InfoHint title="Target food-cost margin">The gross margin you aim to keep on this dish. The food-cost bar in Step 2 turns red when ingredient cost eats into this target, warning you to raise the price or trim the recipe. Leave blank to use the tenant default.</InfoHint>
          </label>
          <Input type="number" min={0} max={99} step={DECIMAL_STEP} placeholder="e.g. 30" value={data.targetMargin} onChange={(e) => set('targetMargin', e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
          placeholder="Describe the dish…"
          value={data.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      {/* Reusable menu component — other recipes may pour/measure this item as an
          ingredient (Black Tea 30 ml inside an Iced Passion Tea). */}
      <div className="space-y-3 rounded-lg border border-border p-3">
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data.usableInRecipes}
            onChange={(e) => set('usableInRecipes', e.target.checked)}
            className="rounded mt-0.5"
          />
          <span>
            Usable as an ingredient in other recipes
            <br />
            <span className="text-xs text-muted-foreground font-normal">
              Makes this item pickable in the recipe builder (e.g. Black Tea poured into an Iced Passion Tea).
            </span>
          </span>
        </label>
        {data.usableInRecipes && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium inline-flex items-center gap-1">Content per portion
              <InfoHint title="Content per portion">
                How much ONE portion contains — e.g. a pot of tea holds 300&nbsp;ml. Other recipes can then
                use ml/g lines (30&nbsp;ml = 0.1 portion) and costing/stock deduction stay exact. Leave blank
                if other recipes will reference whole portions.
              </InfoHint>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="e.g. 300"
                value={data.contentQty}
                onChange={(e) => set('contentQty', e.target.value)}
                className="max-w-35"
              />
              <select
                value={data.contentUom}
                onChange={(e) => set('contentUom', e.target.value)}
                className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                disabled={data.contentQty === ''}
              >
                <option value="ml">ml</option>
                <option value="l">L</option>
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
              <span className="text-xs text-muted-foreground">per portion</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

function Step2({ orgSlug, ingredients, setIngredients, sellingPrice, servings }: {
  orgSlug:        string;
  ingredients:    IngredientRowValue[];
  setIngredients: (rows: IngredientRowValue[]) => void;
  sellingPrice:   number;
  servings:       number;
}) {
  const { data: units } = useUnits(orgSlug);
  // Sum of per-line costs with each line's qty converted to the ingredient's base unit —
  // must match the row's Line column exactly (100 ml against a per-L cost = 0.1 × cost/L).
  const batchCost = ingredients.reduce((sum, row) => sum + (recipeLineCost(row) ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-accent/20 p-3 text-sm text-muted-foreground space-y-1.5">
        <p className="flex items-start gap-1.5">
          <strong className="text-foreground">Build the recipe.</strong>
          <span>List every raw ingredient one portion of this dish consumes. Picking an ingredient that isn&apos;t in
          inventory yet will auto-create it. Costs flow from here into the live food-cost bar below.</span>
        </p>
        <p className="text-xs">
          <strong>Initial stock is not set here.</strong> This step defines the <em>recipe</em> (what&apos;s used), not
          how much you have. Add opening stock for each ingredient afterwards on <em>Stock&nbsp;›&nbsp;Adjustments</em>
          (reason &ldquo;Initial Stock Count&rdquo;) or a Stock&nbsp;Take.
        </p>
      </div>

      <div className="space-y-0">
        <div className={`hidden lg:grid ${RECIPE_GRID_HEADER} gap-2 py-1 text-xs font-medium text-muted-foreground border-b border-border`}>
          <span>Ingredient</span>
          <span className="inline-flex items-center gap-1">Qty
            <InfoHint title="Quantity per portion">How much of this ingredient one serving uses, expressed in the Unit beside it. Must be greater than 0.</InfoHint>
          </span>
          <span className="inline-flex items-center gap-1">Unit
            <InfoHint title="Unit of measure">Defaults to the ingredient&apos;s stock unit when you pick it. You can choose a smaller/compatible unit for this line (e.g. ml when the oil is stocked in L) — the quantity is automatically converted back to the stock unit when you save, so costing stays correct.</InfoHint>
          </span>
          <span className="inline-flex items-center gap-1">Waste%
            <InfoHint title="Trim / prep loss">Extra percentage lost to peeling, trimming or cooking. Effective qty = Qty × (1 + Waste%/100), so 100 g at 10% waste costs as 110 g.</InfoHint>
          </span>
          <span className="inline-flex items-center gap-1">EP Cost
            <InfoHint title="Cost the way you buy it">Enter the price you pay and the amount it buys — e.g. a 500&nbsp;ml milk packet at KES&nbsp;52.50 is &ldquo;52.50 per 500&nbsp;ml&rdquo;. The per-base-unit cost is derived automatically for the Line total. Prefilled from the ingredient&apos;s purchase pack; edit to model current prices.</InfoHint>
          </span>
          <span className="inline-flex items-center gap-1">Line
            <InfoHint title="Line cost">Auto-calculated: Qty × EP&nbsp;Cost × (1 + Waste%/100). This is what this one ingredient contributes to the batch cost.</InfoHint>
          </span>
          <span />
        </div>
        {ingredients.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No ingredients yet — add the first one below.</p>
        )}
        {ingredients.map((row, i) => (
          <RecipeIngredientRow
            key={i}
            orgSlug={orgSlug}
            row={row}
            index={i}
            units={units}
            onChange={(idx, updated) =>
              setIngredients(ingredients.map((r, j) => j === idx ? updated : r))
            }
            onRemove={(idx) =>
              setIngredients(ingredients.filter((_, j) => j !== idx))
            }
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setIngredients([...ingredients, {
          ingredient_name: '', ingredient_sku: '', qty: 0, unit: 'g', waste_percent: 0, notes: '',
        }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add Ingredient
      </button>

      {sellingPrice > 0 && (
        <FoodCostBudgetBar
          sellingPrice={sellingPrice}
          batchCost={batchCost}
          servings={servings}
        />
      )}
    </div>
  );
}

// ── Step 3 (Modifiers — optional) ─────────────────────────────────────────────

interface ModOption { name: string; price_adjustment: number; stock_sku: string; linked_name?: string; }
interface ModGroup  { group_name: string; is_required: boolean; max_selections: number; options: ModOption[]; }

function Step3({ orgSlug, modifiers, setModifiers }: { orgSlug: string; modifiers: ModGroup[]; setModifiers: (m: ModGroup[]) => void }) {
  function addGroup() {
    setModifiers([...modifiers, { group_name: '', is_required: false, max_selections: 5, options: [] }]);
  }
  function addOption(gi: number) {
    setModifiers(modifiers.map((g, i) =>
      i === gi ? { ...g, options: [...g.options, { name: '', price_adjustment: 0, stock_sku: '' }] } : g
    ));
  }
  function removeGroup(gi: number) {
    setModifiers(modifiers.filter((_, i) => i !== gi));
  }
  function setGroupField(gi: number, key: keyof ModGroup, val: string | boolean | number) {
    setModifiers(modifiers.map((g, i) => i === gi ? { ...g, [key]: val } : g));
  }
  function setOptionField(gi: number, oi: number, key: keyof ModOption, val: string | number) {
    setModifiers(modifiers.map((g, i) =>
      i === gi ? { ...g, options: g.options.map((o, j) => j === oi ? { ...o, [key]: val } : o) } : g
    ));
  }
  // Linking an existing item (an accompaniment like Ugali, or a goods add-on) fills the
  // option in one go: name, the deduction SKU, and the price adjustment — 0 when the item
  // is a free (non-billable) accompaniment, else its menu selling price.
  function linkOptionItem(gi: number, oi: number, item: ItemResult) {
    const prefillPrice = item.non_billable ? 0 : (item.selling_price ?? 0);
    setModifiers(modifiers.map((g, i) =>
      i === gi
        ? {
            ...g,
            options: g.options.map((o, j) => j === oi
              ? { ...o, name: o.name.trim() || item.name, stock_sku: item.sku, linked_name: item.name, price_adjustment: prefillPrice }
              : o),
          }
        : g
    ));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-accent/20 p-3 text-sm text-muted-foreground space-y-1.5">
        <p>
          <strong className="text-foreground">Modifiers are choices the cashier makes when selling this item</strong> —
          e.g. a &ldquo;Size&rdquo; group (Small / Large) or an &ldquo;Extras&rdquo; group (Extra Cheese, Add Bacon).
          They&apos;re optional; skip this step for a plain dish.
        </p>
        <p className="text-xs">
          Each <strong>group</strong> is one question; each <strong>option</strong> is an answer that can bump the price
          and (optionally) deduct a linked ingredient from stock. This is different from Step&nbsp;2 ingredients, which
          are always consumed by every sale.
        </p>
      </div>

      {modifiers.map((g, gi) => (
        <div key={gi} className="border border-border rounded-lg p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex flex-1 min-w-45 items-center gap-1.5">
              <Input
                placeholder="Group name (e.g. Size, Extras)"
                value={g.group_name}
                onChange={(e) => setGroupField(gi, 'group_name', e.target.value)}
                className="flex-1"
              />
              <InfoHint title="Modifier group">The question shown at the till, e.g. &ldquo;Choose a size&rdquo; or &ldquo;Add extras&rdquo;. Group related options under one name.</InfoHint>
            </span>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={g.is_required} onChange={(e) => setGroupField(gi, 'is_required', e.target.checked)} />
              Required
              <InfoHint title="Required group">When on, the cashier MUST pick an option from this group before the item can be added to the order (e.g. size). Leave off for optional add-ons.</InfoHint>
            </label>
            <button type="button" onClick={() => removeGroup(gi)} className="text-muted-foreground hover:text-destructive text-xs">Remove</button>
          </div>

          <div className="hidden sm:grid grid-cols-[1fr_1fr_120px] gap-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1">Link menu/stock item
              <InfoHint title="Link an existing item (optional)">Pick an existing menu item (e.g. the Ugali accompaniment) or goods item — the option name, deduction SKU and price adjustment are filled automatically: KES&nbsp;0 for free (non-billable) accompaniments, else the item&apos;s menu price. Selling the option deducts the linked item&apos;s stock (recipes deduct their ingredients). Leave blank for a price-only choice.</InfoHint>
            </span>
            <span>Option name</span>
            <span className="inline-flex items-center gap-1">Price adj.
              <InfoHint title="Price adjustment">Amount added to (or, if negative, subtracted from) the selling price when this option is chosen. Prefilled from the linked item (0 for free accompaniments) — edit to override.</InfoHint>
            </span>
          </div>
          {g.options.map((opt, oi) => (
            <div key={oi} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px] gap-2 items-start">
              <div>
                <ItemSearchInput
                  orgSlug={orgSlug}
                  value={opt.linked_name || opt.stock_sku}
                  placeholder="Search item to link…"
                  fixedDropdown
                  allowCreate={false}
                  enableScan={false}
                  onSelect={(item) => linkOptionItem(gi, oi, item)}
                />
                {opt.stock_sku && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Deducts <span className="font-mono">{opt.stock_sku}</span> per selection</p>
                )}
              </div>
              <Input placeholder="Option name" value={opt.name} onChange={(e) => setOptionField(gi, oi, 'name', e.target.value)} />
              <Input type="number" step={DECIMAL_STEP} placeholder="Adj (KES)" value={opt.price_adjustment || ''} onChange={(e) => setOptionField(gi, oi, 'price_adjustment', parseDecimal(e.target.value))} />
            </div>
          ))}
          <button type="button" onClick={() => addOption(gi)} className="text-xs text-primary hover:underline flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add Option
          </button>
        </div>
      ))}

      <button type="button" onClick={addGroup} className="flex items-center gap-1 text-sm text-primary hover:underline">
        <Plus className="h-4 w-4" /> Add Modifier Group
      </button>
    </div>
  );
}

// ── Main wizard page ───────────────────────────────────────────────────────────

export default function NewMenuItemPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [step1, setStep1] = useState<Step1Data>({
    name: '', sku: '', categoryName: '', description: '',
    sellingPrice: '', servings: '1', targetMargin: '',
    usableInRecipes: false, contentQty: '', contentUom: 'ml',
  });
  const [ingredients, setIngredients] = useState<IngredientRowValue[]>([]);
  const [modifiers, setModifiers] = useState<ModGroup[]>([]);

  const compositeMenu = useMutation({
    mutationFn: (payload: MenuItemCompositeRequest) => itemsApi.createMenuItemComposite(orgSlug, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items', orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['recipes', orgSlug] });
      if (data.warnings?.length) toast.warning(data.warnings.join('; '));
      toast.success(`"${step1.name}" created successfully`);
      router.push(`/${orgSlug}/catalog`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sellingPrice = parseDecimal(step1.sellingPrice);
  const servings     = parseDecimal(step1.servings, 1);

  function canAdvance() {
    if (step === 0) return step1.name.trim().length > 0;
    return true;
  }

  function handleSubmit() {
    if (!step1.name.trim()) {
      toast.error('Menu item name is required');
      setStep(0);
      return;
    }
    if (sellingPrice <= 0) {
      toast.error('Selling price is required');
      setStep(0);
      return;
    }
    // Drop blank ingredient rows (no name and no SKU).
    const cleanIngredients = ingredients.filter(
      (r) => r.ingredient_name.trim() !== '' || r.ingredient_sku.trim() !== '',
    );
    // A recipe line must consume a positive quantity — the API rejects qty <= 0. Catch it here
    // with a precise message instead of letting the whole submit fail server-side.
    const missingQty = cleanIngredients.find((r) => !(r.qty > 0));
    if (missingQty) {
      toast.error(`Enter a quantity greater than 0 for "${missingQty.ingredient_name || missingQty.ingredient_sku}"`);
      setStep(1);
      return;
    }
    const missingUnit = cleanIngredients.find((r) => !r.unit.trim());
    if (missingUnit) {
      toast.error(`Choose a unit for "${missingUnit.ingredient_name || missingUnit.ingredient_sku}"`);
      setStep(1);
      return;
    }
    const cleanModifiers = modifiers
      .filter((g) => g.group_name.trim() !== '')
      .map((g) => ({
        ...g,
        // linked_name is a display-only helper — never sent to the API.
        options: g.options
          .filter((o) => o.name.trim() !== '')
          .map(({ linked_name: _linked, ...o }) => o),
      }));

    const contentQtyNum = step1.contentQty !== '' ? parseFloat(step1.contentQty) || 0 : 0;
    compositeMenu.mutate({
      name:          step1.name.trim(),
      sku:           step1.sku.trim() || undefined,
      category_name: step1.categoryName.trim() || undefined,
      description:   step1.description.trim() || undefined,
      selling_price: sellingPrice,
      servings,
      usable_in_recipes: step1.usableInRecipes,
      unit_content_qty:  step1.usableInRecipes && contentQtyNum > 0 ? contentQtyNum : undefined,
      unit_content_uom:  step1.usableInRecipes && contentQtyNum > 0 ? step1.contentUom : undefined,
      target_margin_percent: step1.targetMargin ? parseDecimal(step1.targetMargin) : undefined,
      // Convert each line to the ingredient's base unit (e.g. 2.5 ml → 0.0025 L) so it stores
      // and costs correctly against the ingredient's per-base-unit cost.
      ingredients:   cleanIngredients.map((r) => {
        const { qty, unit } = ingredientLineForSubmit(r);
        return {
          ingredient_name: r.ingredient_name,
          ingredient_sku:  r.ingredient_sku || undefined,
          qty,
          unit,
          waste_percent:   r.waste_percent || 0,
          notes:           r.notes || undefined,
          // Derived per-base-unit EP cost plus the purchase pack as entered
          // (e.g. 52.50 per 500 ml) so auto-created ingredients record both.
          ...ingredientCostForSubmit(r),
        };
      }),
      modifiers:     cleanModifiers.length > 0 ? cleanModifiers : undefined,
    });
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">New Menu Item</h1>
      </div>

      <Card>
        <CardHeader>
          <StepIndicator current={step} />
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 && <Step1 orgSlug={orgSlug} data={step1} onChange={setStep1} />}
          {step === 1 && (
            <Step2
              orgSlug={orgSlug}
              ingredients={ingredients}
              setIngredients={setIngredients}
              sellingPrice={sellingPrice}
              servings={servings}
            />
          )}
          {step === 2 && <Step3 orgSlug={orgSlug} modifiers={modifiers} setModifiers={setModifiers} />}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
                Next <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={compositeMenu.isPending || !canAdvance()}>
                {compositeMenu.isPending ? 'Creating…' : 'Create Menu Item'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
