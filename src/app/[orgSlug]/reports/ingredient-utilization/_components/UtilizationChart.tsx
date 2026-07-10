'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StockLevelEventDTO, TimeseriesPoint, UtilizationGranularity } from '@/lib/api/reports';

// Fixed categorical order — never cycled/regenerated per render, matches the palette already
// used for the dashboard's category donut (DashboardCharts.tsx). A recipe beyond the 6th
// falls into "Other" rather than growing the palette.
const SERIES_COLORS = ['#F77F00', '#C44B17', '#D4843A', '#C8A06A', '#D4AF37', '#8B6914'];
const OTHER_COLOR = '#8A8578';
const MAX_SERIES = 6;

// Phase-band colors are a status palette, deliberately distinct from SERIES_COLORS above so
// "which recipe" and "was stock healthy" are never confused as the same kind of color.
const PHASE_COLOR: Record<string, string> = {
  normal: '#2E9E5B',
  low: '#D69E2E',
  out: '#D64545',
};
const PHASE_LABEL: Record<string, string> = {
  normal: 'Above reorder level',
  low: 'Below reorder level',
  out: 'Stocked out',
};

function bucketLabel(point: TimeseriesPoint, granularity: UtilizationGranularity): string {
  const start = new Date(point.bucket_start);
  if (granularity === 'day') return start.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const end = new Date(point.bucket_end);
  end.setDate(end.getDate() - 1);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return granularity === 'month' ? start.toLocaleDateString('en', { month: 'short', year: '2-digit' }) : `${startLabel}–${endLabel}`;
}

interface PhaseSegment {
  state: 'normal' | 'low' | 'out';
  widthPct: number;
}

function computePhaseSegments(events: StockLevelEventDTO[], rangeStart: Date, rangeEnd: Date): PhaseSegment[] {
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  if (totalMs <= 0) return [];
  const sorted = [...events].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  const boundaries = [rangeStart, ...sorted.map((e) => new Date(e.occurred_at)), rangeEnd];

  let state: PhaseSegment['state'] = 'normal';
  const segments: PhaseSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const widthPct = Math.max(0, ((boundaries[i + 1].getTime() - boundaries[i].getTime()) / totalMs) * 100);
    if (widthPct > 0.01) segments.push({ state, widthPct });
    const ev = sorted[i];
    if (ev) state = ev.event_type === 'restocked' ? 'normal' : ev.event_type === 'low' ? 'low' : 'out';
  }
  return segments;
}

interface UtilizationChartProps {
  points: TimeseriesPoint[];
  events: StockLevelEventDTO[];
  granularity: UtilizationGranularity;
  rangeStart: string;
  rangeEnd: string;
  unit?: string;
  loading: boolean;
}

export function UtilizationChart({ points, events, granularity, rangeStart, rangeEnd, unit, loading }: UtilizationChartProps) {
  if (loading) return <div className="h-72 skeleton rounded-xl" />;
  if (points.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
        No consumption recorded for this ingredient in the selected period.
      </div>
    );
  }

  // Rank recipes by total quantity across the whole range so the fixed color order is
  // meaningful (busiest recipe always gets the first, most-legible color).
  const totals = new Map<string, number>();
  for (const point of points) {
    for (const slice of point.by_recipe) {
      const name = slice.recipe_name || 'Direct sale';
      totals.set(name, (totals.get(name) ?? 0) + slice.quantity);
    }
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const topSeries = ranked.slice(0, MAX_SERIES);
  const hasOther = ranked.length > MAX_SERIES;

  const rows = points.map((point) => {
    const row: Record<string, string | number> = { label: bucketLabel(point, granularity) };
    for (const name of topSeries) row[name] = 0;
    if (hasOther) row.Other = 0;
    for (const slice of point.by_recipe) {
      const name = slice.recipe_name || 'Direct sale';
      const key = topSeries.includes(name) ? name : 'Other';
      row[key] = (Number(row[key]) || 0) + slice.quantity;
    }
    return row;
  });

  const segments = computePhaseSegments(events, new Date(rangeStart), new Date(rangeEnd));

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            label={unit ? { value: unit, angle: -90, position: 'insideLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' } : undefined}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.75rem',
              fontSize: 12,
              color: 'hsl(var(--foreground))',
            }}
            formatter={(v, name) => [`${Number(v).toLocaleString()} ${unit ?? ''}`.trim(), String(name)]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: 11, color: 'hsl(var(--foreground))' }}>{value}</span>}
          />
          {topSeries.map((name, i) => (
            <Bar key={name} dataKey={name} stackId="recipe" fill={SERIES_COLORS[i]} radius={i === topSeries.length - 1 && !hasOther ? [3, 3, 0, 0] : 0} />
          ))}
          {hasOther && <Bar dataKey="Other" stackId="recipe" fill={OTHER_COLOR} radius={[3, 3, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>

      {segments.length > 0 && (
        <div className="mt-2">
          <div className="flex h-2 rounded-full overflow-hidden ring-1 ring-border">
            {segments.map((seg, i) => (
              <div key={i} style={{ width: `${seg.widthPct}%`, backgroundColor: PHASE_COLOR[seg.state] }} title={PHASE_LABEL[seg.state]} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {(['normal', 'low', 'out'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PHASE_COLOR[s] }} />
                {PHASE_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
