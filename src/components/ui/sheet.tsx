'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const widthClass = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Sheet({ open, onClose, title, children, width = 'md' }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full ${widthClass[width]} bg-background shadow-2xl flex flex-col overflow-hidden
          animate-in slide-in-from-right duration-300`}
      >
        {title && (
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </SheetHeader>
        )}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SheetHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
      {children}
    </div>
  );
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-foreground">{children}</h2>;
}

export function SheetContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 space-y-5 ${className}`}>{children}</div>;
}
