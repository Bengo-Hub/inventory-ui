'use client';

/** Budget visualisation for recipe costing.
 * Shows the food-cost % against the target with a colour-coded status bar. */

interface Props {
  sellingPrice: number;
  batchCost:    number;
  servings?:    number;
  targetFcPct?: number; // default 0.35 (35%)
}

function statusInfo(fcPct: number, target: number) {
  if (fcPct >= 1)        return { label: 'Loss — cost ≥ price',        color: 'bg-red-600',   text: 'text-red-600'   };
  if (fcPct > target)    return { label: 'Above target FC%',           color: 'bg-amber-500', text: 'text-amber-600' };
  return                        { label: 'Healthy',                    color: 'bg-emerald-500', text: 'text-emerald-600' };
}

export function FoodCostBudgetBar({ sellingPrice, batchCost, servings = 1, targetFcPct = 0.35 }: Props) {
  if (!sellingPrice || sellingPrice <= 0) return null;

  const costPerServing = servings > 0 ? batchCost / servings : batchCost;
  const fcPct          = costPerServing / sellingPrice;
  const maxBudget      = sellingPrice * servings * targetFcPct;
  const barWidth       = Math.min(100, Math.round(fcPct / targetFcPct * 100));
  const info           = statusInfo(fcPct, targetFcPct);

  const fmt = (v: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(v);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          Max batch cost at {Math.round(targetFcPct * 100)}% FC target:
          <span className="ml-1 font-semibold text-foreground">{fmt(maxBudget)}</span>
        </span>
        <span className={`font-semibold ${info.text}`}>
          {(fcPct * 100).toFixed(1)}% — {info.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${info.color}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-muted-foreground">
        <span>Current batch cost: <span className="font-medium text-foreground">{fmt(batchCost)}</span></span>
        <span>Cost/serving: <span className="font-medium text-foreground">{fmt(costPerServing)}</span></span>
      </div>
    </div>
  );
}
