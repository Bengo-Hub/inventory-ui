'use client';

import { useEffect } from 'react';
import { barcodeApi } from '@/lib/api/barcode';
import type { Item } from '@/lib/api/items';
import { toast } from 'sonner';
import { useDocumentPreview, PdfPreview } from '@bengo-hub/shared-ui-lib/documents';
import { apiErrorMessage } from '@/lib/api/error-message';

/**
 * BarcodeDialog — quick single-item label print/preview. Fetches the same card-layout PDF
 * (title, SKU, barcode, human-readable text) the bulk "Print Labels" sheet uses per cell, via
 * `GET /items/{id}/label.pdf`, and previews it through the shared PdfPreview — replacing a
 * previous bespoke path that only showed the bare barcode PNG (no item details) and printed it
 * via a hand-rolled `window.open` + `<img onload=print>` hack. Centralizing on one PDF-preview
 * flow means every barcode print in this app (single item here, bulk sheet in
 * PrintLabelsDialog) goes through the same download/print/zoom UI.
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
    void openPreview(() => barcodeApi.itemLabelPdf(orgSlug, item.id), {
      fileName: `${item.sku}-label.pdf`,
      title: `Barcode · ${item.sku}`,
    }).catch(async (e: unknown) => {
      toast.error(await apiErrorMessage(e, 'Failed to generate barcode label'));
      onClose();
    });
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
