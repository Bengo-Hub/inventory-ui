'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, CardContent, CardHeader, Table } from '@/components/ui/base';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import {
  useIngredientUtilizationByRecipe,
  useIngredientUtilizationSummary,
  useIngredientUtilizationTimeseries,
} from '@/hooks/useReports';
import { itemsApi } from '@/lib/api/items';
import { reportsApi, type UtilizationGranularity } from '@/lib/api/reports';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { UtilizationChart } from './_components/UtilizationChart';

function formatNumber(v: number, decimals = 2): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(v);
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

const GRANULARITY_OPTIONS: { value: UtilizationGranularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'biweek', label: 'Biweekly' },
  { value: 'month', label: 'Month' },
];

const RANGE_PRESETS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

// Ingredients live under item type GOODS (retail/inventory raw stock) or the dedicated
// INGREDIENT type — both are fetched and merged rather than adding a new backend filter
// value, since itemsApi.list already supports type-scoped search.
function useIngredientOptions(orgSlug: string, search: string) {
  const goods = useQuery({
    queryKey: ['ingredient-picker', orgSlug, 'GOODS', search],
    queryFn: () => itemsApi.list(orgSlug, { type: 'GOODS', search: search || undefined, limit: 50 }),
    enabled: !!orgSlug,
    staleTime: 60_000,
  });
  const ingredients = useQuery({
    queryKey: ['ingredient-picker', orgSlug, 'INGREDIENT', search],
    queryFn: () => itemsApi.list(orgSlug, { type: 'INGREDIENT', search: search || undefined, limit: 50 }),
    enabled: !!orgSlug,
    staleTime: 60_000,
  });
  const options = useMemo(() => {
    const merged = [...(goods.data?.data ?? []), ...(ingredients.data?.data ?? [])];
    const seen = new Set<string>();
    return merged
      .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((it) => ({ id: it.id, name: `${it.name} (${it.sku})` }));
  }, [goods.data, ingredients.data]);
  return { options, isLoading: goods.isLoading || ingredients.isLoading };
}

