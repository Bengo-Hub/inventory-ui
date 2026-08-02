'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui/base';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { barcodeApi, type LabelFormat, type LabelTemplateName, type PrintLabelsRequest } from '@/lib/api/barcode';
import { agentAvailable, blobToHex, listLocalPrinters, printRawToLocalName } from '@/lib/inventory/print-agent';
import { getLabelPrintPrefs, setLabelPrintPrefs } from '@/lib/inventory/label-print-prefs';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { Download, Printer, Usb, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { SearchableCombobox } from '@bengo-hub/shared-ui-lib/combobox';

type SelectionMode = 'category' | 'supplier' | 'purchase_order' | 'item_ids';

const FORMATS: { value: LabelFormat; label: string; hint: string }[] = [
  { value: 'avery_a4', label: 'Avery A4 sheet (PDF)', hint: 'Printable label-sheet PDF' },
  { value: 'thermal_zpl', label: 'Zebra thermal (ZPL)', hint: 'For genuine Zebra (or ZPL-emulation) printers' },
  { value: 'thermal_tspl', label: 'Xprinter thermal (TSPL)', hint: 'For Xprinter/TSC-compatible printers (e.g. Xprinter XP-330B)' },
  { value: 'dymo', label: 'DYMO label', hint: 'Download DYMO label text' },
];

const AVERY_SHEETS: { value: string; label: string }[] = [
  { value: 'l7160', label: 'Avery L7160 (A4, 21/sheet)' },
  { value: '5160', label: 'Avery 5160 (US Letter, 30/sheet)' },
];

// Thermal label-roll templates: "rows" = labels side-by-side across the roll's width (lanes), not
// the Avery sheet's grid rows. Sizes/gaps for the multi-row presets are engineering estimates —
// operators with different real stock should pick "Custom" and enter their roll's exact
// dimensions rather than assume one of these matches. See inventory-api/docs/barcode-labels.md.
const THERMAL_TEMPLATES: { value: LabelTemplateName; label: string; hint: string }[] = [
  { value: '2x1', label: '2" x 1" — 1 row', hint: 'Standard small barcode/SKU label' },
  { value: '3x2', label: '3" x 2" — 1 row', hint: 'Recommended for lot/serial GS1-128 codes' },
  { value: '4x2', label: '4" x 2" — 1 row (default)', hint: 'General-purpose item label' },
  { value: '4x6', label: '4" x 6" — 1 row', hint: 'Shipping-label size' },
  { value: '1row_40x30', label: '1 row — 40x30mm', hint: 'Single narrow lane, one label at a time down the roll' },
  { value: '2row_38x30', label: '2 rows — 38x30mm each', hint: 'Wider roll, 2 labels side by side' },
  { value: '3row_25x40', label: '3 rows — 25x40mm each', hint: 'Wider roll, 3 labels side by side' },
  { value: '4row_18x30', label: '4 rows — 18x30mm each', hint: 'Wider roll, 4 labels side by side' },
  { value: '1row_29x62', label: '1 row — 29x62mm (bench-verified)', hint: 'Confirmed by printing directly to an Xprinter XP-330B' },
  { value: 'custom', label: 'Custom…', hint: "Enter your roll's exact size/rows/gaps" },
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
  // Seeded from the last-saved label-print prefs (see lib/inventory/label-print-prefs.ts) so this
  // dialog and the single-item BarcodeDialog quick-print action stay on the SAME physical
  // template/rotate/format — otherwise a template fixed here for the bulk job wouldn't apply to
  // the quick single-item print, which is exactly the divergence that let a rotated-label bug
  // through even after the bulk path was fixed.
  const initialPrefs = useState(() => getLabelPrintPrefs())[0];
  const [format, setFormat] = useState<LabelFormat>(initialPrefs.format ?? 'avery_a4');
  const [sheet, setSheet] = useState('l7160');
  const [template, setTemplate] = useState<LabelTemplateName>(initialPrefs.template ?? '4x2');
  const [rotate, setRotate] = useState(initialPrefs.rotate ?? false);
  const [customW, setCustomW] = useState(initialPrefs.custom_label_w_in ?? 4);
  const [customH, setCustomH] = useState(initialPrefs.custom_label_h_in ?? 2);
  const [customLanes, setCustomLanes] = useState(initialPrefs.custom_lanes ?? 1);
  const [customGapX, setCustomGapX] = useState(initialPrefs.custom_gap_x_in ?? 0.08);
  const [customGapY, setCustomGapY] = useState(initialPrefs.custom_gap_y_in ?? 0.08);
  const [includeLot, setIncludeLot] = useState(false);
  const [includeSerial, setIncludeSerial] = useState(false);
  const [includePrice, setIncludePrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Direct USB printing via the local print-agent (see lib/inventory/print-agent.ts) — reuses
  // the same loopback agent pos-ui talks to, no separate install needed if it's already running.
  const [agentUp, setAgentUp] = useState(false);
  const [localPrinters, setLocalPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState(initialPrefs.printerName ?? '');
  const [agentPrinting, setAgentPrinting] = useState(false);
  const isThermal = format === 'thermal_zpl' || format === 'thermal_tspl';

  useEffect(() => {
    if (!isThermal) return;
    let cancelled = false;
    (async () => {
      const up = await agentAvailable();
      if (cancelled) return;
      setAgentUp(up);
      if (up) {
        const printers = await listLocalPrinters();
        if (!cancelled) {
          setLocalPrinters(printers);
          setSelectedPrinter((prev) => prev || printers[0] || '');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isThermal]);

  // Persist every choice so BarcodeDialog's single-item quick print reuses it.
  useEffect(() => {
    setLabelPrintPrefs({
      format, template, rotate,
      custom_label_w_in: customW, custom_label_h_in: customH, custom_lanes: customLanes,
      custom_gap_x_in: customGapX, custom_gap_y_in: customGapY,
      printerName: selectedPrinter,
    });
  }, [format, template, rotate, customW, customH, customLanes, customGapX, customGapY, selectedPrinter]);

  // Only offer categories that actually have items linked — picking an empty
  // category would otherwise fail server-side with EMPTY_SELECTION.
  const { data: categories } = useCategories(orgSlug, { hasItems: true });
  const suppliersQuery = useSuppliers(orgSlug, { limit: 200 });
  const suppliers = suppliersQuery.data?.data ?? [];
  const purchaseOrdersQuery = usePurchaseOrders(orgSlug, { limit: 100 });
  const purchaseOrders = purchaseOrdersQuery.data?.data ?? [];

  const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });

  function buildRequest(): PrintLabelsRequest | null {
    const base: PrintLabelsRequest = {
      format,
      qty_per_item: qty,
      ...(format === 'avery_a4' ? { sheet } : {}),
      ...(isThermal
        ? {
            template,
            rotate,
            ...(template === 'custom'
              ? {
                  custom_label_w_in: customW,
                  custom_label_h_in: customH,
                  custom_lanes: customLanes,
                  custom_gap_x_in: customGapX,
                  custom_gap_y_in: customGapY,
                }
              : {}),
          }
        : {}),
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
      if (isThermal) {
        // ALWAYS preview first — format=thermal_preview renders a PDF matching EXACTLY what the
        // real thermal_zpl/thermal_tspl job would print (same template, per-label pages,
        // rotation), NOT the unrelated Avery grid. Silently substituting that grid as a
        // "preview" for a thermal-roll job was misleading (labels got printed in columns on a
        // single-lane roll). Direct USB dispatch is a separate, explicit action — see
        // printViaAgent / the "Print via Local Agent" button.
        const blob = await barcodeApi.printLabels(orgSlug, { ...req, format: 'thermal_preview' });
        await openPreview(() => Promise.resolve(blob), { fileName: `labels-${Date.now()}.pdf`, title: 'Labels' });
      } else if (format === 'avery_a4') {
        // Preview the already-generated Avery PDF inline (reuses shared PdfPreview). Fetch the
        // blob up-front so any backend error (EMPTY_SELECTION / NO_LABELS …) is caught here and
        // shown verbatim, rather than being swallowed by the preview.
        const blob = await barcodeApi.printLabels(orgSlug, req);
        await openPreview(() => Promise.resolve(blob), {
          fileName: `labels-${Date.now()}.pdf`,
          title: 'Labels',
        });
      } else {
        // DYMO → download the printer text (this format is meant for a host-side DYMO bridge,
        // not direct-USB agent printing, so a download is the correct/only outcome here).
        const blob = await barcodeApi.printLabels(orgSlug, req);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `labels-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success('Labels generated');
      }
    } catch (err) {
      toast.error(await apiErrorMessage(err, 'Failed to generate labels'));
    } finally {
      setSubmitting(false);
    }
  }

  /** Print directly via USB through the local print-agent (bypasses the OS print dialog
   *  entirely — see lib/inventory/print-agent.ts and docs/barcode-labels.md). Only offered for
   *  thermal_zpl/thermal_tspl, since those are the formats that emit raw printer command bytes
   *  the agent's RAW-datatype spooler write can send straight to the printer. Unlike submit()'s
   *  fallback, this button is an explicit "force via agent" action, so it errors out (rather
   *  than silently falling back to a PDF) when nothing is picked/reachable. */
  async function printViaAgent() {
    const req = buildRequest();
    if (!req) {
      toast.error('Pick a selection first');
      return;
    }
    if (!selectedPrinter) {
      toast.error('Pick a printer first');
      return;
    }
    setAgentPrinting(true);
    try {
      const blob = await barcodeApi.printLabels(orgSlug, req);
      const hex = await blobToHex(blob);
      const ok = await printRawToLocalName(selectedPrinter, hex);
      if (ok) {
        toast.success(`Sent to ${selectedPrinter}`);
      } else {
        toast.error('Local print agent rejected the job — falling back to download');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `labels-${Date.now()}.${format === 'thermal_zpl' ? 'zpl' : 'tspl'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      toast.error(await apiErrorMessage(err, 'Failed to print via local agent'));
    } finally {
      setAgentPrinting(false);
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
                <SearchableCombobox
                  options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={categoryId}
                  onChange={(id) => setCategoryId(id)}
                  placeholder="Select a category…"
                  searchPlaceholder="Search categories…"
                />
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
                  {purchaseOrders.map((po) => (
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

            {/* Avery sheet preset (avery_a4 only) */}
            {format === 'avery_a4' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Sheet</p>
                {AVERY_SHEETS.map((s) => (
                  <label key={s.value} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-0.5"
                      checked={sheet === s.value}
                      onChange={() => setSheet(s.value)}
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Thermal label template (thermal_zpl / thermal_tspl) */}
            {isThermal && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Label template — &quot;rows&quot; are labels side-by-side across the roll&apos;s width
                </p>
                {THERMAL_TEMPLATES.map((t) => (
                  <label key={t.value} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-0.5"
                      checked={template === t.value}
                      onChange={() => setTemplate(t.value)}
                    />
                    <span>
                      {t.label}
                      <span className="block text-xs text-muted-foreground">{t.hint}</span>
                    </span>
                  </label>
                ))}

                {template === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pl-6 pt-1">
                    <label className="text-xs text-muted-foreground">
                      Label width (in)
                      <input
                        type="number" step="0.1" min={0.1} value={customW}
                        onChange={(e) => setCustomW(Number(e.target.value) || 0.1)}
                        className="mt-0.5 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Label height (in)
                      <input
                        type="number" step="0.1" min={0.1} value={customH}
                        onChange={(e) => setCustomH(Number(e.target.value) || 0.1)}
                        className="mt-0.5 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Rows (1-4)
                      <input
                        type="number" min={1} max={4} value={customLanes}
                        onChange={(e) => setCustomLanes(Math.min(4, Math.max(1, Number(e.target.value) || 1)))}
                        className="mt-0.5 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Gap between rows (in)
                      <input
                        type="number" step="0.01" min={0} value={customGapX}
                        onChange={(e) => setCustomGapX(Number(e.target.value) || 0)}
                        className="mt-0.5 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground col-span-2">
                      Gap between labels along the feed (in)
                      <input
                        type="number" step="0.01" min={0} value={customGapY}
                        onChange={(e) => setCustomGapY(Number(e.target.value) || 0)}
                        className="mt-0.5 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm pt-1">
                  <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} />
                  Rotate 90° (roll is mounted with the label&apos;s long edge along the feed)
                </label>

                {/* Direct USB printing via the local print-agent — see docs/barcode-labels.md */}
                <div className="rounded-lg border border-input p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Usb className="h-3.5 w-3.5" />
                    Direct USB printing
                  </div>
                  {agentUp ? (
                    localPrinters.length > 0 ? (
                      <>
                        <select
                          value={selectedPrinter}
                          onChange={(e) => setSelectedPrinter(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                        >
                          {localPrinters.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={printViaAgent}
                          disabled={agentPrinting}
                        >
                          <Usb className="h-4 w-4 mr-1.5" />
                          {agentPrinting ? 'Sending…' : `Print via Local Agent (${selectedPrinter})`}
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Print agent detected, but no installed printers found. Install the Xprinter driver so it appears in Windows first.
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Local print agent not detected on this machine. Install/start it to print directly via USB instead of downloading a file.
                    </p>
                  )}
                </div>
              </div>
            )}

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
                {isPdf || isThermal ? <Printer className="h-4 w-4 mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                {submitting ? 'Generating…' : isPdf || isThermal ? 'Preview PDF' : 'Download'}
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
