'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { CategoryCombobox } from '@/components/inventory/CategoryCombobox';
import { FoodCostBudgetBar } from '@/components/inventory/FoodCostBudgetBar';
import { RecipeIngredientRow, type IngredientRowValue } from '@/components/inventory/RecipeIngredientRow';
import { itemsApi, type MenuItemCompositeRequest } from '@/lib/api/items';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

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
}

function Step1({ orgSlug, data, onChange }: { orgSlug: string; data: Step1Data; onChange: (d: Step1Data) => void }) {
  function set(key: keyof Step1Data, val: string) {
    onChange({ ...data, [key]: val });
  }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <CategoryCombobox orgSlug={orgSlug} value={data.categoryName} onChange={(name) => set('categoryName', name)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Selling Price (KES) *</label>
          <Input type="number" min={0} step={0.01} placeholder="e.g. 900" value={data.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Servings (batch yield)</label>
          <Input type="number" min={0.1} step={0.5} placeholder="1" value={data.servings} onChange={(e) => set('servings', e.target.value)} />
          <p className="text-xs text-muted-foreground">How many portions this batch produces (usually 1).</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Target Margin % <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input type="number" min={0} max={99} step={1} placeholder="e.g. 30" value={data.targetMargin} onChange={(e) => set('targetMargin', e.target.value)} />
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
  const batchCost = ingredients.reduce((sum, row) => {
    if (!row.qty || !(row.cost_price ?? 0)) return sum;
    return sum + row.qty * (row.cost_price ?? 0) * (1 + (row.waste_percent ?? 0) / 100);
  }, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add each raw ingredient used in this recipe. The system will auto-create any new ingredient in your inventory.
        The <strong>EP (edible portion) cost per base unit</strong> is loaded from each ingredient — edit it for live food-cost.
      </p>

      <div className="space-y-0">
        <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_72px_72px_64px_104px_100px_36px] gap-2 py-1 text-xs font-medium text-muted-foreground border-b border-border">
          <span>Ingredient</span><span>Qty</span><span>Unit</span><span>Waste%</span><span>EP Cost</span><span>Line</span><span />
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

interface ModOption { name: string; price_adjustment: number; stock_sku: string; }
interface ModGroup  { group_name: string; is_required: boolean; max_selections: number; options: ModOption[]; }

function Step3({ modifiers, setModifiers }: { modifiers: ModGroup[]; setModifiers: (m: ModGroup[]) => void }) {
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Modifiers are optional extras (e.g. "Extra Cheese", "Add Bacon"). Add a <strong>Stock SKU</strong> to
        link an option to an ingredient for automatic stock deduction when selected.
      </p>

      {modifiers.map((g, gi) => (
        <div key={gi} className="border border-border rounded-lg p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Input
              placeholder="Group name (e.g. Extras)"
              value={g.group_name}
              onChange={(e) => setGroupField(gi, 'group_name', e.target.value)}
              className="flex-1 min-w-[180px]"
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={g.is_required} onChange={(e) => setGroupField(gi, 'is_required', e.target.checked)} />
              Required
            </label>
            <button type="button" onClick={() => removeGroup(gi)} className="text-muted-foreground hover:text-destructive text-xs">Remove</button>
          </div>

          {g.options.map((opt, oi) => (
            <div key={oi} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px] gap-2">
              <Input placeholder="Option name" value={opt.name} onChange={(e) => setOptionField(gi, oi, 'name', e.target.value)} />
              <Input type="number" placeholder="Adj (KES)" value={opt.price_adjustment || ''} onChange={(e) => setOptionField(gi, oi, 'price_adjustment', parseFloat(e.target.value) || 0)} />
              <Input placeholder="Stock SKU" value={opt.stock_sku} onChange={(e) => setOptionField(gi, oi, 'stock_sku', e.target.value)} />
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

  const sellingPrice = parseFloat(step1.sellingPrice) || 0;
  const servings     = parseFloat(step1.servings) || 1;

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
    const cleanModifiers = modifiers
      .filter((g) => g.group_name.trim() !== '')
      .map((g) => ({ ...g, options: g.options.filter((o) => o.name.trim() !== '') }));

    compositeMenu.mutate({
      name:          step1.name.trim(),
      sku:           step1.sku.trim() || undefined,
      category_name: step1.categoryName.trim() || undefined,
      description:   step1.description.trim() || undefined,
      selling_price: sellingPrice,
      servings,
      target_margin_percent: step1.targetMargin ? parseFloat(step1.targetMargin) : undefined,
      ingredients:   cleanIngredients,
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
          {step === 2 && <Step3 modifiers={modifiers} setModifiers={setModifiers} />}

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
