'use client';

// Recipe Health: every data problem that silently breaks stock levels or recipe costs (recipe
// items without ingredients, units that never convert, wrong cost per unit, items that keep
// running out), each with a direct fix action. The warning banner elsewhere links here.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Calculator, ChefHat, ExternalLink, Ban, Ruler, ShieldCheck } from 'lucide-react';
import { DataTable, type BulkAction, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  useRecipeHealth,
  useRecipeHealthBulkAction,
  useRecipeHealthSummary,
  useRecomputeAllRecipeCosts,
} from '@/hooks/use-recipe-health';
import { usePermissions, P } from '@/hooks/usePermissions';
import { RECIPE_HEALTH_ISSUES, type RecipeHealthIssue, type RecipeHealthRow } from '@/lib/api/recipe-health';
import type { BulkStatusAction } from '@/lib/api/items';
import { apiErrorMessage } from '@/lib/api/error-message';
import { cn } from '@/lib/utils';

function isIssue(v: string | null): v is RecipeHealthIssue {
  return !!v && RECIPE_HEALTH_ISSUES.some((i) => i.key === v);
}

export default function RecipeHealthPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const orgSlug = params?.orgSlug as string;
  const { can, canAny } = usePermissions();
  const canChange = can(P.CATALOG_CHANGE);
  const canRecompute = canAny(['inventory.recipes.change', P.CATALOG_MANAGE]);

  const initial = search?.get('issue') ?? null;
  const [issue, setIssue] = useState<RecipeHealthIssue>(isIssue(initial) ? initial : 'missing_bom');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ action: BulkStatusAction; ids: string[]; label: string } | null>(null);
  const [confirmRecompute, setConfirmRecompute] = useState(false);

  const summary = useRecipeHealthSummary(orgSlug);
  const list = useRecipeHealth(orgSlug, issue, page, pageSize);
  const bulk = useRecipeHealthBulkAction(orgSlug);
  const recompute = useRecomputeAllRecipeCosts(orgSlug);

  const rows = list.data?.data ?? [];
  const total = list.data?.total ?? 0;
  const meta = RECIPE_HEALTH_ISSUES.find((i) => i.key === issue)!;

  const switchIssue = (next: RecipeHealthIssue) => {
    setIssue(next);
    setPage(1);
    setSelected(new Set());
    router.replace(`/${orgSlug}/recipes/health?issue=${next}`, { scroll: false });
  };

  const runBulk = async (action: BulkStatusAction, ids: string[]) => {
    try {
      const res = await bulk.mutateAsync({ ids, action });
      const skipped = res.skipped?.length ?? 0;
      toast.success(`Updated ${res.processed} item${res.processed === 1 ? '' : 's'}${skipped ? `, ${skipped} already done` : ''}`);
      setSelected(new Set());
    } catch (e) {
      toast.error(await apiErrorMessage(e, 'Could not update the items'));
    }
  };

  const runRecompute = async () => {
    try {
      const res = await recompute.mutateAsync();
      toast.success(`Recalculated ${res.recomputed} recipe costs`);
    } catch (e) {
      toast.error(await apiErrorMessage(e, 'Could not recalculate recipe costs'));
    }
  };

  const columns = useMemo<DataTableColumn<RecipeHealthRow>[]>(() => [
    {
      key: 'item_name',
      header: 'Item',
      primary: true,
      accessor: (r) => r.item_name,
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{r.item_name}</p>
          <p className="text-xs text-muted-foreground font-mono">{r.item_sku}</p>
        </div>
      ),
    },
    {
      key: 'detail',
      header: 'Problem',
      accessor: (r) => r.detail,
      render: (r) => (
        <div className="text-sm text-muted-foreground max-w-xl">
          {r.recipe_name && r.recipe_name !== r.item_name && <p className="font-medium text-foreground">{r.recipe_name}</p>}
          <p>{r.detail}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (r) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {r.issue === 'missing_bom' && canChange && (
            <Link href={`/${orgSlug}/catalog/${r.item_id}/recipe`}>
              <Button size="sm"><ChefHat className="h-3.5 w-3.5 mr-1" />Add ingredients</Button>
            </Link>
          )}
          {r.issue === 'unconvertible_line' && r.recipe_id && canChange && (
            <Link href={`/${orgSlug}/recipes/${r.recipe_id}`}>
              <Button size="sm"><Ruler className="h-3.5 w-3.5 mr-1" />Fix recipe line</Button>
            </Link>
          )}
          {(r.issue === 'cost_basis' || r.issue === 'frequent_stock_outs') && canChange && (
            <Link href={`/${orgSlug}/catalog/${r.item_id}?edit=1`}>
              <Button size="sm"><Ruler className="h-3.5 w-3.5 mr-1" />Fix unit / cost</Button>
            </Link>
          )}
          {r.issue === 'missing_bom' && canChange && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirm({ action: 'not_for_sale_on', ids: [r.item_id], label: `Stop selling "${r.item_name}"?` })}
            >
              <Ban className="h-3.5 w-3.5 mr-1" />Not for sale
            </Button>
          )}
          <Link href={`/${orgSlug}/catalog/${r.item_id}`}>
            <Button size="sm" variant="ghost" aria-label="View item"><ExternalLink className="h-3.5 w-3.5" /></Button>
          </Link>
        </div>
      ),
    },
  ], [orgSlug, canChange]);

  const bulkActions: BulkAction[] = canChange
    ? [
        {
          key: 'not_for_sale',
          label: 'Mark not for sale',
          icon: <Ban className="h-3.5 w-3.5" />,
          onClick: (ids: string[]) => setConfirm({ action: 'not_for_sale_on', ids, label: `Stop selling ${ids.length} item(s)?` }),
        },
      ]
    : [];

  const counts = summary.data?.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />Recipe Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Problems that make stock levels or recipe costs wrong. Fix each one here; the list updates as you go.
          </p>
        </div>
        {canRecompute && (
          <Button variant="outline" onClick={() => setConfirmRecompute(true)} disabled={recompute.isPending}>
            <Calculator className="h-4 w-4 mr-2" />
            {recompute.isPending ? 'Recalculating…' : 'Recalculate all recipe costs'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {RECIPE_HEALTH_ISSUES.map((it) => {
          const n = counts?.[it.key];
          const active = it.key === issue;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => switchIssue(it.key)}
              className={cn(
                'text-left rounded-xl border p-4 transition-colors',
                active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">{it.label}</p>
              <p className={cn('text-2xl font-bold tabular-nums mt-1', n ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {n ?? '–'}
              </p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">{meta.label}</h2>
          <p className="text-sm text-muted-foreground">{meta.help}</p>
        </CardHeader>
        <CardContent>
          <DataTable<RecipeHealthRow>
            columns={columns}
            rows={rows}
            rowKey={(r) => `${r.item_id}:${r.recipe_id ?? ''}:${r.detail}`}
            loading={list.isLoading}
            loadingRows={6}
            error={list.isError}
            onRetry={() => list.refetch()}
            emptyText="Nothing to fix here."
            storageKey="recipe-health"
            selectable={canChange}
            selected={selected}
            onSelectedChange={setSelected}
            bulkActions={bulkActions}
            showExportCsv
            exportFileName={`recipe-health-${issue}`}
            page={page}
            totalPages={Math.max(1, Math.ceil(total / pageSize))}
            onPageChange={setPage}
            total={total}
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.label ?? ''}
        description="The item will be hidden from POS and the ordering app."
        confirmLabel="Confirm"
        onConfirm={async () => {
          if (confirm) await runBulk(confirm.action, confirm.ids);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirmRecompute}
        title="Recalculate all recipe costs?"
        description="Every recipe is recosted from current ingredient costs. New costs reach POS and the ledger for future sales."
        confirmLabel="Recalculate"
        onConfirm={async () => {
          setConfirmRecompute(false);
          await runRecompute();
        }}
        onCancel={() => setConfirmRecompute(false)}
      />
    </div>
  );
}
