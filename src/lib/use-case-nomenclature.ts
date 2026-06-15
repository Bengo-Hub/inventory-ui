'use client';

// ── Per-use-case page nomenclature + catalog scoping ───────────────────────────
//
// The inventory app is multi-use-case: a single tenant has outlets for hospitality,
// retail, pharmacy, services, quick-service, manufacturing and warehousing. The
// selected outlet's use_case drives BOTH what the catalog page is called ("Items"
// vs "Products" vs "Drugs" vs "Services") AND which item types / fields / filter
// options are relevant. This module is the single source of truth for that mapping,
// mirroring pos-ui's lib/use-case-config.ts pattern. Gating is by the SELECTED
// outlet's use_case for everyone; when no specific outlet is selected (HQ "All
// Outlets" view) the full superset is shown.

import { useOutletStore } from '@/store/outlet';
import type { ItemUseCase } from '@/lib/api/items';

export interface CatalogNomenclature {
  /** Catalog page / "Items" nav label, e.g. "Drugs". */
  catalog: string;
  /** Singular noun for a catalog entry, e.g. "Drug" — used in dialog/button copy. */
  item: string;
  /** Plural noun, e.g. "Drugs" — used in empty-state copy. */
  itemPlural: string;
}

const DEFAULT_NOMENCLATURE: CatalogNomenclature = { catalog: 'Items', item: 'Item', itemPlural: 'Items' };

// Labels confirmed with the product owner: hospitality/quick_service/warehouse → "Items",
// retail/manufacturing → "Products", pharmacy → "Drugs", services → "Services".
const NOMENCLATURE: Record<string, CatalogNomenclature> = {
  hospitality:   { catalog: 'Items', item: 'Item', itemPlural: 'Items' },
  quick_service: { catalog: 'Items', item: 'Item', itemPlural: 'Items' },
  retail:        { catalog: 'Products', item: 'Product', itemPlural: 'Products' },
  manufacturing: { catalog: 'Products', item: 'Product', itemPlural: 'Products' },
  pharmacy:      { catalog: 'Drugs', item: 'Drug', itemPlural: 'Drugs' },
  services:      { catalog: 'Services', item: 'Service', itemPlural: 'Services' },
  warehouse:     { catalog: 'Items', item: 'Item', itemPlural: 'Items' },
};

export function nomenclatureFor(useCase?: string | null): CatalogNomenclature {
  if (!useCase) return DEFAULT_NOMENCLATURE;
  return NOMENCLATURE[useCase] ?? DEFAULT_NOMENCLATURE;
}

// ── Catalog scope (which item types / use-cases / form sections apply) ──────────

export type ItemType = 'GOODS' | 'SERVICE' | 'RECIPE' | 'INGREDIENT' | 'VOUCHER' | 'EQUIPMENT';
const ALL_TYPES: ItemType[] = ['GOODS', 'SERVICE', 'RECIPE', 'INGREDIENT', 'VOUCHER', 'EQUIPMENT'];
const ALL_USE_CASES: ItemUseCase[] = [
  'RETAIL', 'PHARMACY', 'FOOD_BEVERAGE', 'HOSPITALITY_ROOM',
  'HOSPITALITY_FACILITY', 'CONFERENCE', 'SALON_SERVICE', 'AMENITY',
];

export interface CatalogScope {
  /** Item types offered in the form Type select + catalog Type filter. */
  itemTypes: ItemType[];
  /** Item-level use_case options offered in the catalog filter + hospitality form section. */
  itemUseCases: ItemUseCase[];
  /**
   * Default item use_case for this outlet: preselected in the catalog list filter and
   * stamped on newly-created non-service items so they surface on the right page.
   * Omitted for mixed-use outlets (hospitality) and HQ, which show all.
   */
  defaultItemUseCase?: ItemUseCase;
  /** Whether the hospitality (rooms / meal-plan / occupancy) form section applies. */
  showHospitality: boolean;
  /** Whether RECIPE/BOM is offered (drives the "New Menu Item" action). */
  showRecipe: boolean;
}

const DEFAULT_SCOPE: CatalogScope = {
  itemTypes: ALL_TYPES,
  itemUseCases: ALL_USE_CASES,
  showHospitality: true,
  showRecipe: true,
};

// Each outlet use_case exposes only the item types / use-cases / sections that belong to it.
const SCOPES: Record<string, CatalogScope> = {
  hospitality: {
    itemTypes: ['RECIPE', 'INGREDIENT', 'SERVICE', 'GOODS', 'VOUCHER'],
    itemUseCases: ['FOOD_BEVERAGE', 'HOSPITALITY_ROOM', 'HOSPITALITY_FACILITY', 'CONFERENCE', 'AMENITY', 'RETAIL'],
    showHospitality: true,
    showRecipe: true,
  },
  quick_service: {
    itemTypes: ['RECIPE', 'INGREDIENT', 'GOODS'],
    itemUseCases: ['FOOD_BEVERAGE', 'RETAIL'],
    defaultItemUseCase: 'FOOD_BEVERAGE',
    showHospitality: false,
    showRecipe: true,
  },
  retail: {
    itemTypes: ['GOODS', 'EQUIPMENT', 'VOUCHER'],
    itemUseCases: ['RETAIL'],
    defaultItemUseCase: 'RETAIL',
    showHospitality: false,
    showRecipe: false,
  },
  manufacturing: {
    itemTypes: ['GOODS', 'INGREDIENT', 'RECIPE', 'EQUIPMENT'],
    itemUseCases: ['RETAIL'],
    defaultItemUseCase: 'RETAIL',
    showHospitality: false,
    showRecipe: true,
  },
  pharmacy: {
    itemTypes: ['GOODS'],
    itemUseCases: ['PHARMACY'],
    defaultItemUseCase: 'PHARMACY',
    showHospitality: false,
    showRecipe: false,
  },
  services: {
    itemTypes: ['SERVICE', 'GOODS', 'VOUCHER'],
    itemUseCases: ['SALON_SERVICE', 'AMENITY'],
    defaultItemUseCase: 'SALON_SERVICE',
    showHospitality: true,
    showRecipe: false,
  },
  warehouse: {
    itemTypes: ALL_TYPES,
    itemUseCases: ['RETAIL', 'FOOD_BEVERAGE', 'PHARMACY'],
    showHospitality: false,
    showRecipe: true,
  },
};

export function catalogScopeFor(useCase?: string | null): CatalogScope {
  if (!useCase) return DEFAULT_SCOPE;
  return SCOPES[useCase] ?? DEFAULT_SCOPE;
}

// Master label map for item-level use_case (catalog filter dropdown).
export const ITEM_USE_CASE_LABEL: Record<ItemUseCase, string> = {
  RETAIL: 'Retail',
  PHARMACY: 'Pharmacy',
  FOOD_BEVERAGE: 'Food & Beverage',
  HOSPITALITY_ROOM: 'Hotel Rooms',
  HOSPITALITY_FACILITY: 'Facilities',
  CONFERENCE: 'Conference',
  SALON_SERVICE: 'Salon / Spa',
  AMENITY: 'Amenities',
};

// ── Hooks (read the active outlet from the store) ───────────────────────────────

export function useNomenclature(): CatalogNomenclature {
  const outlet = useOutletStore((s) => s.outlet);
  return nomenclatureFor(outlet?.use_case);
}

export function useCatalogScope(): CatalogScope {
  const outlet = useOutletStore((s) => s.outlet);
  return catalogScopeFor(outlet?.use_case);
}
