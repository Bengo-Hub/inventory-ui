'use client';

import { Input } from '@/components/ui/base';
import { InfoHint } from '@/components/ui/info-hint';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { CreateItemInput, Item } from '@/lib/api/items';

// Form-local shape for the e-commerce / marketplace attributes. Text fields are held as
// strings (empty = unset) and return_window_days is a string so an empty box means
// "inherit tenant default" — it's serialized to a number (or omitted) on submit, never ''.
export interface EcommerceFieldValues {
  gtin: string;
  mpn: string;
  condition: string;
  slug: string;
  short_description: string;
  meta_title: string;
  meta_description: string;
  country_of_origin: string;
  hs_code: string;
  is_returnable: boolean;
  return_window_days: string;
  allow_backorder: boolean;
  is_discontinued: boolean;
}

// Backend default is_returnable = true (schema default), so new items start returnable.
export const emptyEcommerceValues: EcommerceFieldValues = {
  gtin: '',
  mpn: '',
  condition: '',
  slug: '',
  short_description: '',
  meta_title: '',
  meta_description: '',
  country_of_origin: '',
  hs_code: '',
  is_returnable: true,
  return_window_days: '',
  allow_backorder: false,
  is_discontinued: false,
};

// Hydrate the form values from a fetched item (edit mode).
export function ecommerceValuesFromItem(item?: Item | null): EcommerceFieldValues {
  if (!item) return { ...emptyEcommerceValues };
  return {
    gtin: item.gtin ?? '',
    mpn: item.mpn ?? '',
    condition: item.condition ?? '',
    slug: item.slug ?? '',
    short_description: item.short_description ?? '',
    meta_title: item.meta_title ?? '',
    meta_description: item.meta_description ?? '',
    country_of_origin: item.country_of_origin ?? '',
    hs_code: item.hs_code ?? '',
    is_returnable: item.is_returnable ?? true,
    return_window_days: item.return_window_days != null ? String(item.return_window_days) : '',
    allow_backorder: item.allow_backorder ?? false,
    is_discontinued: item.is_discontinued ?? false,
  };
}

const CONDITION_OPTIONS: { value: NonNullable<CreateItemInput['condition']>; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'REFURBISHED', label: 'Refurbished' },
  { value: 'USED', label: 'Used' },
  { value: 'OPEN_BOX', label: 'Open box' },
];

// Serialize form values into the create/update payload. Strings trim to undefined when
// empty; return_window_days becomes a number (or is omitted) — never an empty string.
export function ecommercePayload(v: EcommerceFieldValues): Partial<CreateItemInput> {
  const trimmed = (s: string) => {
    const t = s.trim();
    return t === '' ? undefined : t;
  };
  const rwd = v.return_window_days.trim();
  const rwdNum = rwd === '' ? undefined : Number.parseInt(rwd, 10);
  return {
    gtin: trimmed(v.gtin),
    mpn: trimmed(v.mpn),
    condition: v.condition ? (v.condition as CreateItemInput['condition']) : undefined,
    slug: trimmed(v.slug),
    short_description: trimmed(v.short_description),
    meta_title: trimmed(v.meta_title),
    meta_description: trimmed(v.meta_description),
    country_of_origin: trimmed(v.country_of_origin),
    hs_code: trimmed(v.hs_code),
    is_returnable: v.is_returnable,
    return_window_days: rwdNum != null && Number.isFinite(rwdNum) ? rwdNum : undefined,
    allow_backorder: v.allow_backorder,
    is_discontinued: v.is_discontinued,
  };
}

const inputCls =
  'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const selectCls = `${inputCls} appearance-none`;
const textareaCls = `${inputCls} resize-none`;

interface Props {
  value: EcommerceFieldValues;
  onChange: (value: EcommerceFieldValues) => void;
}

/**
 * Collapsible "E-commerce / Marketplace" section for the item form. Holds the additive
 * online-store / marketplace-feed attributes (GTIN, MPN, condition, SEO, customs, returns)
 * so they stay out of the way of the core item fields — collapsed by default, and only
 * rendered by the dialog for sellable non-event item types.
 */
