// Best-effort quantity conversion between common recipe units (mass, volume, count).
// Mirrors internal/modules/units/convert.go in the API so the UI can preview and
// submit a recipe line in the ingredient's base unit — e.g. enter 2.5 ml of an oil
// stocked in litres and store/cost it as 0.0025 L.

export type UnitDimension = 'mass' | 'volume' | 'count' | null;

interface UnitFactor {
  dim: Exclude<UnitDimension, null>;
  factor: number; // canonical base units per 1 of this unit (mass=g, volume=ml, count=pc)
}

const UNIT_TABLE: Record<string, UnitFactor> = {
  // mass (base: g)
  mg: { dim: 'mass', factor: 0.001 },
  g:  { dim: 'mass', factor: 1 },
  kg: { dim: 'mass', factor: 1000 },
  oz: { dim: 'mass', factor: 28.349523125 },
  lb: { dim: 'mass', factor: 453.59237 },
  t:  { dim: 'mass', factor: 1_000_000 },

  // volume (base: ml)
  ml:   { dim: 'volume', factor: 1 },
  cl:   { dim: 'volume', factor: 10 },
  dl:   { dim: 'volume', factor: 100 },
  l:    { dim: 'volume', factor: 1000 },
  tsp:  { dim: 'volume', factor: 5 },
  tbsp: { dim: 'volume', factor: 15 },
  cup:  { dim: 'volume', factor: 240 },
  floz: { dim: 'volume', factor: 29.5735 },
  pt:   { dim: 'volume', factor: 473.176 },
  qt:   { dim: 'volume', factor: 946.353 },
  gal:  { dim: 'volume', factor: 3785.41 },

  // count (base: pc)
  pc:  { dim: 'count', factor: 1 },
  doz: { dim: 'count', factor: 12 },
};

const SYNONYMS: Record<string, string> = {
  milligram: 'mg', milligrams: 'mg',
  gram: 'g', grams: 'g', gm: 'g', gr: 'g',
  kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kgs: 'kg',
  ounce: 'oz', ounces: 'oz',
  pound: 'lb', pounds: 'lb', lbs: 'lb',
  tonne: 't', ton: 't', tonnes: 't',

  milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml',
  centiliter: 'cl', centilitre: 'cl',
  deciliter: 'dl', decilitre: 'dl',
  liter: 'l', litre: 'l', liters: 'l', litres: 'l', lt: 'l', ltr: 'l',
  teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp',
  cups: 'cup',
  fluidounce: 'floz', pint: 'pt', pints: 'pt',
  quart: 'qt', quarts: 'qt', gallon: 'gal', gallons: 'gal',

  piece: 'pc', pieces: 'pc', pcs: 'pc', each: 'pc', ea: 'pc',
  unit: 'pc', units: 'pc', item: 'pc', items: 'pc',
  dozen: 'doz', dozens: 'doz',
};

/** Human labels for the canonical abbreviations, for dropdown options. */
const UNIT_LABEL: Record<string, string> = {
  mg: 'mg (milligram)', g: 'g (gram)', kg: 'kg (kilogram)', oz: 'oz (ounce)', lb: 'lb (pound)', t: 't (tonne)',
  ml: 'ml (millilitre)', cl: 'cl', dl: 'dl', l: 'L (litre)', tsp: 'tsp (teaspoon)', tbsp: 'tbsp (tablespoon)',
  cup: 'cup', floz: 'fl oz', pt: 'pt (pint)', qt: 'qt (quart)', gal: 'gal (gallon)',
  pc: 'pc (piece)', doz: 'dozen',
};

/** Lower-case, trim and map a unit spelling to its canonical abbreviation. */
export function normalizeUnit(u: string | undefined | null): string {
  const s = (u ?? '').trim().toLowerCase();
  if (!s) return '';
  return SYNONYMS[s] ?? s;
}

/** Dimension of a unit, or null when unknown. */
export function unitDimension(u: string | undefined | null): UnitDimension {
  return UNIT_TABLE[normalizeUnit(u)]?.dim ?? null;
}

/**
 * Convert qty from one unit to another. Returns null when the units are unknown
 * or belong to different dimensions (caller should then treat qty as already in
 * the target unit).
 */
export function convertQuantity(qty: number, from: string, to: string): number | null {
  const nf = normalizeUnit(from);
  const nt = normalizeUnit(to);
  if (!nf || !nt) return null;
  if (nf === nt) return qty;
  const ff = UNIT_TABLE[nf];
  const ft = UNIT_TABLE[nt];
  if (!ff || !ft || ff.dim !== ft.dim) return null;
  return (qty * ff.factor) / ft.factor;
}

/**
 * Units offered in the recipe-line dropdown for a given base unit. When the base
 * unit is known, offer every unit in the same dimension (so L → ml, cl, tsp…).
 * Otherwise fall back to a broad common set. The base unit itself is always first.
 */
export function unitOptionsForBase(baseUnit: string | undefined | null): { value: string; label: string }[] {
  const base = normalizeUnit(baseUnit);
  const dim = UNIT_TABLE[base]?.dim ?? null;

  const inDim = (d: Exclude<UnitDimension, null>) =>
    Object.entries(UNIT_TABLE).filter(([, v]) => v.dim === d).map(([k]) => k);

  let abbrs: string[];
  if (dim) {
    abbrs = inDim(dim);
    // put the base unit first
    abbrs = [base, ...abbrs.filter((a) => a !== base)];
  } else {
    // Unknown base (e.g. a free-typed unit or a brand-new ingredient): offer a common set,
    // keeping any custom base value selectable.
    abbrs = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'pc'];
    if (base && !abbrs.includes(base)) abbrs = [base, ...abbrs];
  }

  return abbrs.map((a) => ({ value: a, label: UNIT_LABEL[a] ?? a }));
}

/** Whether two units can be converted between one another. */
export function unitsConvertible(a: string, b: string): boolean {
  return convertQuantity(1, a, b) !== null;
}
