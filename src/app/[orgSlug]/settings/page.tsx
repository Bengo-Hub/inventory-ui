'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Globe, Save } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const NOTIFICATIONS_URL = process.env.NEXT_PUBLIC_NOTIFICATIONS_URL || 'https://notifications.codevertexitsolutions.com';

interface TenantSettings {
    lowStockThresholdPercent: number;
    criticalStockThresholdPercent: number;
    enableLowStockNotifications: boolean;
    enableExpiryNotifications: boolean;
    notificationEmail: string;
    defaultWarehouseId: string;
}

export default function SettingsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const queryClient = useQueryClient();

    const { data: settings } = useQuery<TenantSettings>({
        queryKey: ['settings', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/settings`),
        placeholderData: {
            lowStockThresholdPercent: 20,
            criticalStockThresholdPercent: 5,
            enableLowStockNotifications: true,
            enableExpiryNotifications: true,
            notificationEmail: '',
            defaultWarehouseId: '',
        },
    });

    const [form, setForm] = useState<TenantSettings>({
        lowStockThresholdPercent: 20,
        criticalStockThresholdPercent: 5,
        enableLowStockNotifications: true,
        enableExpiryNotifications: true,
        notificationEmail: '',
        defaultWarehouseId: '',
    });

    useEffect(() => {
        if (settings) setForm(settings);
    }, [settings]);

    const mutation = useMutation({
        mutationFn: (payload: TenantSettings) =>
            apiClient.put(`/api/v1/tenants/${orgSlug}/inventory/settings`, payload),
        onSuccess: () => {
            toast.success('Settings saved');
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
        onError: () => {
            toast.error('Failed to save settings');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(form);
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage tenant inventory configuration</p>
            </div>

            <Card className="max-w-2xl">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Brand & organisation</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Logo and brand colours are managed in the Notifications service. To change your organisation logo, primary colour, or secondary colour, open the{' '}
                        <a href={orgSlug ? `${NOTIFICATIONS_URL}/${orgSlug}/settings/branding` : '#'} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                            Branding settings
                        </a>
                        {' '}page in Notifications (opens in new tab). Theme is applied automatically on this app from that config.
                    </p>
                </CardContent>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Notification Thresholds</h2>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Low Stock Threshold (%)</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={form.lowStockThresholdPercent}
                                    onChange={(e) => setForm({ ...form, lowStockThresholdPercent: Number(e.target.value) })}
                                />
                                <p className="text-xs text-muted-foreground">Alert when stock falls below this % of reorder point</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Critical Stock Threshold (%)</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={form.criticalStockThresholdPercent}
                                    onChange={(e) => setForm({ ...form, criticalStockThresholdPercent: Number(e.target.value) })}
                                />
                                <p className="text-xs text-muted-foreground">Escalate when stock is critically low</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.enableLowStockNotifications}
                                    onChange={(e) => setForm({ ...form, enableLowStockNotifications: e.target.checked })}
                                    className="h-4 w-4 rounded border-input accent-primary"
                                />
                                <span className="text-sm font-medium">Enable low stock notifications</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.enableExpiryNotifications}
                                    onChange={(e) => setForm({ ...form, enableExpiryNotifications: e.target.checked })}
                                    className="h-4 w-4 rounded border-input accent-primary"
                                />
                                <span className="text-sm font-medium">Enable expiry notifications</span>
                            </label>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notification Email</label>
                            <Input
                                type="email"
                                placeholder="alerts@example.com"
                                value={form.notificationEmail}
                                onChange={(e) => setForm({ ...form, notificationEmail: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Default Warehouse ID</label>
                            <Input
                                placeholder="wh-001"
                                value={form.defaultWarehouseId}
                                onChange={(e) => setForm({ ...form, defaultWarehouseId: e.target.value })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Button type="submit" disabled={mutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {mutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
            </form>
        </div>
    );
}
