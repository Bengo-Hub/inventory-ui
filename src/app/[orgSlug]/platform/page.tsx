'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useAuthStore, UserProfile } from '@/store/auth';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plug, Server, Shield, Settings } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SupplierConnector {
    id: string;
    name: string;
    type: string;
    status: 'active' | 'inactive' | 'error';
    lastSync: string | null;
}

interface SystemConfig {
    maxTenantsPerOrg: number;
    globalLowStockThreshold: number;
    enableAuditLog: boolean;
}

function isAdmin(user: UserProfile | null): boolean {
    if (!user?.roles) return false;
    return user.roles.some((r) => r === 'super_admin' || r === 'admin');
}

export default function PlatformPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (user && !isAdmin(user)) {
            router.replace(`/${orgSlug}`);
        }
    }, [user, orgSlug, router]);

    const { data: connectors } = useQuery<SupplierConnector[]>({
        queryKey: ['platform', 'connectors', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/platform/connectors`),
        enabled: isAdmin(user),
        placeholderData: [],
    });

    const { data: config } = useQuery<SystemConfig>({
        queryKey: ['platform', 'config'],
        queryFn: () => apiClient.get(`/api/v1/platform/config`),
        enabled: isAdmin(user),
        placeholderData: {
            maxTenantsPerOrg: 10,
            globalLowStockThreshold: 15,
            enableAuditLog: true,
        },
    });

    const [configForm, setConfigForm] = useState<SystemConfig>({
        maxTenantsPerOrg: 10,
        globalLowStockThreshold: 15,
        enableAuditLog: true,
    });

    useEffect(() => {
        if (config) setConfigForm(config);
    }, [config]);

    const configMutation = useMutation({
        mutationFn: (payload: SystemConfig) =>
            apiClient.put('/api/v1/platform/config', payload),
        onSuccess: () => {
            toast.success('System config updated');
            queryClient.invalidateQueries({ queryKey: ['platform', 'config'] });
        },
        onError: () => toast.error('Failed to update config'),
    });

    if (!user || !isAdmin(user)) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h2 className="text-xl font-semibold">Access Restricted</h2>
                    <p className="text-muted-foreground mt-1">Platform admin access is required.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <div className="flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold tracking-tight">Platform Admin</h1>
                </div>
                <p className="text-muted-foreground mt-1">Supplier connectors and system configuration</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Plug className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Supplier Connectors</h2>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {(connectors?.length ?? 0) === 0 ? (
                        <div className="p-6 text-center text-muted-foreground">
                            No supplier connectors configured
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {connectors?.map((conn) => (
                                <div key={conn.id} className="flex items-center justify-between px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
                                            <Server className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{conn.name}</p>
                                            <p className="text-xs text-muted-foreground">{conn.type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {conn.lastSync && (
                                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                                Last sync: {new Date(conn.lastSync).toLocaleDateString()}
                                            </span>
                                        )}
                                        <Badge variant={conn.status === 'active' ? 'success' : conn.status === 'error' ? 'error' : 'outline'}>
                                            {conn.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="max-w-2xl">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">System Configuration</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            configMutation.mutate(configForm);
                        }}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Max Tenants Per Org</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={configForm.maxTenantsPerOrg}
                                    onChange={(e) => setConfigForm({ ...configForm, maxTenantsPerOrg: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Global Low Stock Threshold (%)</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={configForm.globalLowStockThreshold}
                                    onChange={(e) => setConfigForm({ ...configForm, globalLowStockThreshold: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={configForm.enableAuditLog}
                                onChange={(e) => setConfigForm({ ...configForm, enableAuditLog: e.target.checked })}
                                className="h-4 w-4 rounded border-input accent-primary"
                            />
                            <span className="text-sm font-medium">Enable audit logging</span>
                        </label>

                        <Button type="submit" disabled={configMutation.isPending}>
                            {configMutation.isPending ? 'Saving...' : 'Save Configuration'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
