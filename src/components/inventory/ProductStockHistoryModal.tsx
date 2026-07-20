'use client';

import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { Badge } from '@/components/ui/base';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useItemStockHistory } from '@/hooks/useStock';
import { useWarehouses } from '@/hooks/useWarehouses';
import type { StockMovementRow } from '@/lib/api/stock';
import { History, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * ProductStockHistoryModal — THE centralized per-item stock ledger surface
 * (Go-Digital "Product stock history"): quantities-in / quantities-out summary
 * cards + a unified movement table (opening stock, purchases, sales, returns,
 * transfers, adjustments). Opened from the Stock Report tab's per-row button
 * and the stock drawer — always this one component, never a per-page copy.
 */
export function ProductStockHistoryModal({
  orgSlug,
  sku,
  onClose,
}: {
  orgSlug: string;
  sku: string;
  onClose: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data: warehouses } = useWarehouses(orgSlug);

  const { data, isLoading, isError, refetch } = useItemStockHistory(orgSlug, sku, {
    ...(warehouseId ? { warehouse_id: warehouseId } : {}),
    page,
    limit: pageSize,
  });

  const qty = (n: number | undefined) =>
    (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const unit = data?.item.unit_abbreviation ? ` ${data.item.unit_abbreviation}` : '';
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  const TYPE_BADGE: Record<StockMovementRow['type'], 'success' | 'error' | 'warning' | 'default' | 'outline'> = {
    opening_stock: 'default',
    purchase: 'success',
    sell_return: 'success',
    transfer_in: 'success',
    sale: 'error',
    purchase_return: 'error',
    transfer_out: 'error',
    adjustment: 'warning',
  };

  const columns = useMemo<DataTableColumn<StockMovementRow>[]>(
    () => [
      {
        key: 'label',
        header: 'Type',
        accessor: (r) => r.label,
        sortable: true,
        filterable: true,
        render: (r) => <Badge variant={TYPE_BADGE[r.type] ?? 'outline'}>{r.label}</Badge>,
      },
      {
        key: 'quantity_change',
        header: 'Quantity change',
        align: 'right',
        accessor: (r) => r.quantity_change,
        sortable: true,
        render: (r) => (
          <span className={`font-mono tabular-nums ${r.quantity_change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {r.quantity_change >= 0 ? '+' : ''}
            {qty(r.quantity_change)}
          </span>
        ),
      },
      {
        key: 'quantity_after',
        header: 'New quantity',
        align: 'right',
        accessor: (r) => r.quantity_after,
        render: (r) => (r.quantity_after != null ? <span className="font-mono tabular-nums">{qty(r.quantity_after)}</span> : '—'),
      },
      {
        key: 'occurred_at',
        header: 'Date',
        accessor: (r) => r.occurred_at,
        sortable: true,
        render: (r) => new Date(r.occurred_at).toLocaleString(),
      },
      { key: 'reference', header: 'Reference No', accessor: (r) => r.reference, filterable: true },
      {
        key: 'warehouse_name',
        header: 'Location',
        accessor: (r) => r.warehouse_name,
        filterable: true,
        hideBelow: 'md',
      },
      {
        key: 'counterparty',
        header: 'Customer/Supplier',
        accessor: (r) => r.counterparty,
        hideBelow: 'lg',
      },
    ],
    // qty is stable enough (pure formatter); TYPE_BADGE is constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const summary = data?.summary;

  return (
    <Sheet open onClose={onClose} title={`Product stock history — ${data?.item.name ?? sku}`} width="lg">
      <SheetContent className="space-y-5">
        {/* Location filter (Go-Digital business-location selector) */}
        <div className="flex flex-wrap items-center gap-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">{data?.item.sku ?? sku}</span>
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
            className="ml-auto rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
            title="Business location"
          >
            <option value="">All Locations</option>
            {(warehouses ?? []).map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quantities In / Out / Totals cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Quantities In
            </p>
            <dl className="space-y-1.5 text-sm">
              <SummaryRow label="Opening Stock" value={`${qty(summary?.opening_stock)}${unit}`} />
              <SummaryRow label="Total Purchase" value={`${qty(summary?.total_purchased)}${unit}`} />
              <SummaryRow label="Total Sell Return" value={`${qty(summary?.total_sell_returns)}${unit}`} />
              <SummaryRow label="Stock Transfers (In)" value={`${qty(summary?.transfers_in)}${unit}`} />
            </dl>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              <TrendingDown className="h-3.5 w-3.5 text-red-600" /> Quantities Out
            </p>
            <dl className="space-y-1.5 text-sm">
              <SummaryRow label="Total Sold" value={`${qty(summary?.total_sold)}${unit}`} />
              <SummaryRow label="Total Purchase Return" value={`${qty(summary?.total_purchase_returns)}${unit}`} />
              <SummaryRow label="Stock Transfers (Out)" value={`${qty(summary?.transfers_out)}${unit}`} />
              <SummaryRow label="Net Adjustments" value={`${qty(summary?.total_adjusted)}${unit}`} />
            </dl>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Totals</p>
            <p className="text-[11px] text-muted-foreground">Current stock</p>
            <p className="text-2xl font-black text-primary tabular-nums">
              {qty(summary?.current_stock)}
              <span className="text-sm font-semibold">{unit}</span>
            </p>
          </div>
        </div>

        {/* Unified movement ledger */}
        <DataTable<StockMovementRow>
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(r) => `${r.type}-${r.occurred_at}-${r.reference ?? ''}-${r.quantity_change}`}
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          emptyText="No stock movements recorded yet"
          storageKey={`stock-history`}
          showExportCsv
          exportFileName={`stock-history-${data?.item.sku ?? sku}`}
          pageSize={pageSize}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={data?.total}
          dense
        />
      </SheetContent>
    </Sheet>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
