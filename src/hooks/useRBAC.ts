'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rbacApi, type AssignRoleInput, type CreateRoleInput } from '@/lib/api/rbac';

const ROLES_KEY = 'rbac-roles';
const PERMS_KEY = 'rbac-permissions';
const ASSIGNMENTS_KEY = 'rbac-assignments';
const USERS_KEY = 'rbac-users';
const ROLE_PERMS_KEY = 'rbac-role-permissions';
const OUTLETS_KEY = 'rbac-outlets';
const USER_OUTLETS_KEY = 'rbac-user-outlets';

export function useRoles(orgSlug: string) {
  return useQuery({
    queryKey: [ROLES_KEY, orgSlug],
    queryFn: () => rbacApi.listRoles(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 300_000,
  });
}

export function usePermissions(orgSlug: string) {
  return useQuery({
    queryKey: [PERMS_KEY, orgSlug],
    queryFn: () => rbacApi.listPermissions(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 300_000,
  });
}

export function useRoleAssignments(orgSlug: string) {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, orgSlug],
    queryFn: () => rbacApi.listAssignments(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 60_000,
  });
}

export function useInventoryUsers(orgSlug: string) {
  return useQuery({
    queryKey: [USERS_KEY, orgSlug],
    queryFn: () => rbacApi.listUsers(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 60_000,
  });
}

export function useRolePermissions(orgSlug: string, roleId: string | null) {
  return useQuery({
    queryKey: [ROLE_PERMS_KEY, orgSlug, roleId],
    queryFn: () => rbacApi.getRolePermissions(orgSlug, roleId as string),
    enabled: !!orgSlug && !!roleId,
    staleTime: 60_000,
  });
}

export function useOutlets(orgSlug: string) {
  return useQuery({
    queryKey: [OUTLETS_KEY, orgSlug],
    queryFn: () => rbacApi.listOutlets(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 300_000,
  });
}

export function useUserOutlets(orgSlug: string, userId: string | null) {
  return useQuery({
    queryKey: [USER_OUTLETS_KEY, orgSlug, userId],
    queryFn: () => rbacApi.listUserOutlets(orgSlug, userId as string),
    enabled: !!orgSlug && !!userId,
    staleTime: 60_000,
  });
}

export function useAssignRole(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignRoleInput) => rbacApi.assignRole(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY, orgSlug] });
    },
  });
}

export function useRevokeRole(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => rbacApi.revokeRole(orgSlug, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY, orgSlug] });
    },
  });
}

export function useCreateRole(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => rbacApi.createRole(orgSlug, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ROLES_KEY, orgSlug] });
    },
  });
}

export function useSetRolePermissions(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      rbacApi.setRolePermissions(orgSlug, roleId, permissionIds),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: [ROLE_PERMS_KEY, orgSlug, vars.roleId] });
    },
  });
}

export function useUpdateUserStatus(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      rbacApi.updateUserStatus(orgSlug, userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, orgSlug] });
    },
  });
}

export function useAssignUserOutlet(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, outletId, isHome }: { userId: string; outletId: string; isHome?: boolean }) =>
      rbacApi.assignUserOutlet(orgSlug, userId, outletId, isHome),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: [USER_OUTLETS_KEY, orgSlug, vars.userId] });
    },
  });
}

export function useRemoveUserOutlet(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, outletId }: { userId: string; outletId: string }) =>
      rbacApi.removeUserOutlet(orgSlug, userId, outletId),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: [USER_OUTLETS_KEY, orgSlug, vars.userId] });
    },
  });
}

export function useMyRoles(orgSlug: string) {
  return useQuery({
    queryKey: [ROLES_KEY, orgSlug, 'me'],
    queryFn: () => rbacApi.getMyRoles(orgSlug),
    enabled: !!orgSlug,
    staleTime: 300_000,
  });
}

export function useMyPermissions(orgSlug: string) {
  return useQuery({
    queryKey: [PERMS_KEY, orgSlug, 'me'],
    queryFn: () => rbacApi.getMyPermissions(orgSlug),
    enabled: !!orgSlug,
    staleTime: 300_000,
  });
}
