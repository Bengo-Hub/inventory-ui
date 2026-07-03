'use client';

import { Input } from '@/components/ui/base';
import { ItemSearchInput } from './ItemSearchInput';
import { Trash2 } from 'lucide-react';

/** Minimal unit shape needed to auto-detect a recipe line's unit from an ingredient. */
type UnitOption = { id: string; abbreviation: string };

export interface IngredientRowValue {
  ingredient_name: string;
  ingredient_sku:  string;
  qty:             number;
  unit:            string;
  waste_percent:   number;
  notes:           string;
  cost_price?:     number; // EP cost per base unit — for live costing
  /** True once the user manually edits the unit, so an ingredient re-pick won't overwrite it. */
  unit_touched?:   boolean;
}

interface Props {
  orgSlug: string;
  row:     IngredientRowValue;
  index:   number;
  onChange: (index: number, updated: IngredientRowValue) => void;
  onRemove: (index: number) => void;
  /** Tenant units, used to auto-fill the unit from the picked ingredient's base unit. */
  units?:  UnitOption[];
}

/** One row in the inline recipe ingredient table inside ItemFormDialog / wizard. */
export function RecipeIngredientRow({ orgSlug, row, index, onChange, onRemove, units }: Props) {
  function set<K extends keyof IngredientRowValue>(key: K, val: IngredientRowValue[K]) {
    onChange(index, { ...row, [key]: val });
  }

  const lineCost =
    row.qty > 0 && (row.cost_price ?? 0) > 0
      ? row.qty * (row.cost_price ?? 0) * (1 + (row.waste_percent ?? 0) / 100)
      : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_72px_72px_64px_104px_100px_36px] gap-2 items-end py-3 border-b border-border last:border-0">
      {/* Ingredient search — full width on mobile, first column on desktop */}
      <div className="col-span-2 lg:col-span-1 min-w-0">
        <label className="text-xs text-muted-foreground mb-1 block lg:hidden">Ingredient</label>
        <ItemSearchInput
          orgSlug={orgSlug}
          value={row.ingredient_name}
          placeholder="Search ingredient…"
          fixedDropdown
          onSelect={(item) => {
            // Auto-detect the recipe line's unit from the ingredient's own base unit so the
            // operator doesn't have to guess it (unless they already typed one themselves).
            const detected = item.unit_id
              ? units?.find((u) => u.id === item.unit_id)?.abbreviation
              : undefined;
            const nextUnit = row.unit_touched && row.unit ? row.unit : (detected ?? row.unit);
            onChange(index, {
              ...row,
              ingredient_name: item.name,
              ingredient_sku:  item.sku,
              unit: nextUnit,
              // Prefill the EP cost from the picked ingredient so line/batch costs populate.
              cost_price: item.cost_price ?? row.cost_price,
            });
          }}
        />
      </div>

      {/* Quantity */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
        <Input
          type="number"
          min={0}
          step={0.001}
          value={row.qty || ''}
          onChange={(e) => set('qty', parseFloat(e.target.value) || 0)}
          className="h-8 text-sm"
          placeholder="0"
        />
      </div>

      {/* Unit */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
        <Input
          value={row.unit}
          onChange={(e) => onChange(index, { ...row, unit: e.target.value, unit_touched: true })}
          className="h-8 text-sm"
          placeholder="g / ml / pc"
          title="Auto-filled from the ingredient's base unit when you pick it. Override if this recipe uses a different unit."
        />
      </div>

      {/* Waste % */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Waste%</label>
        <Input
          type="number"
          min={0}
          max={99}
          value={row.waste_percent || ''}
          onChange={(e) => set('waste_percent', parseFloat(e.target.value) || 0)}
          className="h-8 text-sm"
          placeholder="0"
        />
      </div>

      {/* EP cost per base unit (editable; prefilled on select) */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">EP Cost</label>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={row.cost_price ?? ''}
          onChange={(e) => set('cost_price', e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
          className="h-8 text-sm"
          placeholder="0.00"
        />
      </div>

      {/* Line cost (read-only) */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Line</label>
        <div className="h-8 flex items-center text-xs font-mono text-muted-foreground px-1 tabular-nums">
          {lineCost != null ? lineCost.toFixed(2) : '—'}
        </div>
      </div>

      {/* Remove button */}
      <div className="flex items-end justify-end pb-1">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove ingredient"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
