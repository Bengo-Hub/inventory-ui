'use client';

import { Badge, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useAuthStore } from '@/store/auth';
import { useOutletStore } from '@/store/outlet';
import { useAnalyticsSummary, useStockTrends, useInventoryDistribution, useReorderAlerts, useTopItems } from '@/hooks/useAnalytics';
import { apiClient } from '@/lib/api/client';
import { Pagination } from '@/components/ui/pagination';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BoxIcon,
  Clock,
  FileText,
  Package,
  Plus,
  ShoppingBag,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  StockTrendsChart,
  DistributionChart,
  ReorderAlertsTable,
  TopItemsTable,
} from './_components/DashboardCharts';

interface ActivityItem {
  id: string;
  type: 'adjustment' | 'reservation' | 'receipt' | 'transfer';
  description: string;
  timestamp: string;
  delta?: number;
}

interface PaginatedActivity {
  data: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const ACTIVITY_PAGE_SIZE = 10;

const ACTIVITY_ICONS: Record<string, typeof BoxIcon> = {
  adjustment: ArrowUpRight,
  reservation: Clock,
  receipt: Package,
  transfer: Warehouse,
};

export default function DashboardPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const user = useAuthStore((s) => s.user);
  const outlet = useOutletStore((s) => s.outlet);

  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary(orgSlug);
  const { data: trends = [], isLoading: trendsLoading } = useStockTrends(orgSlug, 30);
  const { data: distribution = [], isLoading: distributionLoading } = useInventoryDistribution(orgSlug);
  const { data: reorderAlerts = [], isLoading: alertsLoading } = useReorderAlerts(orgSlug);
  const { data: topItems = [], isLoading: topLoading } = useTopItems(orgSlug, 10, 30);

  const [activityPage, setActivityPage] = useState(1);
  const { data: activity, isLoading: activityLoading } = useQuery<PaginatedActivity>({
    queryKey: ['dashboard', 'activity', orgSlug, activityPage],
    queryFn: () => apiClient.get(`/api/v1/${orgSlug}/inventory/activity?page=${activityPage}&limit=${ACTIVITY_PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  });
  const activityData = activity?.data ?? [];
  const activityTotalPages = Math.max(1, Math.ceil((activity?.total ?? 0) / ACTIVITY_PAGE_SIZE));

  const kpiCards = [
    {
      label: 'Total Items',
      value: summary?.total_items ?? 0,
      icon: Package,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Low Stock',
      value: summary?.low_stock_count ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Out of Stock',
      value: summary?.out_of_stock_count ?? 0,
      icon: ShoppingBag,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Pending POs',
      value: summary?.pending_po_count ?? 0,
      icon: FileText,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
  ];

  const quickActions = [
    { label: 'Adjust Stock', icon: Plus, href: `/${orgSlug}/adjustments` },
    { label: 'Purchase Order', icon: FileText, href: `/${orgSlug}/purchase-orders` },
    { label: 'Transfer', icon: Warehouse, href: `/${orgSlug}/transfers` },
    { label: 'Stock Levels', icon: Package, href: `/${orgSlug}/stock` },
  ];

  const welcomeName = user?.fullName
    ? user.fullName
    : user?.email?.split('@')[0] ?? null;

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            {welcomeName ? `Welcome back, ${welcomeName}` : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {outlet
              ? `Showing data for ${outlet.name}`
              : 'Showing data across all outlets'}
            {' · '}
            <span className="capitalize">{orgSlug.replace(/-/g, ' ')}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((qa) => (
            <Link
              key={qa.href}
              href={qa.href}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200"
            >
              <qa.icon className="h-4 w-4" />
              {qa.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {kpiCards.map((card) => (
          <Card key={card.label} className="animate-scale-in">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`h-12 w-12 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-black tracking-tight">
                  {summaryLoading ? (
                    <span className="inline-block w-12 h-7 skeleton rounded-md" />
                  ) : (
                    card.value.toLocaleString()
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StockTrendsChart data={trends} loading={trendsLoading} />
        <DistributionChart data={distribution} loading={distributionLoading} />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReorderAlertsTable data={reorderAlerts} loading={alertsLoading} orgSlug={orgSlug} />
        <TopItemsTable data={topItems} loading={topLoading} orgSlug={orgSlug} />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Recent Activity</h2>
        </CardHeader>
        <CardContent className="p-0">
          {activityLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="h-9 w-9 rounded-lg skeleton shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 skeleton rounded w-2/3" />
                    <div className="h-3 skeleton rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : activityData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No recent activity
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activityData.map((item) => {
                const Icon = ACTIVITY_ICONS[item.type] ?? BoxIcon;
                return (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-accent/30 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {item.delta != null && (
                      <Badge variant={item.delta > 0 ? 'success' : 'error'}>
                        <span className="flex items-center gap-0.5">
                          {item.delta > 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {Math.abs(item.delta)}
                        </span>
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {activityTotalPages > 1 && (
            <div className="border-t border-border">
              <Pagination page={activityPage} totalPages={activityTotalPages} onPageChange={setActivityPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
