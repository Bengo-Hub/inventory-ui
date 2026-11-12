/**
 * KRA eTIMS facts the item form shows next to its tax and eTIMS fields. treasury-api decides
 * the registration; these mirror its rules so the form can say what will happen.
 */

export interface KraItemType {
  code: '1' | '2' | '3';
  label: string;
}

/**
 * The KRA item type an item registers as: ingredients are raw materials (1); goods, equipment
 * and production recipes (finished goods that hold stock) are finished products (2); services,
 * vouchers and menu recipes are services (3).
 */
export function kraItemType(itemType: string, productionRecipe: boolean): KraItemType {
  switch (itemType) {
    case 'INGREDIENT':
      return { code: '1', label: 'raw material' };
    case 'GOODS':
    case 'EQUIPMENT':
      return { code: '2', label: 'finished product' };
    case 'RECIPE':
      return productionRecipe
        ? { code: '2', label: 'finished product' }
        : { code: '3', label: 'service' };
    default:
      return { code: '3', label: 'service' };
  }
}

const BAND_LABELS: Record<string, string> = {
  A: 'Exempt',
  B: 'VAT 16%',
  C: 'Zero-rated',
  D: 'Non-VAT',
  E: 'VAT 8%',
};

/** The KRA band letter (A to E) a tax code carries, or null when it has no known band. */
export function taxBand(kraCode?: string | null): string | null {
  const band = (kraCode ?? '').trim().toUpperCase();
  return BAND_LABELS[band] ? band : null;
}

/** "B · VAT 16%" for a KRA band letter, or null when the code carries no known band. */
export function taxBandLabel(kraCode?: string | null): string | null {
  const band = taxBand(kraCode);
  return band ? `${band} · ${BAND_LABELS[band]}` : null;
}
