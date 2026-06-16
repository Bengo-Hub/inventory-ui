'use client';

import { Button, Card, CardContent, CardHeader, Table } from '@/components/ui/base';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useDownloadBackup,
  useBackupSettings,
  useUpdateBackupSettings,
} from '@/hooks/useBackups';
import type { BackupSettings } from '@/lib/api/backups';
import {
  Clock,
  Database,
  Download,
  HardDriveDownload,
  Info,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** "1.5 MB" — base-1024 human-readable size. */
function humanSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

/** 0..23 -> "2:00 AM" / "12:00 PM". */
function formatHour(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  const period = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
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

const labelClass = 'text-xs font-bold text-muted-foreground uppercase tracking-wider';
const inputClass =
  'w-full bg-accent/10 border border-border rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed';

// ── Toggle (no Switch component in this repo — inline accessible role="switch") ─

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
        ${checked ? 'bg-primary' : 'bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

// ── Auto-backup schedule card ─────────────────────────────────────────────────

function AutoBackupCard({ orgSlug }: { orgSlug: string }) {
  const { data: settings, isLoading } = useBackupSettings(orgSlug);
  const update = useUpdateBackupSettings(orgSlug);

  // Opt-in: default OFF until the tenant explicitly enables a schedule.
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(2);
  const [retention, setRetention] = useState(30);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.auto_enabled);
      setHour(settings.schedule_hour);
      setRetention(settings.retention_days);
    }
  }, [settings]);

  const dirty =
    !!settings &&
    (enabled !== settings.auto_enabled ||
      hour !== settings.schedule_hour ||
      retention !== settings.retention_days);

  const handleSave = () => {
    const payload: BackupSettings = {
      auto_enabled: enabled,
      schedule_hour: hour,
      retention_days: retention,
    };
    update.mutate(payload);
  };

  if (isLoading)
    return (
      <Card>
        <CardContent className="h-32 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">Automatic Backups</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-accent/10 border border-border">
          <div className="pr-4">
            <h4 className="text-sm font-bold">Scheduled daily backup</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Off by default. When enabled, a backup of your organisation&apos;s data runs daily at
              the chosen hour and older backups are pruned automatically.
            </p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} disabled={update.isPending} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={labelClass}>Daily Backup Time</label>
            <select
              value={hour}
              onChange={(e) => setHour(parseInt(e.target.value))}
              disabled={!enabled || update.isPending}
              className={inputClass}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Retention (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={retention}
              onChange={(e) => setRetention(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
              disabled={!enabled || update.isPending}
              className={`${inputClass} font-mono`}
            />
            <p className="text-xs text-muted-foreground">
              Backups older than this are pruned automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button
            onClick={handleSave}
            disabled={!dirty || update.isPending}
            className="gap-2 px-8 shadow-lg shadow-primary/10"
          >
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {update.isPending ? 'Saving…' : 'Save schedule'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BackupsPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  const { data, isLoading } = useBackups(orgSlug);
  const create = useCreateBackup(orgSlug);
  const remove = useDeleteBackup(orgSlug);
  const download = useDownloadBackup(orgSlug);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const backups = data?.backups ?? [];

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Backups</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create, download, and schedule backups of your organisation&apos;s data.
          </p>
        </div>
        <Button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="gap-2 shadow-lg shadow-primary/10"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create backup
        </Button>
      </div>

      <AutoBackupCard orgSlug={orgSlug} />

      {/* Info note */}
      <div className="flex items-start gap-2 p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          These backups contain only your organisation&apos;s data and are visible only to you.
        </p>
      </div>

      {/* Backups table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Stored Backups</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : backups.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <HardDriveDownload className="h-8 w-8 opacity-40" />
              <p className="text-sm">No backups yet. Create one to get started.</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-bold">File</th>
                  <th className="px-6 py-3 font-bold">Size</th>
                  <th className="px-6 py-3 font-bold">Created</th>
                  <th className="px-6 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.name} className="border-b border-border/60 last:border-0 hover:bg-accent/5">
                    <td className="px-6 py-3 font-medium font-mono text-xs break-all">{b.name}</td>
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">{humanSize(b.size)}</td>
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                      {formatCreatedAt(b.created_at)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => download.mutate(b.name)}
                          disabled={download.isPending}
                          title="Download"
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-accent transition-colors disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(b.name)}
                          title="Delete"
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete backup"
        description={`Permanently delete "${pendingDelete ?? ''}"? This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
