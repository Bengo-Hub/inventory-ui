'use client';

import { Input } from '@/components/ui/base';
import { ItemSearchInput } from './ItemSearchInput';
import { convertQuantity, convertToStockUnit, costPerBaseUnit, normalizeUnit, unitOptionsForBase } from '@/lib/units/convert';
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
  cost_price?:     number; // EP cost per BASE unit — derived from the cost basis; used for costing
  /** True once the user manually edits the unit, so an ingredient re-pick won't overwrite it. */
  unit_touched?:   boolean;
  /** The ingredient's own stock/base unit abbreviation (e.g. "L"). The line unit may differ
   *  (e.g. "ml"); qty is converted to this base unit before costing and submission. */
  base_unit?:      string;
  /** Content-per-unit bridge from the picked item (a 750 ml bottle stocked in pieces →
   *  750 + 'ml'): lets a ml/g line cost + deduct fractional stock units (tots/pours). */
  unit_content_qty?: number | null;
  unit_content_uom?: string | null;
  /** Cost basis as the user expressed it: `cost_entered` buys `cost_basis_qty` of
   *  `cost_basis_unit` (e.g. 52.50 per 500 ml packet). cost_price above is always the
   *  derived per-base-unit figure — never the raw pack price. */
  cost_entered?:    number;
  cost_basis_qty?:  number;
  cost_basis_unit?: string;
}

// Shared desktop grid template for the recipe table (header + rows must match).
// Both variants are complete literal class strings so Tailwind's static scanner
// picks them up — never build these with string interpolation.
export const RECIPE_GRID_HEADER =
  'grid-cols-[minmax(0,1fr)_64px_80px_56px_150px_92px_36px]';
export const RECIPE_GRID_ROW =
  'lg:grid-cols-[minmax(0,1fr)_64px_80px_56px_150px_92px_36px]';

/** The unit costing is expressed against: the ingredient's stock unit, or the line unit
 *  for a brand-new (auto-created) ingredient which will be stored in the line unit. */
function effectiveBaseUnit(row: IngredientRowValue): string {
  return row.base_unit || row.unit;
}

/** Recompute the per-base-unit cost_price from the row's cost basis (pack price ÷ pack
 *  size in base units). Falls back to the raw entered price when nothing is derivable. */
export function withDerivedCost(row: IngredientRowValue): IngredientRowValue {
  if (row.cost_entered == null) return { ...row, cost_price: undefined };
  const derived = costPerBaseUnit(
    row.cost_entered,
    row.cost_basis_qty,
    row.cost_basis_unit,
    effectiveBaseUnit(row),
  );
  return { ...row, cost_price: derived ?? row.cost_entered };
}

/**
 * Convert a recipe line to the ingredient's base unit for submission/costing.
 * e.g. 2.5 ml against a base of L → { qty: 0.0025, unit: "L" }. Content-bridged lines
 * (30 ml of a bottle stocked in pieces) submit AS ENTERED — the API stores the line in
 * ml and converts through unit_content at deduction time, keeping the recipe readable.
 * Falls back to the entered values when there's no base unit or the units aren't
 * convertible (the API's write-time guard rejects truly unbridgeable lines).
 */
export function ingredientLineForSubmit(row: IngredientRowValue): { qty: number; unit: string } {
  if (row.base_unit && row.unit) {
    const conv = convertQuantity(row.qty, row.unit, row.base_unit);
    if (conv != null) return { qty: conv, unit: row.base_unit };
  }
  return { qty: row.qty, unit: row.unit };
}

/** Whether this line can never deduct stock: cross-dimension against the item's stock
 *  unit with no content-per-unit bridge. Mirrors the API's write-time guard so the UI
 *  can warn before the 422. */
export function lineUnitMismatch(row: IngredientRowValue): boolean {
  if (!row.base_unit || !row.unit) return false;
  return (
    convertToStockUnit(
      { base_unit: row.base_unit, unit_content_qty: row.unit_content_qty, unit_content_uom: row.unit_content_uom },
      row.qty || 1,
      row.unit,
    ) == null
  );
}

/**
 * Cost fields for the composite submit. cost_price is always the per-base-unit EP cost;
 * when the user priced a pack (e.g. 52.50 per 500 ml) the purchase fields carry that
 * pack so the ingredient item records how it is actually bought and the API's
 * resolveEPCost stays consistent (purchase_price / purchase_pack_size = cost_price).
 */
