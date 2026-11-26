/**
 * What a goods receipt does to an item's cost, mirroring inventory-api's RecomputeStandardCost:
 * - wavg: the running average blends on-hand stock at the current cost with the received units,
 *   and every unit sold afterwards is costed at that average;
 * - fifo/lifo/fefo: stock on hand keeps its own cost and the received units cost what was paid.
 * When stock on hand is zero or negative there is nothing to blend, so the receipt cost wins.
 */
export interface ReceiptCostInput {
  method: 'wavg' | 'fifo' | 'lifo' | 'fefo' | string;
  onHand?: number;
  currentCost?: number;
  receivedQty: number;
  receiptCost: number;
  sellingPrice?: number;
}

export interface ReceiptCostPreview {
  method: string;
  currentCost: number;
  receiptCost: number;
  /** The cost used for units sold after this receipt (average for wavg, receipt cost otherwise). */
  resultingCost: number;
  sellingPrice?: number;
  /** Gross margin % of sellingPrice over resultingCost, when a price is known. */
  marginPct?: number;
}

export function receiptCostPreview(i: ReceiptCostInput): ReceiptCostPreview | null {
  if (!Number.isFinite(i.receiptCost) || i.receiptCost < 0) return null;
  if (i.currentCost === undefined || !Number.isFinite(i.currentCost)) return null;
  if (i.receivedQty <= 0 || i.currentCost === i.receiptCost) return null;
  const onHand = Math.max(0, i.onHand ?? 0);
  let resultingCost = i.receiptCost;
  if (i.method === 'wavg' && onHand > 0) {
    resultingCost = (onHand * i.currentCost + i.receivedQty * i.receiptCost) / (onHand + i.receivedQty);
  }
  resultingCost = Math.round(resultingCost * 10000) / 10000;
  const price = i.sellingPrice;
  const marginPct = price && price > 0 ? ((price - resultingCost) / price) * 100 : undefined;
  return {
    method: i.method,
    currentCost: i.currentCost,
    receiptCost: i.receiptCost,
    resultingCost,
    sellingPrice: price,
    marginPct,
  };
}
