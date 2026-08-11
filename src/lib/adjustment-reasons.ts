// Shared stock-adjustment reason list — the manually-choosable subset of
// stockadjustment.Reason (inventory-api). Excludes system-driven reasons that are never picked
// by a human from a form (transfer_in/transfer_out/return/opening_balance/location_move/
// count_variance) — those are set by their own flows (transfers, relocation, bulk import, stock
// take), not this picker. Reused by the single Adjustments form and BulkAdjustStockDialog so the
// two surfaces can never drift apart.
export const ADJUSTMENT_REASON_OPTIONS = [
  { value: 'correction', label: 'Count Correction' },
  { value: 'damaged', label: 'Damaged Goods' },
  { value: 'expired', label: 'Expired / Spoiled' },
  { value: 'shrinkage', label: 'Theft / Unexplained Loss' },
  // Floor-stock issue of consumables (serviettes, tissues, handwashing supplies) not
  // tied to any sale — treasury posts the value as an Operating Supplies expense.
  { value: 'internal_consumption', label: 'Internal Use / Issue to Floor' },
  { value: 'found', label: 'Found / Surplus Discovered' },
  { value: 'initial_count', label: 'Initial Stock Count' },
  { value: 'return', label: 'Customer Return' },
  { value: 'other', label: 'Other' },
];
