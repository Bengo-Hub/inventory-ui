'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, History, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@/components/ui/base';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { SearchableCombobox } from '@bengo-hub/shared-ui-lib/combobox';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { DocFormatMenu } from '@/components/inventory/DocFormatMenu';
import { downloadBlob } from '@/components/inventory/ExportDialogs';
import { useItemStockHistory } from '@/hooks/useStock';
import { useWarehouses } from '@/hooks/useWarehouses';
import { stockApi } from '@/lib/api/stock';
import type { StockMovementRow } from '@/lib/api/stock';
import { apiErrorMessage } from '@/lib/api/error-message';

const MOVEMENT_TYPE_OPTIONS: { value: StockMovementRow['type']; label: string }[] = [
  { value: 'opening_stock', label: 'Opening Stock' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'sale', label: 'Sold' },
  { value: 'sell_return', label: 'Sell Return' },
  { value: 'purchase_return', label: 'Purchase Return' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'adjustment', label: 'Adjustment' },
];

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

/**
 * Stock History — the Go-Digital-style per-item ledger, as a standalone page (not a modal):
 * quantities-in/out summary cards + a unified, filterable, paginated movement table
 * (opening stock, purchases, sales, returns, transfers, adjustments), with warehouse/date/
 * movement-type filters and branded PDF/CSV/XLSX export. Reached from the Stock and Catalog
 * pages' per-row history button/link.
 */
export default function StockHistoryPage() {
  const params = useParams<{ orgSlug: string; sku: string }>();
  const router = useRouter();
  const orgSlug = params?.orgSlug ?? '';
  const sku = decodeURIComponent(params?.sku ?? '');

  const [warehouseId, setWarehouseId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data: warehouses } = useWarehouses(orgSlug);

  const queryParams = {
    ...(warehouseId ? { warehouse_id: warehouseId } : {}),
    ...(movementType ? { type: movementType } : {}),
    ...(range.from ? { date_from: range.from } : {}),
    ...(range.to ? { date_to: range.to } : {}),
    page,
    limit: pageSize,
  };

  const { data, isLoading, isError, isFetching, refetch } = useItemStockHistory(orgSlug, sku, queryParams);

  const qty = (n: number | undefined) =>
    (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const unit = data?.item.unit_abbreviation ? ` ${data.item.unit_abbreviation}` : '';
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  function patchFilters(patch: { warehouseId?: string; movementType?: string; range?: DateRange }) {
    if (patch.warehouseId !== undefined) setWarehouseId(patch.warehouseId);
    if (patch.movementType !== undefined) setMovementType(patch.movementType);
    if (patch.range !== undefined) setRange(patch.range);
    setPage(1);
  }

  // Branded PDF/CSV/XLSX export — same filters as the on-screen ledger, streamed from
  // inventory-api's docs report engine (mirrors adjustments/page.tsx's previewAdjustment).
  const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
  const exportParams = { ...queryParams, page: undefined, limit: undefined };
  function exportHistory(format: 'pdf' | 'csv' | 'xlsx') {
    const fileName = `stock-history-${data?.item.sku ?? sku}.${format}`;
    if (format === 'pdf') {
      openPreview(() => stockApi.exportItemHistoryDoc(orgSlug, sku, { ...exportParams, format }), { fileName, title: fileName });
      return;
    }
    stockApi.exportItemHistoryDoc(orgSlug, sku, { ...exportParams, format })
      .then((blob) => downloadBlob(blob, fileName))
      .catch(async (e) => toast.error(await apiErrorMessage(e, 'Could not export stock history')));
  }

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
        render: (r) => (
          <div>
            <div>{new Date(r.occurred_at).toLocaleString()}</div>
            {r.entered_at && (
              <div className="text-[10px] text-amber-600" title={`Entered ${new Date(r.entered_at).toLocaleString()}`}>
                entered {new Date(r.entered_at).toLocaleDateString()}
              </div>
            )}
          </div>
        ),
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
      {
        // Who performed the movement — cashier on a sale, the user who posted an adjustment,
        // received a purchase, or initiated a transfer. Critical for auditing who did what.
        key: 'actor_name',
        header: 'User',
        accessor: (r) => r.actor_name,
        hideBelow: 'lg',
        render: (r) => r.actor_name || <span className="text-muted-foreground">—</span>,
      },
    ],
    // qty is stable enough (pure formatter); TYPE_BADGE is constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const summary = data?.summary;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            Product stock history — {data?.item.name ?? sku}
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            <span className="font-mono">{data?.item.sku ?? sku}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DocFormatMenu label="Export" onSelect={exportHistory} />
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters — location, movement type, date range */}
      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
          <label className="text-[11px] font-semibold text-muted-foreground">Location
            <CreatableSelect
              value={warehouseId}
              onChange={(v) => patchFilters({ warehouseId: v })}
              options={(warehouses ?? []).map((wh) => ({ id: wh.id, name: wh.name }))}
              placeholder="All Locations"
            />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">Movement Type
            <SearchableCombobox
              className="mt-0.5"
              options={MOVEMENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={movementType}
              onChange={(v) => patchFilters({ movementType: v })}
              placeholder="All Types"
              clearable
            />
          </label>
          <div className="text-[11px] font-semibold text-muted-foreground">Date Range
            <DateRangePicker value={range} onChange={(r) => patchFilters({ range: r })} className="mt-0.5" />
          </div>
        </CardContent>
      </Card>

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
        storageKey="stock-history-page"
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
      />

      <PdfPreview {...previewProps} />
    </div>
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
