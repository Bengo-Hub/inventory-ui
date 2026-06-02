import { apiClient } from './client';

export type PackageType =
  | 'RETAIL_KIT'
  | 'ROOM_RATE_PLAN'
  | 'DDR'
  | 'RDR'
  | 'HALF_BOARD'
  | 'FULL_BOARD'
  | 'HALL_HIRE_ONLY'
  | 'SERVICE_SESSIONS';

export type PriceBasis = 'flat' | 'per_delegate_per_day' | 'per_person_sharing' | 'per_session';

export type ComponentKind =
  | 'ITEM'
  | 'MEAL_PERIOD'
  | 'AV_EQUIPMENT'
  | 'STATIONERY'
  | 'CONSUMABLE'
  | 'FACILITY'
  | 'SERVICE_SESSION';

export type MealPeriod = 'breakfast' | 'am_break' | 'lunch' | 'pm_break' | 'dinner';

export const PACKAGE_TYPES: { value: PackageType; label: string }[] = [
  { value: 'RETAIL_KIT', label: 'Retail Kit' },
  { value: 'ROOM_RATE_PLAN', label: 'Room Rate Plan' },
  { value: 'DDR', label: 'Day Delegate Rate (DDR)' },
  { value: 'RDR', label: 'Residential Delegate Rate (RDR)' },
  { value: 'HALF_BOARD', label: 'Half Board' },
  { value: 'FULL_BOARD', label: 'Full Board' },
  { value: 'HALL_HIRE_ONLY', label: 'Hall Hire Only' },
  { value: 'SERVICE_SESSIONS', label: 'Service Sessions' },
];

export const MEAL_PERIODS: { value: MealPeriod; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'am_break', label: 'AM Break' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'pm_break', label: 'PM Break' },
  { value: 'dinner', label: 'Dinner' },
];

export interface BundleComponent {
  id: string;
  component_item_id: string;
  item_name?: string;
  item_sku?: string;
  quantity: number;
  sort_order: number;
  component_kind?: ComponentKind;
  meal_period?: MealPeriod | null;
  is_metered?: boolean;
  unit?: string;
}

export interface Bundle {
  id: string;
  tenant_id: string;
  item_id: string;
  item_name?: string;
  name: string;
  is_active: boolean;
  components: BundleComponent[];
  // Hospitality package attributes
  package_type?: PackageType;
  price_basis?: PriceBasis;
  min_delegates?: number | null;
  accommodation_included?: boolean;
  sessions_total?: number | null;
  validity_days?: number | null;
}

export interface CreateBundleComponentInput {
  component_item_id: string;
  quantity: number;
  component_kind?: ComponentKind;
  meal_period?: MealPeriod;
  is_metered?: boolean;
  unit?: string;
}

export interface CreateBundleInput {
  item_id: string;
  name: string;
  is_active?: boolean;
  components: CreateBundleComponentInput[];
  // Hospitality package attributes
  package_type?: PackageType;
  price_basis?: PriceBasis;
  min_delegates?: number;
  accommodation_included?: boolean;
  sessions_total?: number;
  validity_days?: number;
}

export type UpdateBundleInput = Partial<CreateBundleInput>;

export interface PaginatedBundles {
  data: Bundle[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function base(orgSlug: string) {
  return `/api/v1/${orgSlug}/inventory/bundles`;
}

export const bundlesApi = {
  list: (orgSlug: string, params?: { page?: number; limit?: number }): Promise<PaginatedBundles> =>
    apiClient.get<PaginatedBundles>(base(orgSlug), params),

  get: (orgSlug: string, id: string): Promise<Bundle> =>
    apiClient.get<Bundle>(`${base(orgSlug)}/${id}`),

  create: (orgSlug: string, data: CreateBundleInput): Promise<Bundle> =>
    apiClient.post<Bundle>(base(orgSlug), data),

  update: (orgSlug: string, id: string, data: UpdateBundleInput): Promise<Bundle> =>
    apiClient.put<Bundle>(`${base(orgSlug)}/${id}`, data),

  delete: (orgSlug: string, id: string): Promise<void> =>
    apiClient.delete<void>(`${base(orgSlug)}/${id}`),
};
