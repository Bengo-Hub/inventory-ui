// Variant matrix helpers for the item form. Pure functions, no React.
//
// A variant is its own child item. These helpers mirror inventory-api's
// modules/items/variant_children.go so the form shows what the server will save: axis names
// are lower case, axes are ordered alphabetically, the first axis varies slowest, names read
// "Red / M" and the default SKU is PARENTSKU-RED-M.

import type { ItemVariant, SaveVariantRow, VariantAxes } from '@/lib/api/items';

/** Axis names offered as one-click suggestions. Any other name can be typed. */
export const SUGGESTED_AXES = ['size', 'colour'] as const;

/** Above this many combinations the form asks for fewer values instead of saving. */
export const MAX_VARIANT_ROWS = 200;

export type VariantAttributes = Record<string, string>;

/** Editable state of one combination. id is set once a child item exists. */
export interface VariantRowState {
  id?: string;
  sku: string;
  barcode: string;
  price: string;
  isActive: boolean;
  onHand?: number | null;
}

export function normalizeAxisName(name: string): string {
  return name.trim().toLowerCase();
}

/** Axis names in the server's order (alphabetical). */
export function axisOrder(axes: Record<string, unknown>): string[] {
  return Object.keys(axes).sort();
}

/** Identifies a combination regardless of key order or letter case. */
export function comboKey(attrs: VariantAttributes): string {
  return Object.entries(attrs)
    .map(([k, v]) => `${normalizeAxisName(k)}=${v.trim().toLowerCase()}`)
    .sort()
    .join('|');
}

/** "Red / M": values in axis order. */
export function comboLabel(attrs: VariantAttributes): string {
  return axisOrder(attrs).map((k) => attrs[k]).join(' / ');
}

/** The SKU the server builds when the row's SKU is left blank. */
export function defaultVariantSku(parentSku: string, attrs: VariantAttributes): string {
  const parts = axisOrder(attrs).map((k) => attrs[k].replace(/\s+/g, '').toUpperCase());
  return [parentSku, ...parts].join('-');
}

/** Axes that have at least one value; an axis with no values yet adds no combinations. */
export function usableAxes(axes: VariantAxes): VariantAxes {
  const out: VariantAxes = {};
  for (const [k, vals] of Object.entries(axes)) if (vals.length > 0) out[k] = vals;
  return out;
}

/** Every combination of the axes, first axis (alphabetical) varying slowest. */
export function combinations(axes: VariantAxes): VariantAttributes[] {
  const keys = axisOrder(usableAxes(axes));
  if (keys.length === 0) return [];
  let out: VariantAttributes[] = [{}];
  for (const k of keys) {
    const next: VariantAttributes[] = [];
    for (const partial of out) for (const v of axes[k]) next.push({ ...partial, [k]: v });
    out = next;
  }
  return out;
}

/** Number of combinations without building them. */
export function combinationCount(axes: VariantAxes): number {
  const vals = Object.values(usableAxes(axes));
  return vals.length === 0 ? 0 : vals.reduce((n, v) => n * v.length, 1);
}

/** Adds a value to an axis unless it is blank or already there (any letter case). */
export function addAxisValue(values: string[], raw: string): string[] {
  const v = raw.trim();
  if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) return values;
  return [...values, v];
}

/** Reads parent metadata.variant_axes with lower case axis names. */
export function axesFromMetadata(metadata?: Record<string, unknown>): VariantAxes {
  const raw = metadata?.variant_axes;
  if (!raw || typeof raw !== 'object') return {};
  const out: VariantAxes = {};
  for (const [k, vals] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(vals)) continue;
    const name = normalizeAxisName(k);
    if (!name) continue;
    out[name] = vals.reduce<string[]>((acc, v) => addAxisValue(acc, String(v)), out[name] ?? []);
  }
  return out;
}

/** Axes built from existing variants, for parents saved before variant_axes was stored. */
export function axesFromVariants(variants: ItemVariant[]): VariantAxes {
  const out: VariantAxes = {};
  for (const v of variants) {
    for (const [k, val] of Object.entries(v.attributes ?? {})) {
      const name = normalizeAxisName(k);
      if (name) out[name] = addAxisValue(out[name] ?? [], val);
    }
  }
  return out;
}

