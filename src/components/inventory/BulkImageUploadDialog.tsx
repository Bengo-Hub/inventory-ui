'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, RotateCcw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Badge, Button, Card } from '@/components/ui/base';
import { apiErrorMessage } from '@/lib/api/error-message';
import { IMAGE_MATCH_PAGE, itemsApi, type ImageMatchCandidate, type ImageMatchKind } from '@/lib/api/items';
import { compressImage } from '@/lib/inventory/compress-image';

/** Files sent at the same time; enough to keep the line busy without flooding the API. */
const UPLOAD_CONCURRENCY = 3;

type RowStatus = 'ready' | 'uploading' | 'done' | 'failed';

interface Row {
  key: string;
  original: File;
  file?: File;
  preview: string;
  kind: ImageMatchKind;
  score: number;
  candidates: ImageMatchCandidate[];
  itemId: string;
  itemLabel: string;
  hasImage: boolean;
  include: boolean;
  status: RowStatus;
  error?: string;
}

const KIND_LABEL: Record<ImageMatchKind, { text: string; variant: 'success' | 'warning' | 'error' | 'outline' }> = {
  sku: { text: 'SKU', variant: 'success' },
  barcode: { text: 'Barcode', variant: 'success' },
  exact: { text: 'Same name', variant: 'success' },
  similar: { text: 'Check', variant: 'warning' },
  none: { text: 'No match', variant: 'outline' },
};

const CERTAIN: ImageMatchKind[] = ['sku', 'barcode', 'exact'];

function candidateOption(c: ImageMatchCandidate): ComboboxOption {
  return {
    value: c.item_id,
    label: c.name,
    hint: c.sku,
    description: c.has_image ? 'Already has a picture' : c.is_active ? undefined : 'Inactive item',
  };
}

/**
 * BulkImageUploadDialog adds pictures to many items at once. The person picks photos (named
 * after the item, its SKU or its barcode), the browser shrinks them, inventory-api suggests the
 * item for each file, the person checks the pairs, then each photo goes through the normal
 * per-item upload, so plan limits, re-encoding and storage rules are the same as one by one.
 * Items that already have a picture are left alone; change those from the item page.
 */
