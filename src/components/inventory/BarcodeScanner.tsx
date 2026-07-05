'use client';

import { Html5Qrcode } from 'html5-qrcode';
import { Loader2, ScanLine, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Camera barcode scanning for inventory-ui.
 *
 * - `BarcodeScannerView` renders a live camera viewport and calls `onScan` with the first
 *   decoded value. Ported from the events QrScanner / library-ui BarcodeScanner (same
 *   html5-qrcode engine, which decodes 1D barcodes — EAN/UPC/Code128 — as well as QR). A
 *   unique element id per instance lets multiple scanners coexist on a page.
 * - `BarcodeScanButton` is the reusable trigger used next to every barcode / SKU field: a
 *   camera icon that opens a modal with the viewport and returns the scanned value. This is
 *   the single component to drop in anywhere barcode entry is needed (New Item, stock take,
 *   adjustments, stock search, goods receipts, transfers …).
 */
export function BarcodeScannerView({
  onScan,
  hint = 'Point the camera at the barcode.',
}: {
  onScan: (text: string) => void;
  hint?: string;
}) {
  const rawId = useId();
  const elementId = `barcode-reader-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let active = true;
    const scanner = new Html5Qrcode(elementId, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 170 } },
        (decoded) => {
          if (!active || scannedRef.current) return;
          scannedRef.current = true;
          onScan(decoded.trim());
        },
        () => {
          /* per-frame decode failures are normal; ignore */
        },
      )
      .then(() => active && setStatus('scanning'))
      .catch((err: unknown) => {
        if (!active) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unable to access the camera');
      });

    return () => {
      active = false;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          id={elementId}
          className="overflow-hidden rounded-2xl border border-border bg-black/90 aspect-video w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_img]:hidden"
        />
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Requesting camera…</span>
          </div>
        )}
      </div>
      {status === 'error' ? (
        <p className="text-xs text-destructive">
          Camera unavailable ({error}). Grant camera permission or type the value manually.
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * BarcodeScanButton — camera-scan trigger + modal. Drop next to any barcode / SKU input:
 *
 *   <BarcodeScanButton onScan={(code) => setBarcode(code)} />
 *
 * `variant="icon"` (default) renders a compact square button to sit inside/next to an input;
 * `variant="button"` renders a labelled button for toolbars.
 */
export function BarcodeScanButton({
  onScan,
  title = 'Scan barcode',
  hint,
  disabled,
  variant = 'icon',
  className = '',
}: {
  onScan: (value: string) => void;
  title?: string;
  hint?: string;
  disabled?: boolean;
  variant?: 'icon' | 'button';
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function handleScan(value: string) {
    onScan(value);
    setOpen(false);
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          title={title}
          aria-label={title}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none ${className}`}
        >
          <ScanLine className="h-4.5 w-4.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          title={title}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-primary/40 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none ${className}`}
        >
          <ScanLine className="h-4 w-4" /> Scan
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-[60] w-full max-w-md mx-4 rounded-2xl bg-card border border-border shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">{title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <BarcodeScannerView onScan={handleScan} hint={hint} />
          </div>
        </div>
      )}
    </>
  );
}