export default function IngredientUtilizationPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const active = useActiveWarehouse(orgSlug);

  const [itemSearch, setItemSearch] = useState('');
  const [itemId, setItemId] = useState('');
  const [rangeDays, setRangeDays] = useState(30);
  const [granularity, setGranularity] = useState<UtilizationGranularity>('day');
  const [excludedRecipes, setExcludedRecipes] = useState<Set<string>>(new Set());

  const { options: itemOptions, isLoading: itemsLoading } = useIngredientOptions(orgSlug, itemSearch);

  const now = new Date();
  const from = toISO(new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000));
  const to = toISO(now);
  const warehouseId = active.warehouseId;

  const baseParams = { item_id: itemId, warehouse_id: warehouseId, from, to };
  const summary = useIngredientUtilizationSummary(orgSlug, baseParams);
  const timeseries = useIngredientUtilizationTimeseries(orgSlug, { ...baseParams, granularity });
  const byRecipe = useIngredientUtilizationByRecipe(orgSlug, baseParams);

  const ready = !!itemId && !!warehouseId;
  const s = summary.data;

  function toggleRecipe(name: string) {
    setExcludedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const filteredPoints = useMemo(() => {
    if (!timeseries.data || excludedRecipes.size === 0) return timeseries.data?.points ?? [];
    return timeseries.data.points.map((p) => ({
      ...p,
      by_recipe: p.by_recipe.filter((r) => !excludedRecipes.has(r.recipe_name || 'Direct sale')),
    }));
  }, [timeseries.data, excludedRecipes]);

  const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
  function printReport() {
    openPreview(() => reportsApi.ingredientUtilizationDoc(orgSlug, { ...baseParams, format: 'pdf' }), {
      fileName: `ingredient-utilization-${itemId}-${from}_${to}.pdf`,
      title: 'Ingredient Utilization',
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Ingredient Utilization</h1>
          <p className="text-sm text-muted-foreground mt-1">
            How much of an ingredient was consumed, by which recipe, relative to its reorder level
          </p>
        </div>
        {ready && (
          <Button variant="outline" onClick={printReport}>
            <Printer className="h-4 w-4 mr-2" /> Print / Export
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ingredient</label>
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search ingredient by name…"
                className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm mb-2 focus:ring-1 focus:ring-ring focus:outline-none"
              />
              <CreatableSelect
                value={itemId}
                onChange={setItemId}
                options={itemOptions}
                placeholder={itemsLoading ? 'Loading…' : 'Select an ingredient…'}
                disabled={itemsLoading}
              />
            </div>
            <ActiveWarehousePicker active={active} required />
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Range</span>
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setRangeDays(p.days)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    rangeDays === p.days ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Bucket</span>
              {GRANULARITY_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGranularity(g.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    granularity === g.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {!ready ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Pick an ingredient and warehouse to see its utilization.
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Purchased', value: s ? `${formatNumber(s.purchased_qty)} ${s.unit ?? ''}` : '—' },
              { label: 'Consumed', value: s ? `${formatNumber(s.consumed_qty)} ${s.unit ?? ''}` : '—' },
              { label: 'On Hand', value: s ? `${formatNumber(s.on_hand)} ${s.unit ?? ''}` : '—' },
              { label: 'Reorder Level', value: s ? formatNumber(s.reorder_level, 0) : '—' },
              {
                label: 'Days of Cover',
                value: s?.projected_days_of_cover != null ? formatNumber(s.projected_days_of_cover, 1) : '—',
              },
              {
                label: 'Last Restock',
                value: s?.last_restock_at ? new Date(s.last_restock_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—',
              },
            ].map((tile) => (
              <Card key={tile.label}>
                <CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{tile.label}</p>
                  <p className="text-lg font-bold tabular-nums">{summary.isLoading ? '…' : tile.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {s && (
            <p className="text-xs text-muted-foreground -mt-3">
              {formatCurrency(s.purchased_cost)} purchased · {formatCurrency(s.consumed_cost)} consumed, in this period
            </p>
          )}

          {/* Trend chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-semibold">Consumption by recipe</h2>
                {byRecipe.data && byRecipe.data.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {byRecipe.data.map((r) => {
                      const name = r.recipe_name || 'Direct sale';
                      const excluded = excludedRecipes.has(name);
                      return (
                        <button
                          key={name}
                          onClick={() => toggleRecipe(name)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            excluded
                              ? 'border-border text-muted-foreground line-through opacity-60'
                              : 'border-primary/40 bg-primary/10 text-primary'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <UtilizationChart
                points={filteredPoints}
                events={timeseries.data?.stock_level_events ?? []}
                granularity={granularity}
                rangeStart={from}
                rangeEnd={to}
                unit={s?.unit}
                loading={timeseries.isLoading}
              />
            </CardContent>
          </Card>

          {/* Recipe breakdown table */}
          <Card>
            <CardHeader>
              <span className="text-sm text-muted-foreground">
                {byRecipe.data?.length ?? 0} recipe{(byRecipe.data?.length ?? 0) !== 1 ? 's' : ''}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {byRecipe.isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
              ) : !byRecipe.data || byRecipe.data.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  No recipes consumed this ingredient in the selected period.
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <th className="px-6 py-3">Recipe</th>
                      <th className="px-6 py-3 text-right">Quantity</th>
                      <th className="px-6 py-3 text-right">Cost</th>
                      <th className="px-6 py-3 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {byRecipe.data.map((row) => (
                      <tr key={row.recipe_id ?? row.recipe_name} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium">{row.recipe_name || 'Direct sale'}</div>
                          {row.recipe_sku && <div className="text-xs text-muted-foreground">{row.recipe_sku}</div>}
                        </td>
                        <td className="px-6 py-4 text-right text-sm tabular-nums">
                          {formatNumber(row.quantity)} {s?.unit}
                        </td>
                        <td className="px-6 py-4 text-right text-sm tabular-nums">{formatCurrency(row.cost)}</td>
                        <td className="px-6 py-4 text-right">
                          <Badge variant="outline">{formatNumber(row.pct_of_total, 1)}%</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <PdfPreview {...previewProps} />
    </div>
  );
}
