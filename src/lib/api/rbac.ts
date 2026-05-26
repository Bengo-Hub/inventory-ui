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
  resource: string;
  action: string;
}

export interface RoleAssignment {
  id: string;
  user_id: string;
  user_email?: string;
  role_id: string;
  role_code?: string;
  role_name?: string;
  assigned_at: string;
}

export interface AssignRoleInput {
  user_id: string;
  role_id: string;
}

export const rbacApi = {
  listRoles: (orgSlug: string) =>
    apiClient.get<Role[]>(`/api/v1/${orgSlug}/rbac/roles`),

  listPermissions: (orgSlug: string) =>
    apiClient.get<Permission[]>(`/api/v1/${orgSlug}/rbac/permissions`),

  listAssignments: (orgSlug: string) =>
    apiClient.get<RoleAssignment[]>(`/api/v1/${orgSlug}/rbac/assignments`),

  assignRole: (orgSlug: string, data: AssignRoleInput) =>
    apiClient.post<RoleAssignment>(`/api/v1/${orgSlug}/rbac/assignments`, data),

  revokeRole: (orgSlug: string, assignmentId: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/rbac/assignments/${assignmentId}`),

  getMyRoles: (orgSlug: string) =>
    apiClient.get<Role[]>(`/api/v1/${orgSlug}/users/me/roles`),

  getMyPermissions: (orgSlug: string) =>
    apiClient.get<Permission[]>(`/api/v1/${orgSlug}/users/me/permissions`),
};
