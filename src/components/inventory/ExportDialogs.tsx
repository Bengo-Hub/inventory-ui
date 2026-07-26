'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui/base';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { useCategories } from '@/hooks/useCategories';
import { useOutlets } from '@/hooks/useRBAC';
import { useWarehouses, useWarehouseLocations } from '@/hooks/useWarehouses';
import { itemsApi, type ProductsExportParams } from '@/lib/api/items';
import { stockApi, type StockExportParams } from '@/lib/api/stock';

const selectCls =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-ring focus:outline-none';
const labelCls = 'text-xs font-medium text-muted-foreground mb-1 block';

function DownloadCsv(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Shared modal shell + format actions — the two export dialogs below only differ in filter fields. */
function ExportShell({
  title, onClose, children, onExport, exporting,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  onExport: (format: 'pdf' | 'csv') => void;
  exporting: 'pdf' | 'csv' | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md mx-4">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{title}</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">{children}</div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" disabled={!!exporting} onClick={() => onExport('csv')}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" /> {exporting === 'csv' ? 'Exporting…' : 'CSV'}
            </Button>
            <Button className="flex-1" disabled={!!exporting} onClick={() => onExport('pdf')}>
              <FileText className="h-4 w-4 mr-1.5" /> {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Export dialog for the Products (catalog) list — filters mirror ListItems + an outlet override. */
export function ProductsExportDialog({
  orgSlug, initial, onClose,
}: {
  orgSlug: string;
  initial?: Pick<ProductsExportParams, 'search' | 'category_id' | 'type' | 'status' | 'use_case'>;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'active');
  const [outletId, setOutletId] = useState('');
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const { data: categories } = useCategories(orgSlug);
  const { data: outlets } = useOutlets(orgSlug);
  const { openPreview, previewProps } = useDocumentPreview({ onError: (m) => toast.error(m) });

  function buildParams(format: 'pdf' | 'csv'): ProductsExportParams {
    return {
      format,
      ...(initial?.search ? { search: initial.search } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(type ? { type } : {}),
      status,
      ...(outletId ? { outlet_id: outletId } : {}),
      ...(groupByCategory ? { group_by: 'category' } : {}),
    };
  }

  async function handleExport(format: 'pdf' | 'csv') {
    setExporting(format);
    try {
      if (format === 'csv') {
        DownloadCsv(await itemsApi.exportDoc(orgSlug, buildParams('csv')), `products-${new Date().toISOString().slice(0, 10)}.csv`);
        onClose();
      } else {
        await openPreview(() => itemsApi.exportDoc(orgSlug, buildParams('pdf')), { fileName: 'products.pdf', title: 'Products Export', orientation: 'landscape' });
      }
    } catch {
      toast.error('Could not export products. Please try again.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <ExportShell title="Export Products" onClose={onClose} onExport={handleExport} exporting={exporting}>
        <div>
          <label className={labelCls}>Category</label>
          <select className={selectCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All Categories</option>
            {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select className={selectCls} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All Types</option>
            <option value="GOODS">Goods</option>
            <option value="SERVICE">Service</option>
            <option value="RECIPE">Recipe</option>
            <option value="INGREDIENT">Ingredient</option>
            <option value="EQUIPMENT">Equipment</option>
            <option value="VOUCHER">Voucher</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
        {(outlets?.length ?? 0) > 0 && (
          <div>
            <label className={labelCls}>Outlet</label>
            <select className={selectCls} value={outletId} onChange={(e) => setOutletId(e.target.value)}>
              <option value="">Current outlet scope</option>
              {(outlets ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={groupByCategory} onChange={(e) => setGroupByCategory(e.target.checked)} />
          Group by category
        </label>
      </ExportShell>
      <PdfPreview {...previewProps} />
    </>
  );
}

/** Export dialog for the Stock levels list — filters mirror ListStock plus warehouse/location drill-down. */
export function StockExportDialog({
  orgSlug, initial, onClose,
}: {
  orgSlug: string;
  initial?: Pick<StockExportParams, 'search' | 'category_id' | 'type' | 'low_stock' | 'out_of_stock'>;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const { data: categories } = useCategories(orgSlug);
  const { data: warehouses } = useWarehouses(orgSlug);
  const { data: locations } = useWarehouseLocations(orgSlug, warehouseId);
  const { data: outlets } = useOutlets(orgSlug);
  const { openPreview, previewProps } = useDocumentPreview({ onError: (m) => toast.error(m) });

  function buildParams(format: 'pdf' | 'csv'): StockExportParams {
    return {
      format,
      ...(initial?.search ? { search: initial.search } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(type ? { type } : {}),
      ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      ...(locationId ? { location_id: locationId } : {}),
      ...(!warehouseId && outletId ? { outlet_id: outletId } : {}),
      ...(initial?.low_stock ? { low_stock: true } : {}),
      ...(initial?.out_of_stock ? { out_of_stock: true } : {}),
      ...(groupByCategory ? { group_by: 'category' } : {}),
    };
  }

  async function handleExport(format: 'pdf' | 'csv') {
    setExporting(format);
    try {
      if (format === 'csv') {
        DownloadCsv(await stockApi.exportDoc(orgSlug, buildParams('csv')), `stock-levels-${new Date().toISOString().slice(0, 10)}.csv`);
        onClose();
      } else {
        await openPreview(() => stockApi.exportDoc(orgSlug, buildParams('pdf')), { fileName: 'stock-levels.pdf', title: 'Stock Levels Export', orientation: 'landscape' });
      }
    } catch {
      toast.error('Could not export stock levels. Please try again.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <ExportShell title="Export Stock Levels" onClose={onClose} onExport={handleExport} exporting={exporting}>
        <div>
          <label className={labelCls}>Warehouse</label>
          <select className={selectCls} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setLocationId(''); }}>
            <option value="">All Warehouses{(outlets?.length ?? 0) > 0 ? ' (current outlet scope)' : ''}</option>
            {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        {warehouseId && (locations?.length ?? 0) > 0 && (
          <div>
            <label className={labelCls}>Location</label>
            <select className={selectCls} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">All Locations</option>
              {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </select>
          </div>
        )}
        {!warehouseId && (outlets?.length ?? 0) > 0 && (
          <div>
            <label className={labelCls}>Outlet</label>
            <select className={selectCls} value={outletId} onChange={(e) => setOutletId(e.target.value)}>
              <option value="">Current outlet scope</option>
              {(outlets ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Category</label>
          <select className={selectCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All Categories</option>
            {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select className={selectCls} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All Types</option>
            <option value="GOODS">Goods</option>
            <option value="INGREDIENT">Ingredient</option>
            <option value="EQUIPMENT">Equipment</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={groupByCategory} onChange={(e) => setGroupByCategory(e.target.checked)} />
          Group by category
        </label>
      </ExportShell>
      <PdfPreview {...previewProps} />
    </>
  );
}

// Re-export the trigger icon so callers don't need a separate lucide import just for this button.
export { Download as ExportIcon };
