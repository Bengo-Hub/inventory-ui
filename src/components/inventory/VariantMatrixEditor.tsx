'use client';

// Size / colour matrix for one parent item. Each ticked combination is saved as its own child
// item (own SKU, barcode, price and stock) with a single PUT /items/{id}/variants. The matrix
// logic lives in lib/inventory/variant-matrix.ts; this file is only the UI.

import { Button, Input } from '@/components/ui/base';
import { useSaveItemVariants } from '@/hooks/useItems';
import type { Item, ItemVariant, VariantAxes } from '@/lib/api/items';
import { apiErrorMessage } from '@/lib/api/error-message';
import {
  MAX_VARIANT_ROWS,
  SUGGESTED_AXES,
  addAxisValue,
  axisOrder,
  buildSaveRows,
  combinationCount,
  combinations,
  comboKey,
  comboLabel,
  defaultVariantSku,
  describeVariantError,
  newRowState,
  normalizeAxisName,
  rowsFromVariants,
  type VariantRowState,
  type VariantSaveError,
} from '@/lib/inventory/variant-matrix';
import { DECIMAL_STEP } from '@/lib/utils';
import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface Props {
  orgSlug: string;
  parent: Item;
  /** Axes saved on the parent (metadata.variant_axes, or derived from its variants). */
  savedAxes: VariantAxes;
  /** Active variants from GET /items/{id}/variants. */
  existing: ItemVariant[];
  canEdit: boolean;
}

