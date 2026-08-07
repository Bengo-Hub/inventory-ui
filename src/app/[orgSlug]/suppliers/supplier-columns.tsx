'use client';

// DataTable column definitions for the Suppliers list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Supplier } from '@/lib/api/suppliers';

export const PAYMENT_LABEL: Record<string, string> = {
  mpesa: 'M-Pesa',
  mpesa_b2b: 'M-Pesa B2B',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
};

export interface SupplierColumnCallbacks {
  canChange: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

export function buildSupplierColumns(cb: SupplierColumnCallbacks): DataTableColumn<Supplier>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      sortable: true,
      accessor: (s) => s.name,
      render: (s) => (
        <div>
          <div className="font-medium">{s.name}</div>
          {s.auto_pay_enabled && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Auto-pay enabled</span>
          )}
        </div>
      ),
    },
    {
      key: 'contact_person',
      header: 'Contact',
      hideBelow: 'md',
      accessor: (s) => s.contact_person ?? '—',
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'email',
      header: 'Email',
      hideBelow: 'lg',
      accessor: (s) => s.email ?? '—',
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'sm',
      accessor: (s) => s.phone ?? '—',
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'payment_method_type',
      header: 'Payment',
      hideBelow: 'xl',
      filterable: true,
      accessor: (s) => (s.payment_method_type ? PAYMENT_LABEL[s.payment_method_type] ?? s.payment_method_type : ''),
      render: (s) =>
        s.payment_method_type ? (
          <Badge variant="outline">{PAYMENT_LABEL[s.payment_method_type] ?? s.payment_method_type}</Badge>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        ),
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      filterable: true,
      accessor: (s) => (s.is_active ? 'Active' : 'Inactive'),
      render: (s) => <Badge variant={s.is_active ? 'success' : 'outline'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (supplier) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {cb.canChange && (
            <Button variant="ghost" size="sm" onClick={() => cb.onEdit(supplier)}>
              Edit
            </Button>
          )}
          {cb.canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              title="Delete supplier"
              aria-label="Delete supplier"
              onClick={() => cb.onDelete(supplier)}
              disabled={cb.isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];
}
