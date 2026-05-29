'use client';

import { type RecurrenceConfig } from '@/lib/api/items';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_LABELS = ['1st', '2nd', '3rd', '4th', 'Last'];
const WEEK_NUMS = [1, 2, 3, 4, -1];

export function generateRecurrencePattern(rc: RecurrenceConfig): string {
  const at = rc.time ? ` at ${rc.time}` : '';
  switch (rc.type) {
    case 'daily': return `Daily${at}`;
    case 'weekly': {
      const dayNames = (rc.days ?? []).map((d) => DAYS_SHORT[d]).join(', ');
      return `Weekly on ${dayNames || '—'}${at}`;
    }
    case 'monthly': {
      if (rc.monthDay) return `Monthly on the ${rc.monthDay}th${at}`;
      const wn = WEEK_LABELS[WEEK_NUMS.indexOf(rc.weekNum ?? 1)] ?? '1st';
      const wd = DAYS_SHORT[rc.weekDay ?? 0];
      return `Monthly on the ${wn} ${wd}${at}`;
    }
    case 'yearly': {
      const m = MONTHS_SHORT[(rc.yearMonth ?? 1) - 1];
      return `Yearly on ${m} ${rc.yearDay ?? 1}${at}`;
    }
    default: return '';
  }
}

const sel =
  'rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

interface Props {
  value: RecurrenceConfig | null;
  onChange: (v: RecurrenceConfig | null) => void;
}

export function RecurrenceEditor({ value, onChange }: Props) {
  const type = value?.type ?? 'none';

  function setType(t: string) {
    if (t === 'none') { onChange(null); return; }
    const base = { type: t as RecurrenceConfig['type'], time: value?.time ?? '10:00' };
    if (t === 'daily') onChange(base);
    else if (t === 'weekly') onChange({ ...base, days: [5] });
    else if (t === 'monthly') onChange({ ...base, monthDay: 1 });
    else onChange({ ...base, yearMonth: 1, yearDay: 1 });
  }

  function patch(p: Partial<RecurrenceConfig>) {
    if (!value) return;
    onChange({ ...value, ...p });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium whitespace-nowrap">Recurrence</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className={sel}>
          <option value="none">None (one-time event)</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        {value && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">at</label>
            <input
              type="time"
              value={value.time ?? '10:00'}
              onChange={(e) => patch({ time: e.target.value })}
              className={sel}
            />
          </div>
        )}
      </div>

      {type === 'weekly' && (
        <div className="flex flex-wrap gap-1.5">
          {DAYS_SHORT.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                const cur = value?.days ?? [];
                const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
                patch({ days: next.sort() });
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                (value?.days ?? []).includes(i)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {type === 'monthly' && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={value?.weekNum != null ? 'weekday' : 'date'}
            onChange={(e) => {
              if (e.target.value === 'date') patch({ monthDay: 1, weekNum: undefined, weekDay: undefined });
              else patch({ weekNum: 1, weekDay: 1, monthDay: undefined });
            }}
            className={sel}
          >
            <option value="date">Day of month</option>
            <option value="weekday">Day of week</option>
          </select>
          {value?.weekNum == null ? (
            <input
              type="number"
              min="1"
              max="31"
              value={value?.monthDay ?? 1}
              onChange={(e) => patch({ monthDay: parseInt(e.target.value, 10) || 1 })}
              className={`${sel} w-20`}
            />
          ) : (
            <>
              <select
                value={value.weekNum}
                onChange={(e) => patch({ weekNum: parseInt(e.target.value, 10) })}
                className={sel}
              >
                {WEEK_NUMS.map((n, i) => (
                  <option key={n} value={n}>{WEEK_LABELS[i]}</option>
                ))}
              </select>
              <select
                value={value.weekDay ?? 0}
                onChange={(e) => patch({ weekDay: parseInt(e.target.value, 10) })}
                className={sel}
              >
                {DAYS_SHORT.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {type === 'yearly' && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={value?.yearMonth ?? 1}
            onChange={(e) => patch({ yearMonth: parseInt(e.target.value, 10) })}
            className={sel}
          >
            {MONTHS_SHORT.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="31"
            value={value?.yearDay ?? 1}
            onChange={(e) => patch({ yearDay: parseInt(e.target.value, 10) || 1 })}
            className={`${sel} w-20`}
          />
        </div>
      )}

      {value && (
        <p className="text-xs text-muted-foreground italic">{generateRecurrencePattern(value)}</p>
      )}
    </div>
  );
}
