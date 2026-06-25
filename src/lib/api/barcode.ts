import { apiClient } from './client';

// Output formats supported by the bulk label-print job (mirrors inventory-api barcode module).
export type LabelFormat = 'avery_a4' | 'thermal_zpl' | 'dymo';

// PrintLabelsRequest — selection (exactly one of category/supplier/PO/item_ids), per-item
// quantity, output format, and optional lot/serial/price toggles.
export interface PrintLabelsRequest {
  category_id?: string;
  supplier_id?: string;
  purchase_order_id?: string;
  item_ids?: string[];

  qty_per_item?: number;
  quantities?: Record<string, number>;

  format: LabelFormat;

  include_lot?: boolean;
  include_serial?: boolean;
  include_price?: boolean;

  price_decimals?: number;
  currency?: string;
}

export const barcodeApi = {
  // URL of a single item's barcode PNG (use directly as <img src>). The endpoint lazily
  // generates + stores an internal EAN-13 if the item has no barcode yet.
  itemBarcodePngUrl: (orgSlug: string, itemId: string) =>
    `${apiClient.baseUrl}/api/v1/${orgSlug}/inventory/items/${itemId}/barcode.png`,

  // Fetch the item barcode PNG as a Blob (auth/tenant headers attached by the interceptor).
  itemBarcodePng: (orgSlug: string, itemId: string): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/items/${itemId}/barcode.png`),

  // Run a bulk label-print job → returns a Blob (PDF for avery_a4, text for zpl/dymo).
  printLabels: (orgSlug: string, body: PrintLabelsRequest): Promise<Blob> =>
    apiClient.postBlob(`/api/v1/${orgSlug}/inventory/labels/print`, body),
};
