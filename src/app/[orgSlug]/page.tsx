'use client';

import { Badge, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    BoxIcon,
    Clock,
    Package,
    Warehouse,
} from 'lucide-react';
import { useParams } from 'next/navigation';

interface StockSummary {
    totalItems: number;
    lowStockAlerts: number;
    pendingReservations: number;
    warehouseCount: number;
}

interface ActivityItem {
    id: string;
    type: 'adjustment' | 'reservation' | 'receipt' | 'transfer';
    description: string;
    timestamp: string;
    delta?: number;
}

function useDashboardData(orgSlug: string) {
    const summary = useQuery<StockSummary>({
        queryKey: ['dashboard', 'summary', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/summary`),
        placeholderData: {
            totalItems: 0,
            lowStockAlerts: 0,
            pendingReservations: 0,
            warehouseCount: 0,
        },
    });

    const activity = useQuery<ActivityItem[]>({
        queryKey: ['dashboard', 'activity', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/activity?limit=10`),
        placeholderData: [],
    });

    return { summary, activity };
}

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
    const { summary, activity } = useDashboardData(orgSlug);
    const data = summary.data;

    const cards = [
        {
            label: 'Total Items',
            value: data?.totalItems ?? 0,
            icon: Package,
            color: 'text-primary',
            bg: 'bg-primary/10',
        },
        {
            label: 'Low Stock Alerts',
            value: data?.lowStockAlerts ?? 0,
            icon: AlertTriangle,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
        },
        {
            label: 'Pending Reservations',
            value: data?.pendingReservations ?? 0,
            icon: Clock,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
        },
        {
            label: 'Warehouses',
            value: data?.warehouseCount ?? 0,
            icon: Warehouse,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">
                    Welcome back{user?.fullName ? `, ${user.fullName}` : ''}
                </h1>
                <p className="text-muted-foreground mt-1">
                    Here&apos;s your inventory overview for <span className="capitalize">{orgSlug?.replace('-', ' ')}</span>
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card) => (
                    <Card key={card.label}>
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className={`h-12 w-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                                <card.icon className={`h-6 w-6 ${card.color}`} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{card.label}</p>
                                <p className="text-2xl font-bold tracking-tight">{card.value.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <h2 className="text-lg font-semibold">Recent Activity</h2>
                </CardHeader>
                <CardContent className="p-0">
                    {activity.isLoading ? (
                        <div className="p-6 text-center text-muted-foreground">Loading activity...</div>
                    ) : (activity.data?.length ?? 0) === 0 ? (
                        <div className="p-6 text-center text-muted-foreground">No recent activity</div>
                    ) : (
                        <div className="divide-y divide-border">
                            {activity.data?.map((item) => {
                                const Icon = ACTIVITY_ICONS[item.type] || BoxIcon;
                                return (
                                    <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                                        <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.description}</p>
                                            <p className="text-xs text-muted-foreground">
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
                </CardContent>
            </Card>
        </div>
    );
}