export function ingredientCostForSubmit(row: IngredientRowValue): {
  cost_price?:         number;
  purchase_price?:     number;
  purchase_pack_size?: number;
  purchase_unit?:      string;
} {
  const out: ReturnType<typeof ingredientCostForSubmit> = {};
  if (row.cost_price != null) out.cost_price = row.cost_price;
  if (row.cost_entered != null) {
    const base = effectiveBaseUnit(row);
    const basisQty = row.cost_basis_qty && row.cost_basis_qty > 0 ? row.cost_basis_qty : 1;
    const basisUnit = row.cost_basis_unit || base;
    const packInBase = convertQuantity(basisQty, basisUnit, base);
    if (packInBase != null && packInBase > 0) {
      out.purchase_price     = row.cost_entered;
      out.purchase_pack_size = packInBase;
      out.purchase_unit      = basisQty === 1 && normalizeUnit(basisUnit) === normalizeUnit(base)
        ? basisUnit
        : `${basisQty} ${basisUnit}`;
    }
  }
  return out;
}

/** qty of this line expressed in its base/stock unit (for live line/batch cost).
 *  Includes the content-per-unit bridge so a 30 ml tot line against a 750 ml/pc bottle
 *  costs 0.04 × the per-piece cost. */
function qtyInBaseUnit(row: IngredientRowValue): number {
  if (row.base_unit && row.unit) {
    const conv = convertToStockUnit(
      { base_unit: row.base_unit, unit_content_qty: row.unit_content_qty, unit_content_uom: row.unit_content_uom },
      row.qty,
      row.unit,
    );
    if (conv != null) return conv;
  }
  return row.qty;
}

/**
 * Live cost of one recipe line: qty (in base units) × EP cost per base unit × waste.
 * Single source of truth for the row's Line column AND the batch/food-cost totals,
 * so a line written in ml against a per-litre cost totals identically everywhere.
 */
