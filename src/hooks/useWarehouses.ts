'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  warehousesApi,
  type CreateWarehouseInput,
  type CreateLocationInput,
  type UpdateWarehouseInput,
} from '@/lib/api/warehouses';

const WH_KEY = 'warehouses';

export function useWarehouses(orgSlug: string) {
  return useQuery({
    queryKey: [WH_KEY, orgSlug],
    queryFn: () => warehousesApi.list(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 60_000,
  });
}

export function useWarehouse(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [WH_KEY, orgSlug, id],
    queryFn: () => warehousesApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useCreateWarehouse(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWarehouseInput) => warehousesApi.create(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WH_KEY, orgSlug] });
    },
  });
}

export function useUpdateWarehouse(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarehouseInput }) =>
      warehousesApi.update(orgSlug, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WH_KEY, orgSlug] });
    },
  });
}

export function useDeleteWarehouse(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehousesApi.delete(orgSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WH_KEY, orgSlug] });
    },
  });
}

export function useWarehouseLocations(orgSlug: string, warehouseId: string) {
  return useQuery({
    queryKey: [WH_KEY, orgSlug, warehouseId, 'locations'],
    queryFn: () => warehousesApi.listLocations(orgSlug, warehouseId),
    enabled: !!orgSlug && !!warehouseId,
    placeholderData: [],
  });
}

export function useCreateLocation(orgSlug: string, warehouseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLocationInput) =>
      warehousesApi.createLocation(orgSlug, warehouseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WH_KEY, orgSlug, warehouseId, 'locations'] });
    },
  });
}

export function useDeleteLocation(orgSlug: string, warehouseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locationId: string) =>
      warehousesApi.deleteLocation(orgSlug, warehouseId, locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WH_KEY, orgSlug, warehouseId, 'locations'] });
    },
  });
}
