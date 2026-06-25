'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui/base';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { barcodeApi, type LabelFormat, type PrintLabelsRequest } from '@/lib/api/barcode';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { Download, Printer, X } from 'lucide-react';
import { toast } from 'sonner';

type SelectionMode = 'category' | 'supplier' | 'purchase_order' | 'item_ids';

const FORMATS: { value: LabelFormat; label: string; hint: string }[] = [
  { value: 'avery_a4', label: 'Avery A4 sheet (PDF)', hint: 'Printable label-sheet PDF' },
  { value: 'thermal_zpl', label: 'Zebra thermal (ZPL)', hint: 'Download ZPL for a Zebra printer' },
  { value: 'dymo', label: 'DYMO label', hint: 'Download DYMO label text' },
];

/**
 * PrintLabelsDialog — bulk label-print surface. Pick a selection (category / supplier /
 * purchase-order / preselected items), per-item quantity, an output format, and optional
 * lot/serial/price toggles. Avery PDFs are previewed inline via the shared PdfPreview
 * (same pattern as the PO page); ZPL/Dymo are downloaded as text.
 */
export function PrintLabelsDialog({
  orgSlug,
  presetItemIds,
  presetLabel,
  onClose,
}: {
  orgSlug: string;
  presetItemIds?: string[];
  presetLabel?: string;
  onClose: () => void;
}) {
  const hasPreset = !!presetItemIds && presetItemIds.length > 0;

  const [mode, setMode] = useState<SelectionMode>(hasPreset ? 'item_ids' : 'category');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [poId, setPoId] = useState('');
  const [qty, setQty] = useState(1);
  const [format, setFormat] = useState<LabelFormat>('avery_a4');
  const [includeLot, setIncludeLot] = useState(false);
  const [includeSerial, setIncludeSerial] = useState(false);
  const [includePrice, setIncludePrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: categories } = useCategories(orgSlug);
  const suppliersQuery = useSuppliers(orgSlug, { limit: 200 });
  const suppliers = suppliersQuery.data?.data ?? [];
  const { data: purchaseOrders } = usePurchaseOrders(orgSlug);

  const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });

  function buildRequest(): PrintLabelsRequest | null {
    const base: PrintLabelsRequest = {
      format,
      qty_per_item: qty,
      include_lot: includeLot,
      include_serial: includeSerial,
      include_price: includePrice,
    };
    if (hasPreset && mode === 'item_ids') return { ...base, item_ids: presetItemIds };
    switch (mode) {
      case 'category':
        if (!categoryId) return null;
        return { ...base, category_id: categoryId };
      case 'supplier':
        if (!supplierId) return null;
        return { ...base, supplier_id: supplierId };
      case 'purchase_order':
        if (!poId) return null;
        return { ...base, purchase_order_id: poId };
      case 'item_ids':
        if (!hasPreset) return null;
        return { ...base, item_ids: presetItemIds };
    }
  }

  async function submit() {
    const req = buildRequest();
    if (!req) {
      toast.error('Pick a selection first');
      return;
    }
    setSubmitting(true);
    try {
      if (format === 'avery_a4') {
        // Preview the Avery PDF inline (reuses shared PdfPreview).
        await openPreview(() => barcodeApi.printLabels(orgSlug, req), {
          fileName: `labels-${Date.now()}.pdf`,
          title: 'Labels',
        });
      } else {
        // Thermal/Dymo → download the printer text.
        const blob = await barcodeApi.printLabels(orgSlug, req);
        const ext = format === 'thermal_zpl' ? 'zpl' : 'txt';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `labels-${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success('Labels generated');
      }
    } catch {
      toast.error('Failed to generate labels');
    } finally {
      setSubmitting(false);
    }
  }

  const isPdf = format === 'avery_a4';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Print Labels</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Selection */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Selection</p>
              {hasPreset && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={mode === 'item_ids'} onChange={() => setMode('item_ids')} />
                  Selected items{presetLabel ? ` (${presetLabel})` : ` (${presetItemIds!.length})`}
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === 'category'} onChange={() => setMode('category')} />
                By category
              </label>
              {mode === 'category' && (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                >
                  <option value="">Select a category…</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === 'supplier'} onChange={() => setMode('supplier')} />
                By supplier
              </label>
              {mode === 'supplier' && (
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                >
                  <option value="">Select a supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === 'purchase_order'} onChange={() => setMode('purchase_order')} />
                By purchase order
              </label>
              {mode === 'purchase_order' && (
                <select
                  value={poId}
                  onChange={(e) => setPoId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                >
                  <option value="">Select a purchase order…</option>
                  {(purchaseOrders ?? []).map((po) => (
                    <option key={po.id} value={po.id}>{po.po_number}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Labels per item</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
              />
            </div>

            {/* Format */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Format</p>
              {FORMATS.map((f) => (
                <label key={f.value} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-0.5"
                    checked={format === f.value}
                    onChange={() => setFormat(f.value)}
                  />
                  <span>
                    {f.label}
                    <span className="block text-xs text-muted-foreground">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* Lot / serial / price toggles */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Label content</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeLot}
                  onChange={(e) => { setIncludeLot(e.target.checked); if (e.target.checked) setIncludeSerial(false); }}
                />
                Lot/batch labels (GS1-128: batch + expiry, one per active lot)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeSerial}
                  onChange={(e) => { setIncludeSerial(e.target.checked); if (e.target.checked) setIncludeLot(false); }}
                />
                Serial labels (GS1-128: serial number, one per available serial)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includePrice} onChange={(e) => setIncludePrice(e.target.checked)} />
                Include price
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={submit} disabled={submitting}>
                {isPdf ? <Printer className="h-4 w-4 mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                {submitting ? 'Generating…' : isPdf ? 'Preview PDF' : 'Download'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Avery PDF preview (reuses shared-ui-lib previewer) */}
      <PdfPreview {...previewProps} />
    </>
  );
}