const axisTitle = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export function VariantMatrixEditor({ orgSlug, parent, savedAxes, existing, canEdit }: Props) {
  const save = useSaveItemVariants(orgSlug, parent.id);
  const [axes, setAxes] = useState<VariantAxes>(savedAxes);
  // Axes as last saved; decides whether an untouched combination starts on or off.
  const [baseline, setBaseline] = useState<VariantAxes>(savedAxes);
  const [rows, setRows] = useState<Record<string, VariantRowState>>(() => rowsFromVariants(existing));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newAxis, setNewAxis] = useState('');
  const [error, setError] = useState<VariantSaveError | null>(null);

  const count = combinationCount(axes);
  const tooMany = count > MAX_VARIANT_ROWS;
  const combos = useMemo(() => (tooMany ? [] : combinations(axes)), [axes, tooMany]);
  const order = axisOrder(axes);
  const parentPrice = parent.selling_price ?? parent.max_selling_price ?? null;

  const rowFor = (attrs: Record<string, string>) => rows[comboKey(attrs)] ?? newRowState(attrs, baseline);
  const activeCount = combos.filter((c) => rowFor(c).isActive).length;
  const missingValues = order.filter((k) => axes[k].length === 0);
  const hasChildren = Object.values(rows).some((r) => !!r.id);

  function patchRow(attrs: Record<string, string>, patch: Partial<VariantRowState>) {
    const key = comboKey(attrs);
    setRows((prev) => ({ ...prev, [key]: { ...(prev[key] ?? newRowState(attrs, baseline)), ...patch } }));
    if (error?.rowKey === key) setError(null);
  }

  function addAxis(raw: string) {
    const name = normalizeAxisName(raw);
    if (!name || axes[name]) return;
    setAxes((prev) => ({ ...prev, [name]: [] }));
    setNewAxis('');
  }

  function removeAxis(name: string) {
    setAxes((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function commitDraft(name: string) {
    const raw = drafts[name] ?? '';
    // Several values can be pasted at once: "S, M, L".
    const values = raw.split(',').reduce((acc, v) => addAxisValue(acc, v), axes[name] ?? []);
    setAxes((prev) => ({ ...prev, [name]: values }));
    setDrafts((prev) => ({ ...prev, [name]: '' }));
  }

  function removeValue(name: string, value: string) {
    setAxes((prev) => ({ ...prev, [name]: prev[name].filter((v) => v !== value) }));
  }

  async function handleSave() {
    setError(null);
    const savedAxesNow = Object.fromEntries(order.filter((k) => axes[k].length > 0).map((k) => [k, axes[k]]));
    const sent = buildSaveRows(combos, rows, baseline);
    try {
      const result = await save.mutateAsync({ axes: savedAxesNow, rows: sent.rows });
      setRows(rowsFromVariants(result));
      setBaseline(savedAxesNow);
      setAxes(savedAxesNow);
      const active = result.filter((v) => v.is_active).length;
      toast.success(`Variants saved: ${active} active`);
    } catch (e) {
      const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const message = await apiErrorMessage(e, 'Could not save the variants');
      setError(describeVariantError(code, message, sent, parent.sku));
    }
  }

  return (
    <div className="space-y-4">
      {/* Axis editor */}
      <div className="space-y-3">
        {order.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add an option such as size or colour, then type its values. Every combination becomes its own
            product with its own SKU, barcode, price and stock.
          </p>
        )}
        {order.map((name) => (
          <div key={name} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{axisTitle(name)}</span>
              {canEdit && (
                <button type="button" onClick={() => removeAxis(name)} className="text-xs text-muted-foreground hover:text-destructive">
                  Remove
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {axes[name].map((v) => (
                <span key={v} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs">
                  {v}
                  {canEdit && (
                    <button type="button" aria-label={`Remove ${v}`} onClick={() => removeValue(name, v)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {canEdit && (
                <input
                  value={drafts[name] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [name]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitDraft(name); }
                    if (e.key === 'Backspace' && !(drafts[name] ?? '') && axes[name].length > 0) {
                      removeValue(name, axes[name][axes[name].length - 1]);
                    }
                  }}
                  onBlur={() => { if ((drafts[name] ?? '').trim()) commitDraft(name); }}
                  placeholder={name === 'size' ? 'Type a size, press Enter' : name === 'colour' ? 'Type a colour, press Enter' : 'Type a value, press Enter'}
                  className="min-w-40 flex-1 bg-transparent px-1 py-0.5 text-sm focus:outline-none placeholder:text-muted-foreground"
                />
              )}
            </div>
          </div>
        ))}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {SUGGESTED_AXES.filter((a) => !axes[a]).map((a) => (
              <Button key={a} type="button" variant="outline" size="sm" onClick={() => addAxis(a)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                {axisTitle(a)}
              </Button>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={newAxis}
                onChange={(e) => setNewAxis(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAxis(newAxis); } }}
                placeholder="Other option, e.g. material"
                className="h-8 w-56 py-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => addAxis(newAxis)} disabled={!newAxis.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}
      </div>

      {missingValues.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {missingValues.map(axisTitle).join(', ')} has no values yet, so it is left out of the combinations below.
        </p>
      )}
      {tooMany && (
        <p className="text-sm text-destructive">
          {count} combinations is more than {MAX_VARIANT_ROWS}. Remove some values to continue.
        </p>
      )}

      {/* Generated grid */}
      {combos.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Variant</th>
                <th className="px-2 py-2 text-left font-medium">SKU</th>
                <th className="px-2 py-2 text-left font-medium">Barcode</th>
                <th className="px-2 py-2 text-left font-medium">Price (KES)</th>
                <th className="px-2 py-2 text-right font-medium">On hand</th>
                <th className="px-3 py-2 text-center font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {combos.map((attrs) => {
                const key = comboKey(attrs);
                const r = rowFor(attrs);
                const flagged = error?.rowKey === key;
                return (
                  <tr key={key} className={flagged ? 'bg-destructive/10' : r.isActive ? undefined : 'opacity-60'}>
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{comboLabel(attrs)}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={r.sku}
                        onChange={(e) => patchRow(attrs, { sku: e.target.value })}
                        placeholder={defaultVariantSku(parent.sku, attrs)}
                        disabled={!canEdit}
                        className="h-8 min-w-36 px-2 py-1 font-mono text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={r.barcode}
                        onChange={(e) => patchRow(attrs, { barcode: e.target.value })}
                        placeholder="Optional"
                        disabled={!canEdit}
                        className="h-8 min-w-32 px-2 py-1 font-mono text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min="0"
                        step={DECIMAL_STEP}
                        inputMode="decimal"
                        value={r.price}
                        onChange={(e) => patchRow(attrs, { price: e.target.value })}
                        placeholder={parentPrice != null ? String(parentPrice) : 'Item price'}
                        disabled={!canEdit}
                        className="h-8 w-28 px-2 py-1 text-right"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {r.id ? (r.onHand ?? 0) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${comboLabel(attrs)} active`}
                        checked={r.isActive}
                        onChange={(e) => patchRow(attrs, { isActive: e.target.checked })}
                        disabled={!canEdit}
                        className="rounded"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {canEdit && (combos.length > 0 || hasChildren) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {combos.length > 0
              ? `${activeCount} of ${combos.length} combinations active. A blank SKU is generated, a blank price uses the item price. Unticked variants are deactivated, never deleted.`
              : 'Saving with no options deactivates every existing variant.'}
          </p>
          <Button type="button" size="sm" onClick={handleSave} disabled={save.isPending || tooMany}>
            {save.isPending ? 'Saving...' : 'Save variants'}
          </Button>
        </div>
      )}
    </div>
  );
}
