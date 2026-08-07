'use client';

// DataTable column definitions for the Backups list — split out of page.tsx to mirror
// the platform's <page>-columns.tsx convention.

import { Download, Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Backup } from '@/lib/api/backups';

/** "1.5 MB" — base-1024 human-readable size. */
function humanSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface BackupColumnCallbacks {
  isDownloading: boolean;
  onDownload: (b: Backup) => void;
  onDelete: (b: Backup) => void;
}

export function buildBackupColumns(cb: BackupColumnCallbacks): DataTableColumn<Backup>[] {
  return [
    {
      key: 'name',
      header: 'File',
      primary: true,
      sortable: true,
      accessor: (b) => b.name,
      cellClassName: 'font-medium font-mono text-xs break-all',
    },
    {
      key: 'size',
      header: 'Size',
      sortable: true,
      accessor: (b) => b.size,
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      render: (b) => humanSize(b.size),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      accessor: (b) => b.created_at,
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      render: (b) => formatCreatedAt(b.created_at),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (b) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => cb.onDownload(b)}
            disabled={cb.isDownloading}
            title="Download"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => cb.onDelete(b)}
            title="Delete"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];
}
