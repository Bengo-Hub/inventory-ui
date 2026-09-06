'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { SubscriptionGate } from '@/components/subscription/subscription-gate';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { useAgingStock, useStartClearance } from '@/hooks/useStockClearance';
import { useInventorySettings } from '@/hooks/useInventorySettings';
import { usePermissions, P } from '@/hooks/usePermissions';
import { useSubscription } from '@/hooks/use-subscription';
import type { AgingStockRow } from '@/lib/api/stock-clearance';
import { AlertTriangle, Clock, ExternalLink, Settings, Tag, Zap, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const KES = (n?: number | null) =>
  n == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(n);

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : '—');

function AgingStockContent({ org }: { org: string }) {
  const { data: settings, isLoading: settingsLoading } = useInventorySettings(org);
  const enabled = settings?.batch_period_pricing_enabled ?? false;
  const { data, isLoading, isError, refetch } = useAgingStock(org, enabled);
  const startClearance = useStartClearance(org);
  const { canAny } = usePermissions();
  const canManage = canAny([P.CATALOG_CHANGE, P.CATALOG_MANAGE]);
  const { hasFeature } = useSubscription();
  const flashSaleAvailable = hasFeature('flash_sale');
  const posDiscountsUrl = `${process.env.NEXT_PUBLIC_POS_UI_URL ?? 'https://pos.codevertexafrica.com'}/${org}/sell/discounts`;

  const [clearing, setClearing] = useState<AgingStockRow | null>(null);
  const [markdownPrice, setMarkdownPrice] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');

  if (settingsLoading) return null;

  if (!enabled) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Tag className="h-6 w-6" /> Aging Stock</h1>
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Stock-age / batch markdown pricing isn&apos;t switched on for this tenant yet.
            </p>
            <Link href={`/${org}/settings?tab=stock`} className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline">
              <Settings className="h-4 w-4" /> Turn it on in Settings
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = data?.items ?? [];

  function openClearance(row: AgingStockRow) {
    setClearing(row);
    setMarkdownPrice('');
    setEndsAt('');
    setNotes('');
  }

  function submitClearance() {
    if (!clearing) return;
    const price = parseFloat(markdownPrice);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Enter a valid markdown price');
      return;
    }
    if (price >= clearing.current_price) {
      toast.error('Markdown price should be lower than the current price');
      return;
    }
    startClearance.mutate(
      {
        itemId: clearing.item_id,
        input: {
          markdown_price: price,
          reference_before: clearing.oldest_received_at,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          notes: notes.trim() || undefined,
        },
      },
      { onSuccess: () => setClearing(null) },
    );
  }

  const columns: DataTableColumn<AgingStockRow>[] = [
    { key: 'name', header: 'Item', primary: true, accessor: (r) => r.name, cellClassName: 'font-medium' },
    { key: 'sku', header: 'SKU', accessor: (r) => r.sku, cellClassName: 'font-mono text-muted-foreground' },
    { key: 'current_price', header: 'Current Price', align: 'right', accessor: (r) => r.current_price, render: (r) => KES(r.current_price) },
    { key: 'age', header: 'Oldest Stock Age', accessor: (r) => r.age_days, render: (r) => `${r.age_days} days (${fmtDate(r.oldest_received_at)})` },
    { key: 'aged_quantity', header: 'Aged Qty', align: 'right', accessor: (r) => r.aged_quantity, render: (r) => r.aged_quantity.toLocaleString() },
    {
      key: 'actions',
      header: '',
      render: (r) => canManage && (
        <Button size="sm" variant="outline" onClick={() => openClearance(r)}>
          <Tag className="h-3.5 w-3.5 mr-1.5" /> Start Clearance
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Tag className="h-6 w-6" /> Aging Stock</h1>
        <p className="text-muted-foreground mt-1">
          Items whose oldest received stock is past your configured age threshold ({data?.threshold_days ?? '—'} days) and not already on clearance.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-2 pb-2">
            <DataTable<AgingStockRow>
              columns={columns}
              rows={rows}
              rowKey={(r) => r.item_id}
              loading={isLoading}
              loadingRows={6}
              error={isError}
              onRetry={() => refetch()}
              emptyState={
                <>
                  <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No aging stock right now — nothing exceeds your threshold.</p>
                </>
              }
            />
          </div>
        </CardContent>
      </Card>

      {clearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setClearing(null)} />
          <div className="relative z-50 w-full max-w-md mx-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Start Clearance</h2>
                  <button onClick={() => setClearing(null)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{clearing.name} ({clearing.sku})</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Markdown price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">KES</span>
                    <Input type="number" step="0.01" className="pl-10" placeholder={String(clearing.current_price)} value={markdownPrice} onChange={(e) => setMarkdownPrice(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground">Current price is {KES(clearing.current_price)}.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ends on (optional)</label>
                  <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Leave blank to let it run until the old stock sells out, whichever comes first.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. clearing pre-restock stock" />
                </div>
                {flashSaleAvailable && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                    <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">
                      Want this old stock to also show as a timed flash sale on your online store? This
                      clearance is POS-only — create a matching Flash Sale discount for{' '}
                      <span className="font-medium text-foreground">{clearing.sku}</span> in{' '}
                      <a
                        href={posDiscountsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Sell → Discounts <ExternalLink className="h-3 w-3" />
                      </a>
                      {' '}using the same markdown price.
                    </p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setClearing(null)}>Cancel</Button>
                  <Button type="button" className="flex-1" onClick={submitClearance} disabled={startClearance.isPending}>
                    {startClearance.isPending ? 'Starting…' : 'Start Clearance'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgingStockPage() {
  const params = useParams();
  const org = params?.orgSlug as string;
  return (
    <SubscriptionGate feature="batch_period_pricing">
      <AgingStockContent org={org} />
    </SubscriptionGate>
  );
}
