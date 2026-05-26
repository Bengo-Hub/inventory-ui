'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rbacApi, type AssignRoleInput } from '@/lib/api/rbac';

const ROLES_KEY = 'rbac-roles';
const PERMS_KEY = 'rbac-permissions';
const ASSIGNMENTS_KEY = 'rbac-assignments';

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
