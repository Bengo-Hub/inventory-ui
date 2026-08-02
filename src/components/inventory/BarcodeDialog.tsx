'use client';

import { useEffect } from 'react';
import { barcodeApi } from '@/lib/api/barcode';
import type { Item } from '@/lib/api/items';
import { toast } from 'sonner';
import { useDocumentPreview, PdfPreview } from '@bengo-hub/shared-ui-lib/documents';
import { apiErrorMessage } from '@/lib/api/error-message';
import { getLabelPrintPrefs, type LabelPrintPrefs } from '@/lib/inventory/label-print-prefs';
import { blobToHex, printRawToLocalName } from '@/lib/inventory/print-agent';

/**
 * BarcodeDialog — quick single-item label print. Reuses the SAME format/template/rotate/printer
 * prefs the bulk "Print Labels" dialog last saved (see lib/inventory/label-print-prefs.ts) so a
 * quick single-item print always matches the physical label roll the tenant actually prints
 * on — calling the endpoint bare (no template/rotate) was the bug: it silently defaulted to an
 * un-rotated 4x2 template regardless of what the bulk job had been configured/fixed to use.
 *
 * ALWAYS opens a preview before anything reaches the printer: format=avery_a4 previews that PDF
 * directly; format=thermal_zpl/thermal_tspl previews via format=thermal_preview (a PDF rendered
 * from the EXACT same template/rotation as the real printer-command job, not a raw-bytes
 * download the operator can't otherwise inspect). If a printer is remembered, the preview is
 * followed by a toast offering a one-click "Send to printer" action.
 */
export function BarcodeDialog({
  orgSlug,
  item,
  onClose,
}: {
  orgSlug: string;
  item: Item;
  onClose: () => void;
}) {
  const { openPreview, previewProps } = useDocumentPreview({
    onError: async (m: string) => { toast.error(m); onClose(); },
  });

  useEffect(() => {
    const prefs = getLabelPrintPrefs();
    const isThermal = prefs.format === 'thermal_zpl' || prefs.format === 'thermal_tspl';
    const previewOpts = isThermal ? { ...prefs, format: 'thermal_preview' as const } : prefs;

    void openPreview(() => barcodeApi.itemLabelPdf(orgSlug, item.id, previewOpts), {
      fileName: `${item.sku}-label.pdf`,
      title: `Barcode · ${item.sku}`,
    }).then(() => {
      if (isThermal && prefs.printerName) {
        toast('Preview opened', {
          description: `Send directly to ${prefs.printerName} via USB?`,
          action: {
            label: 'Send to printer',
            onClick: () => void sendToAgent(prefs),
          },
        });
      }
    }).catch(async (e: unknown) => {
      toast.error(await apiErrorMessage(e, 'Failed to generate barcode label'));
      onClose();
    });

    async function sendToAgent(p: LabelPrintPrefs) {
      if (!p.printerName) return;
      try {
        const blob = await barcodeApi.itemLabelPdf(orgSlug, item.id, p);
        const hex = await blobToHex(blob);
        const ok = await printRawToLocalName(p.printerName, hex);
        if (ok) toast.success(`Sent to ${p.printerName}`);
        else toast.error('Local print agent rejected the job');
      } catch (e) {
        toast.error(await apiErrorMessage(e, 'Failed to print via local agent'));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, item.id]);

  return (
    <PdfPreview
      {...previewProps}
      onOpenChange={(open) => {
        previewProps.onOpenChange(open);
        if (!open) onClose();
      }}
    />
  );
}