export function ItemEcommerceFields({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof EcommerceFieldValues>(key: K, val: EcommerceFieldValues[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-sm font-semibold"
      >
        <span className="inline-flex items-center gap-1">
          E-commerce / Marketplace
          <InfoHint title="Online store & marketplace attributes">
            Optional details used when this item is listed in an online store or exported to a
            marketplace feed (Google Shopping, Jumia, etc.) — product identifiers (GTIN/MPN),
            condition, SEO text, customs codes, and return/backorder rules. Leave blank to use
            sensible defaults.
          </InfoHint>
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-4">
          {/* Product identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium inline-flex items-center gap-1">
                GTIN <span className="text-muted-foreground font-normal">(optional)</span>
                <InfoHint title="Global Trade Item Number">
                  The barcode number (GTIN-8/12/13/14, i.e. EAN/UPC) that uniquely identifies this
                  product to marketplaces. Required by many product feeds for match &amp; approval.
                </InfoHint>
              </label>
              <Input placeholder="e.g. 0614141007349" value={value.gtin} onChange={(e) => set('gtin', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium inline-flex items-center gap-1">
                MPN <span className="text-muted-foreground font-normal">(optional)</span>
                <InfoHint title="Manufacturer Part Number">
                  The manufacturer&apos;s own part number for this product. Used with the brand to
                  identify products that have no GTIN.
                </InfoHint>
              </label>
              <Input placeholder="Manufacturer part no." value={value.mpn} onChange={(e) => set('mpn', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Condition</label>
              <select value={value.condition} onChange={(e) => set('condition', e.target.value)} className={selectCls}>
                <option value="">Not specified</option>
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Marketplace item condition. Defaults to New when unset.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Country of Origin <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input placeholder="e.g. Kenya" value={value.country_of_origin} onChange={(e) => set('country_of_origin', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium inline-flex items-center gap-1">
                HS Code <span className="text-muted-foreground font-normal">(optional)</span>
                <InfoHint title="Harmonized System code">
                  The customs tariff classification code for this product. Used for customs
                  paperwork and cross-border marketplace compliance.
                </InfoHint>
              </label>
              <Input placeholder="e.g. 2202.10" value={value.hs_code} onChange={(e) => set('hs_code', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium inline-flex items-center gap-1">
                Storefront Slug <span className="text-muted-foreground font-normal">(optional)</span>
                <InfoHint title="URL slug">
                  The URL-friendly identifier used in the item&apos;s online-store link. Leave blank
                  to let the store derive one from the name.
                </InfoHint>
              </label>
              <Input placeholder="e.g. coca-cola-300ml" value={value.slug} onChange={(e) => set('slug', e.target.value)} />
            </div>
          </div>

          {/* Storefront copy */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Short Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              placeholder="Brief product-card blurb shown in listings..."
              value={value.short_description}
              onChange={(e) => set('short_description', e.target.value)}
              rows={2}
              className={textareaCls}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Meta Title <span className="text-muted-foreground font-normal">(SEO, optional)</span>
            </label>
            <Input placeholder="Search-engine title" value={value.meta_title} onChange={(e) => set('meta_title', e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Meta Description <span className="text-muted-foreground font-normal">(SEO, optional)</span>
            </label>
            <textarea
              placeholder="Search-engine description..."
              value={value.meta_description}
              onChange={(e) => set('meta_description', e.target.value)}
              rows={2}
              className={textareaCls}
            />
          </div>

          {/* Returns & availability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-2 text-sm cursor-pointer sm:pt-7">
              <input type="checkbox" checked={value.is_returnable} onChange={(e) => set('is_returnable', e.target.checked)} className="rounded mt-0.5" />
              <span>
                Returnable
                <br />
                <span className="text-xs text-muted-foreground font-normal">Customers may return this item.</span>
              </span>
            </label>
            <div className="space-y-2">
              <label className="text-sm font-medium inline-flex items-center gap-1">
                Return Window (days)
                <InfoHint title="Return window">
                  How many days after purchase a return is accepted. Leave blank to use the tenant
                  default return policy.
                </InfoHint>
              </label>
              <Input
                type="number"
                min="0"
                placeholder="Tenant default"
                value={value.return_window_days}
                onChange={(e) => set('return_window_days', e.target.value)}
                disabled={!value.is_returnable}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={value.allow_backorder} onChange={(e) => set('allow_backorder', e.target.checked)} className="rounded" />
              Allow backorder (sell when out of stock)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={value.is_discontinued} onChange={(e) => set('is_discontinued', e.target.checked)} className="rounded" />
              Discontinued (hide from new listings)
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
