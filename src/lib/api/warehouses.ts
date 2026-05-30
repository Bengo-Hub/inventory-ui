import { apiClient } from './client';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  is_default: boolean;
  is_active: boolean;
  outlet_id?: string;
  item_count?: number;
  created_at: string;
}

export interface CreateWarehouseInput {
  name: string;
  code: string;
  address?: string;
  is_default?: boolean;
  outlet_id?: string;
}

export type UpdateWarehouseInput = Partial<CreateWarehouseInput>;

export interface WarehouseLocation {
  id: string;
  warehouse_id: string;
  parent_id?: string;
  name: string;
  code: string;
  type: 'zone' | 'aisle' | 'shelf' | 'bin' | 'other';
  is_active: boolean;
  children?: WarehouseLocation[];
}

export interface CreateLocationInput {
  name: string;
  code: string;
  type: string;
  parent_id?: string;
}

function warehouseBase(orgSlug: string) {
  return `/api/v1/${orgSlug}/inventory/warehouses`;
}

export const warehousesApi = {
  list: (orgSlug: string) =>
    apiClient.get<Warehouse[]>(warehouseBase(orgSlug)),

  get: (orgSlug: string, id: string) =>
    apiClient.get<Warehouse>(`${warehouseBase(orgSlug)}/${id}`),

  create: (orgSlug: string, data: CreateWarehouseInput) =>
    apiClient.post<Warehouse>(warehouseBase(orgSlug), data),

  update: (orgSlug: string, id: string, data: UpdateWarehouseInput) =>
    apiClient.put<Warehouse>(`${warehouseBase(orgSlug)}/${id}`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`${warehouseBase(orgSlug)}/${id}`),

  listLocations: (orgSlug: string, warehouseId: string) =>
    apiClient.get<WarehouseLocation[]>(`${warehouseBase(orgSlug)}/${warehouseId}/locations`),

  createLocation: (orgSlug: string, warehouseId: string, data: CreateLocationInput) =>
    apiClient.post<WarehouseLocation>(`${warehouseBase(orgSlug)}/${warehouseId}/locations`, data),

  deleteLocation: (orgSlug: string, warehouseId: string, locationId: string) =>
    apiClient.delete<void>(`${warehouseBase(orgSlug)}/${warehouseId}/locations/${locationId}`),
};
