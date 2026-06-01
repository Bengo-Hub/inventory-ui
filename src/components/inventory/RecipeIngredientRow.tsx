'use client';

import { Input } from '@/components/ui/base';
import { ItemSearchInput } from './ItemSearchInput';
import { Trash2 } from 'lucide-react';

export interface IngredientRowValue {
  ingredient_name: string;
  ingredient_sku:  string;
  qty:             number;
  unit:            string;
  waste_percent:   number;
  notes:           string;
  cost_price?:     number; // EP cost per base unit — for live costing
}

interface Props {
  orgSlug: string;
  row:     IngredientRowValue;
  index:   number;
  onChange: (index: number, updated: IngredientRowValue) => void;
  onRemove: (index: number) => void;
}

/** One row in the inline recipe ingredient table inside ItemFormDialog / wizard. */
export function RecipeIngredientRow({ orgSlug, row, index, onChange, onRemove }: Props) {
  function set<K extends keyof IngredientRowValue>(key: K, val: IngredientRowValue[K]) {
    onChange(index, { ...row, [key]: val });
  }

  const lineCost =
    row.qty > 0 && (row.cost_price ?? 0) > 0
      ? row.qty * (row.cost_price ?? 0) * (1 + (row.waste_percent ?? 0) / 100)
      : null;

  return (
    <div className="grid grid-cols-[1fr_80px_80px_60px_60px_auto] gap-2 items-end py-2 border-b border-border last:border-0">
      {/* Ingredient search */}
      <div>
        <ItemSearchInput
          orgSlug={orgSlug}
          value={row.ingredient_name}
          placeholder="Ingredient name…"
          fixedDropdown
          onSelect={(item) => {
            onChange(index, {
              ...row,
              ingredient_name: item.name,
              ingredient_sku:  item.sku,
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
          onChange={(e) => set('unit', e.target.value)}
          className="h-8 text-sm"
          placeholder="g / ml / pc"
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

      {/* Line cost (read-only) */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Cost</label>
        <div className="h-8 flex items-center text-xs font-mono text-muted-foreground px-1">
          {lineCost != null ? `KES ${lineCost.toFixed(2)}` : '—'}
        </div>
      </div>

      {/* Remove button */}
      <div className="flex items-end pb-0.5">
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
