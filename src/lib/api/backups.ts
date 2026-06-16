import { apiClient } from './client';

/** A stored backup archive of the tenant's inventory data. */
export interface Backup {
  name: string;
  size: number;
  created_at: string;
}

/** Auto-backup schedule configuration. Off by default. */
export interface BackupSettings {
  auto_enabled: boolean;
  schedule_hour: number;
  retention_days: number;
}

function backupsBase(orgSlug: string) {
  return `/api/v1/${orgSlug}/inventory/backups`;
}

export const backupsApi = {
  list: (orgSlug: string) =>
    apiClient.get<{ backups: Backup[] }>(backupsBase(orgSlug)),

  create: (orgSlug: string) =>
    apiClient.post<Backup>(backupsBase(orgSlug), {}),

  remove: (orgSlug: string, name: string) =>
    apiClient.delete<void>(`${backupsBase(orgSlug)}/${encodeURIComponent(name)}`),

  getSettings: (orgSlug: string) =>
    apiClient.get<BackupSettings>(`${backupsBase(orgSlug)}/settings`),

  updateSettings: (orgSlug: string, data: BackupSettings) =>
    apiClient.put<BackupSettings>(`${backupsBase(orgSlug)}/settings`, data),

  /**
   * Download a backup archive. The apiClient has no blob helper of its own, so we
   * fetch the gzip payload as a Blob (auth + tenant headers are applied by the
   * shared interceptors) and trigger a browser download via an anchor click.
   */
  download: async (orgSlug: string, name: string) => {
    const blob = await apiClient.getBlob(
      `${backupsBase(orgSlug)}/${encodeURIComponent(name)}/download`,
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
