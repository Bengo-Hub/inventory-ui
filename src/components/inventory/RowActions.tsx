'use client';

import { Button } from '@/components/ui/base';
import { Eye, Pencil, Printer, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * RowActions — the standard View / Edit / Print / Delete icon cluster used in the Actions
 * column of inventory list/datatable pages. Built ONCE and reused across every list page so
 * the affordances (icon, tooltip, gating, click-stop) stay identical everywhere.
 *
 * Each action is opt-in: pass the handler to render its icon button; omit it to hide.
 * `can*` flags gate the destructive/mutating actions (defaults to true so view/print show
 * by default). Pass `extra` to append page-specific buttons (e.g. Activate, Depreciate)
 * after the standard cluster while keeping the same right-aligned layout.
 */
interface RowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  viewLabel?: string;
  editLabel?: string;
  printLabel?: string;
  deleteLabel?: string;
  deleteDisabled?: boolean;
  /** Page-specific buttons appended after the standard cluster (e.g. Post, Approve). */
  extra?: ReactNode;
}

export function RowActions({
  onView,
  onEdit,
  onPrint,
  onDelete,
  canEdit = true,
  canDelete = true,
  viewLabel = 'View details',
  editLabel = 'Edit',
  printLabel = 'Print / Export PDF',
  deleteLabel = 'Delete',
  deleteDisabled = false,
  extra,
}: RowActionsProps) {
  return (
    <div
      className="flex items-center justify-end gap-1"
      // Stop row-level onClick (e.g. open-drawer) from firing when an action is clicked.
      onClick={(e) => e.stopPropagation()}
    >
      {extra}
      {onView && (
        <Button variant="ghost" size="sm" aria-label="View" title={viewLabel} onClick={onView}>
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {onEdit && canEdit && (
        <Button variant="ghost" size="sm" aria-label="Edit" title={editLabel} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {onPrint && (
        <Button variant="ghost" size="sm" aria-label="Print / Export" title={printLabel} onClick={onPrint}>
          <Printer className="h-4 w-4" />
        </Button>
      )}
      {onDelete && canDelete && (
        <Button
          variant="ghost"
          size="sm"
          aria-label="Delete"
          title={deleteLabel}
          disabled={deleteDisabled}
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
