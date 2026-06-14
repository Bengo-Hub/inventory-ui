import { apiClient } from './client';

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_system: boolean;
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  description?: string;
  module: string;
  action: string;
  resource?: string;
}

export interface RoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
}

export interface InventoryUserRow {
  id: string;
  email: string;
  status: string;
  sync_status?: string;
}

export interface AssignRoleInput {
  user_id: string;
  role_id: string;
}

export interface CreateRoleInput {
  role_code: string;
  name: string;
  description?: string;
}

export interface OutletRow {
  id: string;
  code: string;
  name: string;
  use_case?: string;
  is_hq?: boolean;
  status?: string;
}

export interface UserOutletRow {
  id: string;
  outlet_id: string;
  is_home_outlet: boolean;
  assigned_at: string;
}

// data unwraps a {data:[...]} envelope, tolerating a bare array fallback.
function data<T>(resp: any): T[] {
  if (Array.isArray(resp)) return resp as T[];
  return (resp?.data ?? []) as T[];
}

export const rbacApi = {
  // --- Users ---
  listUsers: (orgSlug: string) =>
    apiClient.get<{ data: InventoryUserRow[] }>(`/api/v1/${orgSlug}/users`).then(data<InventoryUserRow>),

  updateUserStatus: (orgSlug: string, userId: string, status: string) =>
    apiClient.put<void>(`/api/v1/${orgSlug}/users/${userId}/status`, { status }),

  // --- Roles ---
  listRoles: (orgSlug: string) =>
    apiClient.get<{ data: Role[] }>(`/api/v1/${orgSlug}/rbac/roles`).then(data<Role>),

  createRole: (orgSlug: string, input: CreateRoleInput) =>
    apiClient.post<Role>(`/api/v1/${orgSlug}/rbac/roles`, input),

  getRolePermissions: (orgSlug: string, roleId: string) =>
    apiClient.get<{ data: Permission[] }>(`/api/v1/${orgSlug}/rbac/roles/${roleId}/permissions`).then(data<Permission>),

  setRolePermissions: (orgSlug: string, roleId: string, permissionIds: string[]) =>
    apiClient.put<void>(`/api/v1/${orgSlug}/rbac/roles/${roleId}/permissions`, { permission_ids: permissionIds }),

  // --- Permissions ---
  listPermissions: (orgSlug: string) =>
    apiClient.get<{ data: Permission[] }>(`/api/v1/${orgSlug}/rbac/permissions`).then(data<Permission>),

  // --- Assignments ---
  listAssignments: (orgSlug: string) =>
    apiClient.get<{ data: RoleAssignment[] }>(`/api/v1/${orgSlug}/rbac/assignments`).then(data<RoleAssignment>),

  assignRole: (orgSlug: string, input: AssignRoleInput) =>
    apiClient.post<RoleAssignment>(`/api/v1/${orgSlug}/rbac/assignments`, input),

  revokeRole: (orgSlug: string, assignmentId: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/rbac/assignments/${assignmentId}`),

  getMyRoles: (orgSlug: string) =>
    apiClient.get<{ data: Role[] }>(`/api/v1/${orgSlug}/users/me/roles`).then(data<Role>),

  getMyPermissions: (orgSlug: string) =>
    apiClient.get<{ data: Permission[] }>(`/api/v1/${orgSlug}/users/me/permissions`).then(data<Permission>),

  // --- Outlets & user-outlet assignment ---
  listOutlets: (orgSlug: string) =>
    apiClient.get<OutletRow[] | { data: OutletRow[] }>(`/api/v1/${orgSlug}/inventory/outlets`).then(data<OutletRow>),

  listUserOutlets: (orgSlug: string, userId: string) =>
    apiClient.get<{ data: UserOutletRow[] }>(`/api/v1/${orgSlug}/inventory/users/${userId}/outlets`).then(data<UserOutletRow>),

  assignUserOutlet: (orgSlug: string, userId: string, outletId: string, isHome = false) =>
    apiClient.post<void>(`/api/v1/${orgSlug}/inventory/users/${userId}/outlets`, { outlet_id: outletId, is_home_outlet: isHome }),

  removeUserOutlet: (orgSlug: string, userId: string, outletId: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/users/${userId}/outlets/${outletId}`),
};
