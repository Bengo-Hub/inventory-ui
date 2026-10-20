'use client';

// Warning banner shown on the dashboard, catalog, recipes and stock pages whenever Recipe Health
// has open problems. One cached summary request is shared by every page (useRecipeHealthSummary);
// "Review now" opens the Recipe Health page on the largest problem. Dismissable per session.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { useRecipeHealthSummary } from '@/hooks/use-recipe-health';
import { RECIPE_HEALTH_ISSUES, type RecipeHealthIssue } from '@/lib/api/recipe-health';
import { useRecipeScope } from '@/hooks/use-recipe-scope';

const DISMISS_KEY = 'recipe-health-banner-dismissed';

export function RecipeHealthBanner({ orgSlug, className }: { orgSlug: string; className?: string }) {
  // Without recipes (a pure retail tenant) only the stock problem applies, worded for a shop.
  const scope = useRecipeScope(orgSlug);
  const enabled = scope.stockHealth;
  const { data } = useRecipeHealthSummary(orgSlug, enabled);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!enabled || dismissed || !data) return null;

  const counts = data.counts;
  const issues = scope.usesRecipes ? RECIPE_HEALTH_ISSUES : RECIPE_HEALTH_ISSUES.filter((it) => it.key === 'frequent_stock_outs');
  if (issues.reduce((sum, it) => sum + (counts[it.key] ?? 0), 0) <= 0) return null;
  const worst = issues.reduce<RecipeHealthIssue>(
    (best, it) => ((counts[it.key] ?? 0) > (counts[best] ?? 0) ? it.key : best),
    issues[0].key,
  );
  const parts = issues.filter((it) => (counts[it.key] ?? 0) > 0).map(
    (it) => `${counts[it.key]} ${it.label.toLowerCase()}`,
  );
  const missing = scope.usesRecipes ? counts.missing_bom ?? 0 : 0;
  const stockOuts = counts.frequent_stock_outs ?? 0;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 ${className ?? ''}`}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">
          {missing > 0
            ? `${missing} recipe item${missing === 1 ? ' has' : 's have'} no ingredients configured, so their sales are not deducting stock.`
            : !scope.usesRecipes
              ? `${stockOuts} item${stockOuts === 1 ? ' has' : 's have'} run out three or more times in the last 30 days.`
              : 'Some items have data problems that make stock or recipe costs wrong.'}
        </p>
        <p className="text-xs opacity-80 mt-0.5">
          {scope.usesRecipes ? parts.join(' · ') : 'Check that deliveries are received in the system and that each item’s unit matches how it is counted.'}
        </p>
      </div>
      <Link
        href={`/${orgSlug}/recipes/health?issue=${worst}`}
        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
      >
        Review now
      </Link>
      <button
        type="button"
        aria-label="Dismiss for this session"
        className="shrink-0 rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(DISMISS_KEY, '1');
          } catch {
            /* storage unavailable: dismiss for this render only */
          }
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
