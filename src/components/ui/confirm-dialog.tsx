'use client';

import { Button } from './base';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    variant?: 'danger' | 'warning' | 'info';
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    open,
    title,
    description,
    variant = 'info',
    confirmLabel = 'Confirm',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!open) return null;

    const confirmClass =
        variant === 'danger'
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : variant === 'warning'
              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
              : undefined;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-50 w-full max-w-sm mx-4 rounded-xl border border-border bg-card shadow-lg p-6 space-y-4">
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
                <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                        Cancel
                    </Button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex-1 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${confirmClass ?? 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
