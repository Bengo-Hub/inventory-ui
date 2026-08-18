'use client';

import { Button } from '@/components/ui/base';
import { ChevronDown, FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type DocFormat = 'pdf' | 'xlsx' | 'csv';

/**
 * Format picker for a document button (e.g. "Purchase Order", "Goods Received Note") — opens a
 * small menu of PDF (preview) / Excel / CSV (download) instead of a single fixed format. Every
 * document export button in the app should use this instead of a bare PDF-only <Button>, now that
 * inventory-api serves ?format=pdf|csv|xlsx on every document endpoint.
 *
 * Self-contained (no shared dropdown primitive exists in this app) with the same ref+mousedown
 * click-outside pattern used by TaxCodeCombobox/EtimsCodeSelect.
 */
export function DocFormatMenu({
    label, disabled, onSelect,
}: {
    label: string;
    disabled?: boolean;
    onSelect: (format: DocFormat) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    function pick(format: DocFormat) {
        setOpen(false);
        onSelect(format);
    }

    return (
        <div className="relative inline-block" ref={ref}>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => setOpen((v) => !v)}>
                {label}<ChevronDown className="h-3.5 w-3.5 ml-1.5" />
            </Button>
            {open && (
                <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-border bg-popover shadow-lg py-1">
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent" onClick={() => pick('pdf')}>
                        <FileText className="h-3.5 w-3.5" /> PDF
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent" onClick={() => pick('xlsx')}>
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent" onClick={() => pick('csv')}>
                        <FileDown className="h-3.5 w-3.5" /> CSV
                    </button>
                </div>
            )}
        </div>
    );
}