export function recipeLineCost(row: IngredientRowValue): number | null {
  const baseQty = qtyInBaseUnit(row);
  if (!(baseQty > 0) || !((row.cost_price ?? 0) > 0)) return null;
  return baseQty * (row.cost_price ?? 0) * (1 + (row.waste_percent ?? 0) / 100);
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
    onChange(index, withDerivedCost({ ...row, [key]: val }));
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

  const lineCost = recipeLineCost(row);

  // Show the base-unit equivalent when the line unit differs (e.g. "2.5 ml = 0.0025 L").
  const converted =
    row.base_unit && row.unit && normalizeUnit(row.unit) !== normalizeUnit(row.base_unit) && row.qty > 0
      ? convertQuantity(row.qty, row.unit, row.base_unit)
      : null;

  // Unit dropdown options for this line's dimension; keep a custom typed value selectable.
  // Content-bridged items (750 ml/pc bottles) additionally offer the content dimension's
  // units so a tot/pour line can be written in ml against a piece-stocked bottle.
  const unitOpts = unitOptionsForBase(row.base_unit || row.unit);
  const bridged = !!(row.unit_content_qty && row.unit_content_qty > 0 && row.unit_content_uom);
  const bridgeOpts = bridged ? unitOptionsForBase(row.unit_content_uom) : [];
  const mergedOpts = [...unitOpts, ...bridgeOpts.filter((b) => !unitOpts.some((o) => o.value === b.value))];
  const hasCurrent = mergedOpts.some((o) => o.value === normalizeUnit(row.unit));
  const options = hasCurrent || !row.unit ? mergedOpts : [{ value: normalizeUnit(row.unit), label: row.unit }, ...mergedOpts];
  // Cross-dimension with no bridge: the API rejects it and stock could never deduct.
  const mismatch = row.ingredient_sku ? lineUnitMismatch(row) : false;

  // Cost-basis controls: "52.50 per 500 ml". Defaults to per-1-base-unit, matching the
  // old plain EP-cost behavior when the user never touches the basis fields.
  const baseUnit = effectiveBaseUnit(row);
  const basisQty = row.cost_basis_qty ?? 1;
  const basisUnit = row.cost_basis_unit || baseUnit;
  const basisOpts = unitOptionsForBase(baseUnit);
  const basisHasCurrent = basisOpts.some((o) => o.value === normalizeUnit(basisUnit));
  const basisOptions = basisHasCurrent || !basisUnit
    ? basisOpts
    : [{ value: normalizeUnit(basisUnit), label: basisUnit }, ...basisOpts];
  const derivedPerBase =
    row.cost_entered != null
      ? costPerBaseUnit(row.cost_entered, basisQty, basisUnit, baseUnit)
      : null;
  const basisIsPack = basisQty !== 1 || normalizeUnit(basisUnit) !== normalizeUnit(baseUnit);

  return (
    <div className={`grid grid-cols-2 ${RECIPE_GRID_ROW} gap-2 items-end py-3 border-b border-border last:border-0`}>
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
            const baseAbbr = item.unit_id
              ? units?.find((u) => u.id === item.unit_id)?.abbreviation
              : undefined;
            const nextUnit = row.unit_touched && row.unit ? row.unit : (baseAbbr ?? row.unit);
            const nextBase = baseAbbr ?? row.base_unit;
            // Prefill the cost basis from the item. Prefer the purchase pack (how it's
            // actually bought — e.g. 52.50 per 500 ml) so the pack price is never mistaken
            // for a per-base-unit cost; fall back to the stored per-base-unit EP cost.
            const hasPack =
              item.purchase_price != null &&
              item.purchase_pack_size != null &&
              item.purchase_pack_size > 0;
            const next: IngredientRowValue = {
              ...row,
              ingredient_name: item.name,
              ingredient_sku:  item.sku,
              base_unit: nextBase,
              unit: nextUnit,
              unit_content_qty: item.unit_content_qty ?? null,
              unit_content_uom: item.unit_content_uom ?? null,
              cost_entered: hasPack
                ? item.purchase_price ?? undefined
                : item.cost_price ?? row.cost_entered,
              // purchase_pack_size is stored in base units per pack.
              cost_basis_qty:  hasPack ? item.purchase_pack_size ?? 1 : 1,
              cost_basis_unit: nextBase || nextUnit,
            };
            onChange(index, withDerivedCost(next));
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
          onChange={(e) => onChange(index, withDerivedCost({ ...row, unit: e.target.value, unit_touched: true }))}
          className={`h-8 w-full rounded-lg border bg-transparent px-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none ${mismatch ? 'border-destructive text-destructive' : 'border-input'}`}
          title={
            mismatch
              ? `"${row.ingredient_name}" is stocked in ${row.base_unit} — a ${row.unit} line can't deduct stock. Use a prepared ingredient, declare the item's content per unit (e.g. 750 ml/bottle), or change the unit.`
              : bridged
                ? `Stocked in ${row.base_unit} (${row.unit_content_qty} ${row.unit_content_uom} each). A ${row.unit_content_uom}-family line deducts fractional ${row.base_unit}.`
                : row.base_unit
                  ? `Stocked in ${row.base_unit}. Pick a smaller/other unit for this line — it's converted back to ${row.base_unit} on save.`
                  : 'Unit for this ingredient line.'
          }
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {mismatch && (
          <p className="text-[10px] text-destructive leading-tight mt-0.5">
            Can’t deduct {row.unit} from {row.base_unit} stock
          </p>
        )}
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

      {/* EP cost basis — "price per qty unit", e.g. 52.50 per 500 ml. Derived per-base-unit
          cost feeds the Line column and submission; the raw pack price is never used as-is. */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">EP Cost</label>
        <div className="space-y-1">
          <Input
            type="number"
            min={0}
            step={0.0001}
            inputMode="decimal"
            value={row.cost_entered ?? ''}
            onChange={(e) => set('cost_entered', e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
            className="h-8 text-sm"
            placeholder="0.00"
            title="What you pay for the amount specified below (e.g. 52.50 for a 500 ml packet)."
          />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground shrink-0">per</span>
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={row.cost_basis_qty ?? 1}
              onChange={(e) => set('cost_basis_qty', e.target.value === '' ? 1 : parseFloat(e.target.value) || 1)}
              className="h-6 w-12 px-1 text-xs"
              title="Pack/basis size the price above buys (e.g. 500 for a 500 ml packet)."
            />
            <select
              value={normalizeUnit(basisUnit)}
              onChange={(e) => set('cost_basis_unit', e.target.value)}
              className="h-6 min-w-0 flex-1 rounded border border-input bg-transparent px-1 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
              title="Unit of the pack/basis size."
            >
              {basisOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.value}</option>
              ))}
            </select>
          </div>
          {basisIsPack && derivedPerBase != null && (
            <p className="text-[10px] text-muted-foreground tabular-nums leading-tight">
              = {derivedPerBase.toFixed(4).replace(/\.?0+$/, '')}/{baseUnit || basisUnit}
            </p>
          )}
        </div>
      </div>

      {/* Line cost (read-only) */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Line</label>
        <div
          className="h-8 flex items-center text-xs font-mono text-muted-foreground px-1 tabular-nums"
          title={converted != null ? `${row.qty} ${row.unit} = ${converted} ${row.base_unit} × cost/${row.base_unit}` : undefined}
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