export function BulkImageUploadDialog({ orgSlug, onClose }: { orgSlug: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<'pick' | 'preparing' | 'review' | 'uploading' | 'done'>('pick');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dragging, setDragging] = useState(false);
  // has_image for items picked through search, which the match response did not cover.
  const imageKnown = useRef(new Map<string, boolean>());

  // Free the preview URLs when the dialog goes away.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  useEffect(() => () => rowsRef.current.forEach((r) => URL.revokeObjectURL(r.preview)), []);

  const update = useCallback((key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  async function prepare(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      toast.error('Pick image files (JPEG, PNG or WebP)');
      return;
    }
    setPhase('preparing');
    setProgress({ done: 0, total: images.length });

    const prepared: Row[] = [];
    for (const original of images) {
      const row: Row = {
        key: `${original.name}-${original.size}-${original.lastModified}`,
        original,
        preview: URL.createObjectURL(original),
        kind: 'none',
        score: 0,
        candidates: [],
        itemId: '',
        itemLabel: '',
        hasImage: false,
        include: false,
        status: 'ready',
      };
      try {
        row.file = await compressImage(original);
      } catch {
        row.status = 'failed';
        row.error = 'Not readable as an image';
      }
      prepared.push(row);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    try {
      for (let i = 0; i < prepared.length; i += IMAGE_MATCH_PAGE) {
        const page = prepared.slice(i, i + IMAGE_MATCH_PAGE);
        const matches = await itemsApi.matchImages(orgSlug, page.map((r) => r.original.name));
        matches.forEach((m, j) => {
          const row = page[j];
          if (!row || !m.match) return;
          row.kind = m.kind;
          row.score = m.match.score;
          row.candidates = [m.match, ...m.alternatives];
          row.itemId = m.match.item_id;
          row.itemLabel = m.match.name;
          row.hasImage = m.match.has_image;
          row.include = row.status === 'ready' && CERTAIN.includes(m.kind) && !m.match.has_image;
        });
      }
    } catch (e) {
      toast.error(await apiErrorMessage(e, 'Could not match the files to items'));
    }
    setRows(prepared);
    setPhase('review');
  }

  // An item takes one picture per run; a second file for the same item is flagged.
  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const r of rows) {
      if (!r.include || !r.itemId) continue;
      if (seen.has(r.itemId)) dupes.add(r.key);
      else seen.add(r.itemId);
    }
    return dupes;
  }, [rows]);

  const counts = useMemo(() => {
    const c = { included: 0, check: 0, none: 0, hasImage: 0, done: 0, failed: 0 };
    for (const r of rows) {
      if (r.include) c.included++;
      if (r.kind === 'similar' && !r.include && !r.hasImage) c.check++;
      if (!r.itemId) c.none++;
      if (r.hasImage) c.hasImage++;
      if (r.status === 'done') c.done++;
      if (r.status === 'failed') c.failed++;
    }
    return c;
  }, [rows]);

  async function upload(onlyFailed = false) {
    const queue = rows.filter((r) =>
      r.include && r.itemId && r.file && !duplicateKeys.has(r.key) && (onlyFailed ? r.status === 'failed' : r.status === 'ready'),
    );
    if (queue.length === 0) return;
    setPhase('uploading');
    setProgress({ done: 0, total: queue.length });
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const row = queue[next++];
        update(row.key, { status: 'uploading', error: undefined });
        try {
          await itemsApi.uploadImage(orgSlug, row.itemId, row.file as File);
          update(row.key, { status: 'done' });
        } catch (e) {
          update(row.key, { status: 'failed', error: await apiErrorMessage(e, 'Upload failed') });
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker));
    queryClient.invalidateQueries({ queryKey: ['items', orgSlug] });
    setPhase('done');
  }

  const searchItems = useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      const res = await itemsApi.list(orgSlug, { search: query, limit: 20, status: 'all' });
      return res.data.map((it) => {
        imageKnown.current.set(it.id, !!it.image_url);
        return { value: it.id, label: it.name, hint: it.sku, description: it.image_url ? 'Already has a picture' : undefined };
      });
    },
    [orgSlug],
  );

  function chooseItem(row: Row, value: string, option?: ComboboxOption) {
    if (!value) {
      update(row.key, { itemId: '', itemLabel: '', include: false, hasImage: false });
      return;
    }
    const known = row.candidates.find((c) => c.item_id === value);
    const hasImage = known ? known.has_image : imageKnown.current.get(value) ?? false;
    update(row.key, {
      itemId: value,
      itemLabel: option?.label ?? known?.name ?? '',
      hasImage,
      include: !hasImage && !!row.file,
    });
  }

  function startOver() {
    rows.forEach((r) => URL.revokeObjectURL(r.preview));
    setRows([]);
    setPhase('pick');
  }

  const busy = phase === 'preparing' || phase === 'uploading';
  const uploadable = counts.included - duplicateKeys.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={busy ? undefined : onClose} />
      <div className="relative z-50 mx-4 flex max-h-[90dvh] w-full max-w-4xl flex-col">
        <Card className="flex min-h-0 flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Upload item pictures</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Name each photo after its item, SKU or barcode. Photos are shrunk on this device before upload.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {phase === 'pick' && (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void prepare(Array.from(e.dataTransfer.files)); }}
              className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/40'}`}
            >
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
              <span className="font-medium">Drop photos here or choose files</span>
              <span className="text-xs text-muted-foreground">JPEG, PNG or WebP of any size. Large photos are reduced to 1600 px.</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => { if (e.target.files) void prepare(Array.from(e.target.files)); }}
              />
            </label>
          )}

          {busy && (
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === 'preparing' ? 'Shrinking and matching photos' : 'Uploading'} {progress.done} of {progress.total}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {rows.length > 0 && phase !== 'preparing' && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="success">{counts.included} selected</Badge>
                {counts.check > 0 && <Badge variant="warning">{counts.check} to check</Badge>}
                {counts.none > 0 && <Badge variant="outline">{counts.none} without a match</Badge>}
                {counts.hasImage > 0 && <Badge variant="outline">{counts.hasImage} already have a picture</Badge>}
                {phase === 'done' && <Badge variant="success">{counts.done} uploaded</Badge>}
                {counts.failed > 0 && <Badge variant="error">{counts.failed} failed</Badge>}
                {phase === 'review' && counts.check > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRows((prev) => prev.map((r) => (r.kind === 'similar' && r.itemId && r.file && !r.hasImage && r.status === 'ready' ? { ...r, include: true } : r)))}
                  >
                    Select the ones to check
                  </Button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
                <ul className="divide-y">
                  {rows.map((r) => {
                    const dupe = duplicateKeys.has(r.key);
                    return (
                      <li key={r.key} className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex min-w-0 items-center gap-3 sm:w-64">
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0"
                            checked={r.include}
                            disabled={phase !== 'review' || !r.itemId || r.hasImage || !r.file}
                            onChange={(e) => update(r.key, { include: e.target.checked })}
                            aria-label={`Upload ${r.original.name}`}
                          />
                          <img src={r.preview} alt="" className="h-11 w-11 shrink-0 rounded-md border object-cover" />
                          <span className="truncate text-sm" title={r.original.name}>{r.original.name}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <SearchableCombobox
                            options={r.candidates.map(candidateOption)}
                            value={r.itemId}
                            valueLabel={r.itemLabel}
                            onChange={(v, o) => chooseItem(r, v, o)}
                            onRemoteSearch={searchItems}
                            placeholder="Pick the item"
                            searchPlaceholder="Search items by name or SKU"
                            disabled={phase !== 'review'}
                            clearable
                          />
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:w-44 sm:justify-end">
                          {r.status === 'done' && <Badge variant="success">Uploaded</Badge>}
                          {r.status === 'uploading' && <Badge variant="outline">Uploading</Badge>}
                          {r.status === 'failed' && <Badge variant="error">{r.error ?? 'Failed'}</Badge>}
                          {r.status === 'ready' && dupe && <Badge variant="error">Same item as another photo</Badge>}
                          {r.status === 'ready' && !dupe && r.hasImage && <Badge variant="outline">Has a picture</Badge>}
                          {r.status === 'ready' && !dupe && !r.hasImage && (
                            <Badge variant={KIND_LABEL[r.kind].variant}>
                              {KIND_LABEL[r.kind].text}
                              {r.kind === 'similar' ? ` ${Math.round(r.score * 100)}%` : ''}
                            </Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {phase === 'review' && (
              <Button variant="outline" onClick={startOver}>Choose other photos</Button>
            )}
            {phase === 'done' && counts.failed > 0 && (
              <Button variant="outline" onClick={() => void upload(true)}>
                <RotateCcw className="mr-1.5 h-4 w-4" />Retry failed
              </Button>
            )}
            {phase === 'review' ? (
              <Button onClick={() => void upload()} disabled={uploadable <= 0 || duplicateKeys.size > 0}>
                <Upload className="mr-1.5 h-4 w-4" />
                {uploadable > 0 ? `Upload ${uploadable} ${uploadable === 1 ? 'picture' : 'pictures'}` : 'Upload pictures'}
              </Button>
            ) : (
              <Button variant={phase === 'done' ? 'primary' : 'outline'} onClick={onClose} disabled={busy}>
                {phase === 'done' ? 'Done' : 'Cancel'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
