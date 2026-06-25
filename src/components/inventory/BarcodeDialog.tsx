'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui/base';
import { barcodeApi } from '@/lib/api/barcode';
import type { Item } from '@/lib/api/items';
import { Download, Printer, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * BarcodeDialog — shows a single item's barcode (PNG) with download + print actions.
 * The PNG is fetched as a Blob (so auth/tenant headers ride along) and shown via an
 * object URL. The backend lazily generates + stores an internal EAN-13 if the item
 * has no barcode yet.
 */
export function BarcodeDialog({
  orgSlug,
  item,
  onClose,
}: {
  orgSlug: string;
  item: Item;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let active = true;
    setLoading(true);
    setError(false);
    barcodeApi
      .itemBarcodePng(orgSlug, item.id)
      .then((blob) => {
        if (!active) return;
        const objUrl = URL.createObjectURL(blob);
        revoked = objUrl;
        setUrl(objUrl);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [orgSlug, item.id]);

  function download() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.sku}-barcode.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function print() {
    if (!url) return;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Popup blocked — allow popups to print');
      return;
    }
    w.document.write(
      `<html><head><title>${item.sku}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${url}" style="max-width:90%" onload="window.print()" /></body></html>`,
    );
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md mx-4">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Barcode</h3>
              <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center justify-center min-h-[160px] rounded-lg border border-border bg-white p-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Generating…</p>
            ) : error ? (
              <p className="text-sm text-destructive">Couldn&apos;t generate a barcode for this item.</p>
            ) : url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={`Barcode for ${item.sku}`} className="max-w-full" />
            ) : null}
          </div>

          {item.barcode && (
            <p className="text-center text-xs text-muted-foreground">
              {item.barcode_type || 'Code'} · <span className="font-mono">{item.barcode}</span>
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={download} disabled={!url}>
              <Download className="h-4 w-4 mr-1.5" /> Download
            </Button>
            <Button className="flex-1" onClick={print} disabled={!url}>
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
