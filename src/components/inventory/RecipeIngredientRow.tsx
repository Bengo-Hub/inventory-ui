'use client';

import { Input } from '@/components/ui/base';
import { ItemSearchInput } from './ItemSearchInput';
import { convertQuantity, normalizeUnit, unitOptionsForBase } from '@/lib/units/convert';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Minimal unit shape needed to auto-detect a recipe line's unit from an ingredient. */
type UnitOption = { id: string; abbreviation: string };

export interface IngredientRowValue {
  ingredient_name: string;
  ingredient_sku:  string;
  qty:             number;
  unit:            string;
  waste_percent:   number;
  notes:           string;
  cost_price?:     number; // EP cost per BASE unit — for live costing
  /** True once the user manually edits the unit, so an ingredient re-pick won't overwrite it. */
  unit_touched?:   boolean;
  /** The ingredient's own stock/base unit abbreviation (e.g. "L"). The line unit may differ
   *  (e.g. "ml"); qty is converted to this base unit before costing and submission. */
  base_unit?:      string;
}

/**
 * Convert a recipe line to the ingredient's base unit for submission/costing.
 * e.g. 2.5 ml against a base of L → { qty: 0.0025, unit: "L" }. Falls back to the
 * entered values when there's no base unit or the units aren't convertible.
 */
export function ingredientLineForSubmit(row: IngredientRowValue): { qty: number; unit: string } {
  if (row.base_unit && row.unit) {
    const conv = convertQuantity(row.qty, row.unit, row.base_unit);
    if (conv != null) return { qty: conv, unit: row.base_unit };
  }
  return { qty: row.qty, unit: row.unit };
}

/** qty of this line expressed in its base unit (for live line/batch cost). */
function qtyInBaseUnit(row: IngredientRowValue): number {
  if (row.base_unit && row.unit) {
    const conv = convertQuantity(row.qty, row.unit, row.base_unit);
    if (conv != null) return conv;
  }
  return row.qty;
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

  // Qty is edited through a local string so intermediate values like "0.", "0.00" and
  // "0.0005" survive keystrokes instead of being coerced to 0 (which used to blank the
  // field and drop leading zeros, turning "0.0005" into "5").
  const [qtyText, setQtyText] = useState<string>(row.qty ? String(row.qty) : '');
  useEffect(() => {
    const parsed = parseFloat(qtyText);
    const current = Number.isNaN(parsed) ? 0 : parsed;
    if (current !== row.qty) setQtyText(row.qty ? String(row.qty) : '');
    // Only resync when the external numeric value diverges from what's typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.qty]);

  const baseQty = qtyInBaseUnit(row);
  const lineCost =
    baseQty > 0 && (row.cost_price ?? 0) > 0
      ? baseQty * (row.cost_price ?? 0) * (1 + (row.waste_percent ?? 0) / 100)
      : null;

  // Show the base-unit equivalent when the line unit differs (e.g. "2.5 ml = 0.0025 L").
  const converted =
    row.base_unit && row.unit && normalizeUnit(row.unit) !== normalizeUnit(row.base_unit) && row.qty > 0
      ? convertQuantity(row.qty, row.unit, row.base_unit)
      : null;

  // Unit dropdown options for this line's dimension; keep a custom typed value selectable.
  const unitOpts = unitOptionsForBase(row.base_unit || row.unit);
  const hasCurrent = unitOpts.some((o) => o.value === normalizeUnit(row.unit));
  const options = hasCurrent || !row.unit ? unitOpts : [{ value: normalizeUnit(row.unit), label: row.unit }, ...unitOpts];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_72px_84px_64px_104px_100px_36px] gap-2 items-end py-3 border-b border-border last:border-0">
      {/* Ingredient search — full width on mobile, first column on desktop */}
      <div className="col-span-2 lg:col-span-1 min-w-0">
        <label className="text-xs text-muted-foreground mb-1 block lg:hidden">Ingredient</label>
        <ItemSearchInput
          orgSlug={orgSlug}
          value={row.ingredient_name}
          placeholder="Search ingredient…"
          fixedDropdown
          onSelect={(item) => {
            // The ingredient's own base/stock unit — cost is expressed per this unit and the
            // line qty is converted back to it before submission.
            const baseUnit = item.unit_id
              ? units?.find((u) => u.id === item.unit_id)?.abbreviation
              : undefined;
            const nextUnit = row.unit_touched && row.unit ? row.unit : (baseUnit ?? row.unit);
            onChange(index, {
              ...row,
              ingredient_name: item.name,
              ingredient_sku:  item.sku,
              base_unit: baseUnit ?? row.base_unit,
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
          step="any"
          inputMode="decimal"
          value={qtyText}
          onChange={(e) => {
            setQtyText(e.target.value);
            const n = parseFloat(e.target.value);
            set('qty', Number.isNaN(n) ? 0 : n);
          }}
          className="h-8 text-sm"
          placeholder="0"
        />
      </div>

      {/* Unit — selectable; lists units compatible with the ingredient's base unit */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
        <select
          value={normalizeUnit(row.unit)}
          onChange={(e) => onChange(index, { ...row, unit: e.target.value, unit_touched: true })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
          title={row.base_unit ? `Stocked in ${row.base_unit}. Pick a smaller/other unit for this line — it's converted back to ${row.base_unit} on save.` : 'Unit for this ingredient line.'}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
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
        <label className="text-xs text-muted-foreground mb-1 block">EP Cost{row.base_unit ? `/${row.base_unit}` : ''}</label>
        <Input
          type="number"
          min={0}
          step={0.0001}
          inputMode="decimal"
          value={row.cost_price ?? ''}
          onChange={(e) => set('cost_price', e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
          className="h-8 text-sm"
          placeholder="0.00"
        />
      </div>

      {/* Line cost (read-only) */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Line</label>
        <div
          className="h-8 flex items-center text-xs font-mono text-muted-foreground px-1 tabular-nums"
          title={converted != null ? `${row.qty} ${row.unit} = ${converted} ${row.base_unit} × cost` : undefined}
        >
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
