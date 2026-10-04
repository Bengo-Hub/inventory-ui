import { apiClient } from './client';

// Recipe Health: data problems that silently break stock or cost figures until fixed.
// Served by inventory-api GET /recipes/health(/summary) and POST /recipes/recompute-costs.

export type RecipeHealthIssue = 'missing_bom' | 'unconvertible_line' | 'cost_basis' | 'frequent_stock_outs';

export const RECIPE_HEALTH_ISSUES: { key: RecipeHealthIssue; label: string; help: string }[] = [
  {
    key: 'missing_bom',
    label: 'Missing ingredients',
    help: 'Recipe items with no ingredients configured. Their sales do not deduct any ingredient stock, so stock and food cost are wrong until ingredients are added.',
  },
  {
    key: 'unconvertible_line',
    label: 'Unit mismatches',
    help: 'Recipe lines whose unit cannot convert to the ingredient’s stock unit, so the line never deducts stock. Fix the line unit, or set the ingredient’s content per unit (for example 1 piece = 450 g), the same way tots draw from a bottle.',
  },
  {
    key: 'cost_basis',
    label: 'Wrong cost per unit',
    help: 'Ingredients whose cost per stock unit is far off their purchase price (for example a per-gram price on an item stocked in kg). This distorts every recipe cost and COGS figure that uses them.',
  },
  {
    key: 'frequent_stock_outs',
    label: 'Frequent stock-outs',
    help: 'Items that ran out three or more times in the last 30 days. Usually deliveries are not being received in the system, or the item’s unit does not match how it is counted.',
  },
];

export interface RecipeHealthRow {
  issue: RecipeHealthIssue;
  item_id: string;
  item_sku: string;
  item_name: string;
  item_type: string;
  recipe_id?: string;
  recipe_sku?: string;
  recipe_name?: string;
  detail: string;
  non_depleting: boolean;
}

export interface RecipeHealthSummary {
  counts: Record<RecipeHealthIssue, number>;
  total: number;
}

export interface RecipeHealthPage {
  data: RecipeHealthRow[];
  total: number;
  limit: number;
  offset: number;
}

export const recipeHealthApi = {
  summary: (orgSlug: string) =>
    apiClient.get<RecipeHealthSummary>(`/api/v1/${orgSlug}/inventory/recipes/health/summary`),
  list: (orgSlug: string, issue: RecipeHealthIssue, page: number, limit: number) =>
    apiClient.get<RecipeHealthPage>(`/api/v1/${orgSlug}/inventory/recipes/health`, {
      issue,
      limit,
      offset: (page - 1) * limit,
    }),
  recomputeAll: (orgSlug: string) =>
    apiClient.post<{ recomputed: number }>(`/api/v1/${orgSlug}/inventory/recipes/recompute-costs`, {}),
};
