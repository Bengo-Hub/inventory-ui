'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/base';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StockTrendPoint, CategoryDistribution, ReorderAlert, TopItem } from '@/lib/api/analytics';
import Link from 'next/link';
import { AlertTriangle, TrendingUp, ArrowUpRight } from 'lucide-react';

const CHART_COLORS = ['#F77F00', '#C44B17', '#D4843A', '#C8A06A', '#D4AF37', '#8B6914', '#7C3A00'];

// ─── Stock Trends Chart ────────────────────────────────────────────────────────

interface StockTrendsChartProps {
  data: StockTrendPoint[];
  loading: boolean;
}

export function StockTrendsChart({ data, loading }: StockTrendsChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  }));

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Stock Movement (30 days)</h2>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="h-56 skeleton rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={formatted} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.75rem',
                  fontSize: 12,
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Line
                type="monotone"
                dataKey="total_units"
                stroke="#F77F00"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#F77F00' }}
                name="Units"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Distribution Donut Chart ──────────────────────────────────────────────────

interface DistributionChartProps {
  data: CategoryDistribution[];
  loading: boolean;
}

export function DistributionChart({ data, loading }: DistributionChartProps) {
  const top6 = data.slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold">By Category</h2>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="h-56 skeleton rounded-xl" />
        ) : top6.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            No stock data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={top6}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="total_units"
                nameKey="category_name"
              >
                {top6.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.75rem',
                  fontSize: 12,
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(v, name) => [`${Number(v).toLocaleString()} units`, String(name)]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ fontSize: 11, color: 'hsl(var(--foreground))' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Reorder Alerts Table ──────────────────────────────────────────────────────

interface ReorderAlertsTableProps {
  data: ReorderAlert[];
  loading: boolean;
  orgSlug: string;
}

export function ReorderAlertsTable({ data, loading, orgSlug }: ReorderAlertsTableProps) {
  const top5 = data.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-semibold">Reorder Alerts</h2>
            {data.length > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
                {data.length}
              </span>
            )}
          </div>
          {data.length > 5 && (
            <Link href={`/${orgSlug}/stock`} className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}
          </div>
        ) : top5.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            All stock levels are healthy
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Item</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Stock</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {top5.map((alert) => (
                  <tr key={alert.item_id + alert.warehouse_id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium truncate max-w-[160px]">{alert.item_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{alert.sku}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-semibold tabular-nums ${alert.current_qty <= 0 ? 'text-destructive' : 'text-amber-600'}`}>
                        {alert.current_qty}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {alert.reorder_level}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top Items Table ───────────────────────────────────────────────────────────

interface TopItemsTableProps {
  data: TopItem[];
  loading: boolean;
  orgSlug: string;
}

export function TopItemsTable({ data, loading, orgSlug }: TopItemsTableProps) {
  const top5 = data.slice(0, 5);
  const maxUnits = top5[0]?.units_moved ?? 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Top Moving Items</h2>
          </div>
          {data.length > 5 && (
            <Link href={`/${orgSlug}/catalog`} className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}
          </div>
        ) : top5.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No stock movement in the last 30 days
          </div>
        ) : (
          <div className="divide-y divide-border">
            {top5.map((item, idx) => (
              <div key={item.item_id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.item_name || item.sku}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(item.units_moved / maxUnits) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {item.units_moved.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
