'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { FoodCostBudgetBar } from '@/components/inventory/FoodCostBudgetBar';
import { RecipeIngredientRow, type IngredientRowValue } from '@/components/inventory/RecipeIngredientRow';
import { itemsApi, type MenuItemCompositeRequest } from '@/lib/api/items';
import { useCategories } from '@/hooks/useCategories';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const ITEM_TYPES = ['GOODS', 'INGREDIENT', 'RECIPE', 'SERVICE', 'EQUIPMENT', 'VOUCHER'] as const;
type ItemType = typeof ITEM_TYPES[number];

const RECIPE_STEPS = ['Basic Info', 'Ingredients', 'Modifiers'] as const;
const SIMPLE_STEPS = ['Basic Info'] as const;

function StepIndicator({ current, steps }: { current: number; steps: readonly string[] }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
            i < current  ? 'bg-primary border-primary text-primary-foreground' :
            i === current ? 'border-primary text-primary' :
                            'border-border text-muted-foreground'
          }`}>
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={`text-sm ${i === current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
          {i < steps.length - 1 && <div className="h-px w-8 bg-border" />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1 ─────────────────────────────────────────────────────────────────────

interface Step1Data {
  type:         ItemType;
  name:         string;
  sku:          string;
  categoryName: string;
  description:  string;
  sellingPrice: string;
  costPrice:    string;
  servings:     string;
  targetMargin: string;
}

function Step1({ data, onChange }: { data: Step1Data; onChange: (d: Step1Data) => void }) {
  function set(key: keyof Step1Data, val: string) {
    onChange({ ...data, [key]: val });
  }
  const isRecipe = data.type === 'RECIPE';
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Item Type *</label>
        <div className="flex flex-wrap gap-2">
          {ITEM_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('type', t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                data.type === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{isRecipe ? 'Menu Item Name' : 'Item Name'} *</label>
          <Input placeholder={isRecipe ? 'e.g. Beef Grilled (200g)' : 'e.g. Butter (1kg)'} value={data.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">SKU <span className="text-muted-foreground font-normal">(auto-generated if blank)</span></label>
          <Input placeholder="e.g. BEE006" value={data.sku} onChange={(e) => set('sku', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <Input placeholder="e.g. Main Dishes" value={data.categoryName} onChange={(e) => set('categoryName', e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {isRecipe ? 'Selling Price (KES) *' : 'Selling Price (KES)'}
          </label>
          <Input type="number" min={0} step={0.01} placeholder="e.g. 900" value={data.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} />
        </div>
      </div>
      {!isRecipe && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Cost Price (KES)</label>
          <Input type="number" min={0} step={0.01} placeholder="Unit cost from supplier" value={data.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
        </div>
      )}
      {isRecipe && (
        <div className="grid grid-cols-2 gap-4">
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
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
          placeholder={isRecipe ? 'Describe the dish…' : 'Optional description…'}
          value={data.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

function Step2({ orgSlug, ingredients, setIngredients, sellingPrice, servings }: {
  orgSlug:      string;
  ingredients:  IngredientRowValue[];
  setIngredients: (rows: IngredientRowValue[]) => void;
  sellingPrice: number;
  servings:     number;
}) {
  const batchCost = ingredients.reduce((sum, row) => {
    if (!row.qty || !(row.cost_price ?? 0)) return sum;
    return sum + row.qty * (row.cost_price ?? 0) * (1 + (row.waste_percent ?? 0) / 100);
  }, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add each raw ingredient used in this recipe. The system will auto-create any new ingredient in your inventory.
        Enter the <strong>EP (edible portion) cost per base unit</strong> for live food-cost calculation.
      </p>

      <div className="space-y-0">
        <div className="grid grid-cols-[1fr_80px_80px_60px_60px_auto] gap-2 py-1 text-xs font-medium text-muted-foreground border-b border-border">
          <span>Ingredient</span><span>Qty</span><span>Unit</span><span>Waste%</span><span>EP Cost</span><span />
        </div>
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
    const updated = modifiers.map((g, i) =>
      i === gi ? { ...g, options: [...g.options, { name: '', price_adjustment: 0, stock_sku: '' }] } : g
    );
    setModifiers(updated);
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
        Modifiers are optional extras (e.g. "Extra Cheese", "Add Bacon"). Add <strong>stock_sku</strong> to
        link an option to an ingredient for automatic stock deduction when selected.
      </p>

      {modifiers.map((g, gi) => (
        <div key={gi} className="border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Input
              placeholder="Group name (e.g. Extras)"
              value={g.group_name}
              onChange={(e) => setGroupField(gi, 'group_name', e.target.value)}
              className="flex-1"
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={g.is_required} onChange={(e) => setGroupField(gi, 'is_required', e.target.checked)} />
              Required
            </label>
            <button type="button" onClick={() => removeGroup(gi)} className="text-muted-foreground hover:text-destructive text-xs">Remove</button>
          </div>

          {g.options.map((opt, oi) => (
            <div key={oi} className="grid grid-cols-[1fr_100px_120px] gap-2">
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
    type: 'RECIPE', name: '', sku: '', categoryName: '', description: '',
    sellingPrice: '', costPrice: '', servings: '1', targetMargin: '',
  });
  const [ingredients, setIngredients] = useState<IngredientRowValue[]>([]);
  const [modifiers, setModifiers] = useState<ModGroup[]>([]);

  const isRecipe = step1.type === 'RECIPE';
  const steps = isRecipe ? RECIPE_STEPS : SIMPLE_STEPS;

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

  const simpleCreate = useMutation({
    mutationFn: (payload: Record<string, unknown>) => itemsApi.create(orgSlug, payload as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', orgSlug] });
      toast.success(`"${step1.name}" created successfully`);
      router.push(`/${orgSlug}/catalog`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isPending = compositeMenu.isPending || simpleCreate.isPending;
  const sellingPrice = parseFloat(step1.sellingPrice) || 0;
  const servings     = parseFloat(step1.servings) || 1;

  function canAdvance() {
    if (step === 0) return step1.name.trim().length > 0;
    return true;
  }

  function handleSubmit() {
    if (isRecipe) {
      compositeMenu.mutate({
        name:          step1.name.trim(),
        sku:           step1.sku.trim() || undefined,
        category_name: step1.categoryName.trim() || undefined,
        description:   step1.description.trim() || undefined,
        selling_price: sellingPrice,
        servings,
        target_margin_percent: step1.targetMargin ? parseFloat(step1.targetMargin) : undefined,
        ingredients,
        modifiers: modifiers.length > 0 ? modifiers : undefined,
      });
    } else {
      simpleCreate.mutate({
        name:         step1.name.trim(),
        sku:          step1.sku.trim() || undefined,
        type:         step1.type,
        category_name: step1.categoryName.trim() || undefined,
        description:  step1.description.trim() || undefined,
        selling_price: sellingPrice || undefined,
        cost_price:   step1.costPrice ? parseFloat(step1.costPrice) : undefined,
      });
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{isRecipe ? 'New Menu Item' : 'New Inventory Item'}</h1>
      </div>

      <Card>
        <CardHeader>
          <StepIndicator current={step} steps={steps} />
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 && <Step1 data={step1} onChange={setStep1} />}
          {step === 1 && isRecipe && (
            <Step2
              orgSlug={orgSlug}
              ingredients={ingredients}
              setIngredients={setIngredients}
              sellingPrice={sellingPrice}
              servings={servings}
            />
          )}
          {step === 2 && isRecipe && <Step3 modifiers={modifiers} setModifiers={setModifiers} />}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
                Next <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isPending || !canAdvance()}>
                {isPending ? 'Creating…' : isRecipe ? 'Create Menu Item' : 'Create Item'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
