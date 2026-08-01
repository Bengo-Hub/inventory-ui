import { apiClient } from './client';

// Output formats supported by the bulk label-print job (mirrors inventory-api barcode module).
export type LabelFormat = 'avery_a4' | 'thermal_zpl' | 'thermal_tspl' | 'dymo';

// A thermal label-roll template: a named preset (see THERMAL_TEMPLATES in PrintLabelsDialog) or
// "custom" (paired with the custom_* fields below). Mirrors barcode.LabelTemplateByName.
export type LabelTemplateName =
  | '2x1' | '3x2' | '4x2' | '4x6'
  | '1row_40x30' | '2row_38x30' | '3row_25x40' | '4row_18x30'
  | 'custom';

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

  // Avery grid preset when format=avery_a4: "l7160" (default, A4, 21/sheet) | "5160" (US Letter, 30/sheet)
  sheet?: string;

  // Physical label-roll template when format=thermal_zpl|thermal_tspl: a named preset or
  // "custom" (paired with the custom_* fields below). Replaces thermal_size (still accepted by
  // the API for back-compat, but new code should use template).
  template?: LabelTemplateName;
  custom_label_w_in?: number; // custom template: one label's width, inches
  custom_label_h_in?: number; // custom template: one label's height, inches
  custom_lanes?: number;      // custom template: 1-4 labels side by side ("rows")
  custom_gap_x_in?: number;   // custom template: gutter between lanes, inches
  custom_gap_y_in?: number;   // custom template: gap between labels along the feed, inches
  // Rotate content 90° to match a roll mounted with the label's long edge along the feed
  // direction — overrides the resolved template's own default when set.
  rotate?: boolean;

  /** @deprecated use `template` instead — "2x1" | "3x2" | "4x2" (default) | "4x6", all @203dpi */
  thermal_size?: string;

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

  // Single-item printable label PDF (title/SKU/barcode/human-readable — same card layout the
  // bulk Avery sheet uses per cell). Replaces printing the bare barcode PNG with no item details.
  itemLabelPdf: (orgSlug: string, itemId: string): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/items/${itemId}/label.pdf`),

  // Run a bulk label-print job → returns a Blob (PDF for avery_a4, text for zpl/dymo).
  printLabels: (orgSlug: string, body: PrintLabelsRequest): Promise<Blob> =>
    apiClient.postBlob(`/api/v1/${orgSlug}/inventory/labels/print`, body),
};
