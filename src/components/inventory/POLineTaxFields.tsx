'use client';

import { TaxCodeCombobox } from '@/components/inventory/TaxCodeCombobox';

interface Props {
  orgSlug: string;
  taxCode: string;
  priceIncludesTax: boolean;
  onChange: (patch: { taxCode?: string; priceIncludesTax?: boolean }) => void;
}

/**
 * Input VAT on one purchase order line: the treasury tax code the supplier charges and whether the
 * unit cost already holds that VAT. treasury books the VAT on the vendor bill when the goods are
 * received. No code means no VAT is claimed on the line.
 */
export function POLineTaxFields({ orgSlug, taxCode, priceIncludesTax, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <TaxCodeCombobox
        orgSlug={orgSlug}
        value={taxCode}
        onChange={(code) => onChange({ taxCode: code })}
        placeholder="VAT on this purchase (optional)"
      />
      <label className={`flex items-center gap-2 text-xs ${taxCode ? 'text-foreground' : 'text-muted-foreground'}`}>
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={priceIncludesTax}
          disabled={!taxCode}
          onChange={(e) => onChange({ priceIncludesTax: e.target.checked })}
        />
        Cost includes VAT
      </label>
    </div>
  );
}
