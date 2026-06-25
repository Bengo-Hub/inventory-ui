'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backupsApi, type BackupSettings } from '@/lib/api/backups';
import { apiErrorMessage } from '@/lib/api/error-message';
import { toast } from 'sonner';

export function useBackups(orgSlug: string) {
  return useQuery({
    queryKey: ['backups', orgSlug],
    queryFn: () => backupsApi.list(orgSlug),
    enabled: !!orgSlug,
  });
}

export function useCreateBackup(orgSlug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => backupsApi.create(orgSlug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups', orgSlug] });
      toast.success('Backup created');
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create backup')),
  });
}

export function useDeleteBackup(orgSlug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => backupsApi.remove(orgSlug, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups', orgSlug] });
      toast.success('Backup deleted');
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete backup')),
  });
}

export function useDownloadBackup(orgSlug: string) {
  return useMutation({
    mutationFn: (name: string) => backupsApi.download(orgSlug, name),
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to download backup')),
  });
}

export function useBackupSettings(orgSlug: string) {
  return useQuery({
    queryKey: ['backup-settings', orgSlug],
    queryFn: () => backupsApi.getSettings(orgSlug),
    enabled: !!orgSlug,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateBackupSettings(orgSlug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: BackupSettings) => backupsApi.updateSettings(orgSlug, data),
    onSuccess: (data) => {
      qc.setQueryData(['backup-settings', orgSlug], data);
      toast.success('Backup schedule saved');
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to save backup schedule')),
  });
}
