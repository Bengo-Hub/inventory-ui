'use client';

import { Button } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { itemsApi, type ItemImage } from '@/lib/api/items';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Image as ImageIcon, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

interface Props {
  orgSlug: string;
  /** Existing item id. When absent (create mode) the manager falls back to a single
   *  primary-image upload reported via onPrimaryChange so the create payload keeps image_url. */
  itemId?: string;
  /** Current primary image URL (legacy single-image fallback for create mode). */
  primaryUrl?: string;
  /** Called when the primary image changes (create-mode single-image fallback). */
  onPrimaryChange?: (url: string) => void;
}

/**
 * ItemImagesManager renders the multi-image gallery for a catalog item: a grid of
 * thumbnails with set-primary / reorder / delete controls plus an "add" tile. It is
 * subscription-aware — the backend returns 403 (feature locked) / 402 (per-item cap) on
 * the 2nd+ image, surfaced here as a toast. In create mode (no itemId) it degrades to the
 * legacy single-image upload so the new item still saves an image_url.
 */
export function ItemImagesManager({ orgSlug, itemId, primaryUrl, onPrimaryChange }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['item-images', orgSlug, itemId],
    queryFn: () => itemsApi.listImages(orgSlug, itemId as string),
    enabled: !!itemId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['item-images', orgSlug, itemId] });
    queryClient.invalidateQueries({ queryKey: ['items', orgSlug] });
  }

  // Map a backend error (axios) to a friendly message for the toast.
  function describeError(err: unknown): string {
    const e = err as { response?: { status?: number; data?: { code?: string; message?: string } } };
    const status = e?.response?.status;
    const code = e?.response?.data?.code;
    if (status === 403 || code === 'feature_not_available') {
      return 'Your plan does not include multiple product images. Upgrade to add more.';
    }
    if (status === 402 || code === 'usage_limit_exceeded') {
      return 'Image limit reached for your plan.';
    }
    return e?.response?.data?.message ?? 'Image operation failed';
  }

  function validateFile(file: File): boolean {
    if (!file.type.startsWith('image/')) {
      toast.error('Only JPEG or PNG images are allowed');
      return false;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image must be under 2 MB');
      return false;
    }
    return true;
  }

  async function handleFile(file: File) {
    if (!validateFile(file)) return;
    setUploading(true);
    try {
      if (itemId) {
        // The first image becomes primary automatically; mark explicitly when the gallery is empty.
        await itemsApi.uploadImage(orgSlug, itemId, file, images.length === 0);
        invalidate();
      } else {
        // Create mode: no item id yet — fall back to the legacy media upload and report the URL
        // up so the create payload carries image_url (becomes the primary asset server-side).
        const form = new FormData();
        form.append('file', file);
        const res = await apiClient.post<{ url: string }>('/api/v1/media/upload', form);
        onPrimaryChange?.(res.url);
      }
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function setPrimary(img: ItemImage) {
    if (!itemId || img.is_primary) return;
    setBusyId(img.id);
    try {
      await itemsApi.updateImage(orgSlug, itemId, img.id, { is_primary: true });
      invalidate();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function reorder(img: ItemImage, dir: -1 | 1) {
    if (!itemId) return;
    const idx = images.findIndex((i) => i.id === img.id);
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const other = images[target];
    setBusyId(img.id);
    try {
      // Swap display_order between the two neighbours.
      await itemsApi.updateImage(orgSlug, itemId, img.id, { display_order: other.display_order });
      await itemsApi.updateImage(orgSlug, itemId, other.id, { display_order: img.display_order });
      invalidate();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(img: ItemImage) {
    if (!itemId) {
      onPrimaryChange?.('');
      return;
    }
    setBusyId(img.id);
    try {
      await itemsApi.deleteImage(orgSlug, itemId, img.id);
      invalidate();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  // ── Create mode: single-image fallback ────────────────────────────────────
  if (!itemId) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Item Image</label>
        <div className="flex items-center gap-3">
          {primaryUrl ? (
            <div className="relative h-16 w-16 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={primaryUrl} alt="Item" className="h-16 w-16 rounded-lg object-cover border border-input" />
              <button
                type="button"
                onClick={() => onPrimaryChange?.('')}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-input flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading…</> : 'Upload Image'}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">JPEG or PNG · max 2 MB. Save the item to add more images.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit mode: full multi-image gallery ───────────────────────────────────
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Item Images</label>
      <div className="flex flex-wrap gap-3">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {images.map((img, idx) => (
          <div key={img.id} className="relative h-24 w-24 group rounded-lg border border-input overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.file_name ?? 'Item image'} className="h-full w-full object-cover" />
            {img.is_primary && (
              <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-foreground">
                <Star className="h-2.5 w-2.5 fill-current" /> Primary
              </span>
            )}
            {busyId === img.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-0.5 bg-background/80 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" title="Move left" disabled={idx === 0 || !!busyId} onClick={() => reorder(img, -1)} className="p-0.5 disabled:opacity-30">
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              {!img.is_primary && (
                <button type="button" title="Set as primary" disabled={!!busyId} onClick={() => setPrimary(img)} className="p-0.5">
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button type="button" title="Delete" disabled={!!busyId} onClick={() => remove(img)} className="p-0.5 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Move right" disabled={idx === images.length - 1 || !!busyId} onClick={() => reorder(img, 1)} className="p-0.5 disabled:opacity-30">
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {/* Add tile */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="h-24 w-24 rounded-lg border border-dashed border-input flex flex-col items-center justify-center text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-5 w-5" /><span className="text-[10px] mt-1">Add image</span></>}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      </div>
      <p className="text-xs text-muted-foreground">JPEG or PNG · max 2 MB each. Set a primary image and drag-free reorder with the arrows. Higher plans allow more images per product.</p>
    </div>
  );
}
