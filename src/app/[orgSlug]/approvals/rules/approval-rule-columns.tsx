'use client';

// DataTable column definitions for the Approval Rules list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { ApprovalRule } from '@/lib/api/approvals';

export interface ApprovalRuleColumnCallbacks {
  canChange: boolean;
  canDelete: boolean;
  moduleLabel: (m: string) => string;
  roleLabel: (code: string) => string;
  band: (rule: ApprovalRule) => string;
  onEdit: (rule: ApprovalRule) => void;
  onDelete: (rule: ApprovalRule) => void;
}

export function buildApprovalRuleColumns(cb: ApprovalRuleColumnCallbacks): DataTableColumn<ApprovalRule>[] {
  return [
    {
      key: 'name',
      header: 'Rule',
      primary: true,
      sortable: true,
      accessor: (r) => r.name,
      cellClassName: 'font-medium',
    },
    {
      key: 'module',
      header: 'Module',
      filterable: true,
      accessor: (r) => cb.moduleLabel(r.module),
    },
    {
      key: 'band',
      header: 'Amount Band',
      accessor: (r) => cb.band(r),
      cellClassName: 'tabular-nums',
    },
    {
      key: 'steps',
      header: 'Steps',
      hideBelow: 'md',
      accessor: (r) => r.steps.length,
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.steps.map((s) => (
            <Badge key={s.id ?? s.sequence} variant="outline">{s.sequence}. {cb.roleLabel(s.approver_role)}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Active',
      filterable: true,
      accessor: (r) => (r.is_active ? 'Active' : 'Inactive'),
      render: (r) => <Badge variant={r.is_active ? 'success' : 'outline'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (rule) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {cb.canChange && <Button variant="ghost" size="sm" onClick={() => cb.onEdit(rule)}>Edit</Button>}
          {cb.canDelete && (
            <Button variant="ghost" size="sm" aria-label="Delete rule" className="text-destructive hover:text-destructive" onClick={() => cb.onDelete(rule)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];
}