/** Existing variants keyed by combination, ready to edit. */
export function rowsFromVariants(variants: ItemVariant[]): Record<string, VariantRowState> {
  const out: Record<string, VariantRowState> = {};
  for (const v of variants) {
    if (!v.attributes || Object.keys(v.attributes).length === 0) continue;
    out[comboKey(v.attributes)] = {
      id: v.id,
      sku: v.sku ?? '',
      barcode: v.barcode ?? '',
      price: v.price > 0 ? String(v.price) : '',
      isActive: v.is_active,
      onHand: v.on_hand,
    };
  }
  return out;
}

/**
 * State of a combination that has no row yet. A combination made only of values that were
 * already saved, yet missing from the active variants, was switched off before, so it stays
 * off. One that uses a newly added value starts switched on.
 */
export function newRowState(attrs: VariantAttributes, savedAxes: VariantAxes): VariantRowState {
  const savedBefore = Object.keys(savedAxes).length > 0 && Object.entries(attrs).every(([k, v]) =>
    (savedAxes[k] ?? []).some((x) => x.toLowerCase() === v.toLowerCase()),
  );
  return { sku: '', barcode: '', price: '', isActive: !savedBefore };
}

/**
 * Request rows for PUT /items/{id}/variants. Active rows are sent; a switched off row is sent
 * only when its child exists (to deactivate it), so unticked new combinations are never
 * created. Returns the rows plus the combination each one stands for, so a "row N" error from
 * the server can be pointed at the right line.
 */
export function buildSaveRows(
  combos: VariantAttributes[],
  rows: Record<string, VariantRowState>,
  savedAxes: VariantAxes,
): { rows: SaveVariantRow[]; keys: string[] } {
  const out: SaveVariantRow[] = [];
  const keys: string[] = [];
  for (const attrs of combos) {
    const key = comboKey(attrs);
    const r = rows[key] ?? newRowState(attrs, savedAxes);
    if (!r.isActive && !r.id) continue;
    const row: SaveVariantRow = { attributes: attrs, is_active: r.isActive };
    if (r.sku.trim()) row.sku = r.sku.trim();
    if (r.barcode.trim()) row.barcode = r.barcode.trim();
    const price = r.price.trim() === '' ? NaN : Number(r.price);
    if (Number.isFinite(price)) row.price = price;
    out.push(row);
    keys.push(key);
  }
  return { rows: out, keys };
}

export interface VariantSaveError {
  message: string;
  /** Combination the error belongs to, when it can be told. */
  rowKey?: string;
}

/**
 * Turns an INVALID_VARIANTS or DUPLICATE_SKU response into a message that names the
 * combination ("Red / M: price cannot be negative") instead of the server's row number.
 */
export function describeVariantError(
  code: string | undefined,
  message: string,
  sent: { rows: SaveVariantRow[]; keys: string[] },
  parentSku: string,
): VariantSaveError {
  if (code === 'INVALID_VARIANTS') {
    const m = /^row (\d+):\s*(.*)$/i.exec(message);
    if (m) {
      const i = Number(m[1]) - 1;
      const row = sent.rows[i];
      if (row) return { message: `${comboLabel(row.attributes)}: ${m[2]}`, rowKey: sent.keys[i] };
    }
    return { message };
  }
  if (code === 'DUPLICATE_SKU') {
    const sku = /"([^"]+)"/.exec(message)?.[1];
    if (sku) {
      const i = sent.rows.findIndex((r) => (r.sku ?? defaultVariantSku(parentSku, r.attributes)).toLowerCase() === sku.toLowerCase());
      if (i >= 0) {
        return {
          message: `${comboLabel(sent.rows[i].attributes)}: SKU ${sku} is already used by another item. Choose a different SKU.`,
          rowKey: sent.keys[i],
        };
      }
      return { message: `SKU ${sku} is already used by another item. Choose a different SKU.` };
    }
  }
  return { message };
}
