'use client';

import { Input } from '@/components/ui/base';
import { ADJUSTMENT_BACKDATE_DAYS } from '@/lib/adjustment-date';
import { localDateInput } from '@/lib/utils';

interface AdjustmentDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * The date a stock adjustment counts under. Today (the default) is a normal adjustment; an earlier
 * day back-dates it, so it sits on that day in stock history, the Adjustments list and reports
 * instead of on top under today. Never a future date. Shared by the Adjustments page and the
 * stock drawer so the wording and bounds stay in one place.
 */
export function AdjustmentDateField({ value, onChange, className }: AdjustmentDateFieldProps) {
  return (
    <div className={className ?? 'space-y-2'}>
      <label className="text-sm font-medium">Adjustment date</label>
      <Input
        type="date"
        value={value}
        min={localDateInput(-ADJUSTMENT_BACKDATE_DAYS)}
        max={localDateInput(0)}
        onChange={(e) => onChange(e.target.value || localDateInput(0))}
      />
      <p className="text-xs text-muted-foreground">
        Leave as today for a normal adjustment. Pick an earlier day if the stock moved then: it will appear on that day in
        stock history and reports.
      </p>
    </div>
  );
}
