import { apiClient } from './client';

export interface ProcurementDashboard {
  total_purchase_orders: number;
  total_spend: number;
  open_requisitions: number;
  active_suppliers: number;
  purchase_orders_by_status: Record<string, number>;
}

export interface SupplierPerformance {
  id: string;
  supplier_id: string;
  period_start: string;
  period_end: string;
  on_time_delivery_rate: number;
  defect_rate: number;
  average_lead_time_days: number;
  total_spend: number;
}

export interface PaginatedSupplierPerformance {
  data: SupplierPerformance[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const base = (org: string) => `/api/v1/${org}/inventory`;

export const procurementApi = {
  dashboard: (org: string): Promise<ProcurementDashboard> => apiClient.get<ProcurementDashboard>(`${base(org)}/procurement/dashboard`),
  supplierPerformance: (org: string): Promise<PaginatedSupplierPerformance> => apiClient.get<PaginatedSupplierPerformance>(`${base(org)}/supplier-performance`),
};
