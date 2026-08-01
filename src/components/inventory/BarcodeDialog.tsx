'use client';

import { useEffect } from 'react';
import { barcodeApi } from '@/lib/api/barcode';
import type { Item } from '@/lib/api/items';
import { toast } from 'sonner';
import { useDocumentPreview, PdfPreview } from '@bengo-hub/shared-ui-lib/documents';
import { apiErrorMessage } from '@/lib/api/error-message';
import { getLabelPrintPrefs } from '@/lib/inventory/label-print-prefs';
import { blobToHex, printRawToLocalName } from '@/lib/inventory/print-agent';

/**
 * BarcodeDialog — quick single-item label print. Reuses the SAME format/template/rotate/printer
 * prefs the bulk "Print Labels" dialog last saved (see lib/inventory/label-print-prefs.ts) so a
 * quick single-item print always matches the physical label roll the tenant actually prints
 * on — calling the endpoint bare (no template/rotate) was the bug: it silently defaulted to an
 * un-rotated 4x2 template regardless of what the bulk job had been configured/fixed to use.
 *
 * format=avery_a4 (the default until a thermal format is chosen at least once) previews the PDF
 * as before. format=thermal_zpl/thermal_tspl isn't a previewable PDF — if a printer was
 * remembered and the local print-agent is reachable, sends it straight there (no dialog at all);
 * otherwise downloads the printer-command text so the print job is never silently lost.
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

    if (!isThermal) {
      void openPreview(() => barcodeApi.itemLabelPdf(orgSlug, item.id, prefs), {
        fileName: `${item.sku}-label.pdf`,
        title: `Barcode · ${item.sku}`,
      }).catch(async (e: unknown) => {
        toast.error(await apiErrorMessage(e, 'Failed to generate barcode label'));
        onClose();
      });
      return;
    }

    void (async () => {
      try {
        const blob = await barcodeApi.itemLabelPdf(orgSlug, item.id, prefs);
        if (prefs.printerName) {
          const hex = await blobToHex(blob);
          const ok = await printRawToLocalName(prefs.printerName, hex);
          if (ok) {
            toast.success(`Sent to ${prefs.printerName}`);
            onClose();
            return;
          }
          toast.error('Local print agent rejected the job — downloading instead');
        }
        const ext = prefs.format === 'thermal_zpl' ? 'zpl' : 'tspl';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.sku}-label.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        onClose();
      } catch (e) {
        toast.error(await apiErrorMessage(e, 'Failed to generate barcode label'));
        onClose();
      }
    })();
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
