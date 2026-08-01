import type { LabelPrintOpts } from '@/lib/api/barcode';

/**
 * Centralized label-print preferences — the physical template/format/rotate/printer choice a
 * user last made in PrintLabelsDialog (bulk), persisted so the quick single-item "Barcode"
 * action (BarcodeDialog) reuses the SAME resolved template instead of its own hardcoded default.
 *
 * Before this existed, BarcodeDialog always called the label.pdf endpoint bare (no template/
 * rotate/format), so a bulk print job fixed to print correctly on a given roll could still come
 * out rotated/misaligned from the single-item quick-print button — the two paths silently
 * diverged. localStorage (not React state) because these two dialogs don't share a parent
 * component in this app.
 */
const KEY = 'inventory.labelPrintPrefs.v1';

export interface LabelPrintPrefs extends LabelPrintOpts {
  printerName?: string;
}

const DEFAULT_PREFS: LabelPrintPrefs = { format: 'avery_a4' };

export function getLabelPrintPrefs(): LabelPrintPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setLabelPrintPrefs(prefs: LabelPrintPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable (private browsing, quota) — prefs just won't persist this session
  }
}
