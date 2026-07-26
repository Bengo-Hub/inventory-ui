'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useAuthStore, UserProfile } from '@/store/auth';
import { isPlatformOwner } from '@/lib/auth/permissions';
import { apiClient } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { serviceConfigApi, PROVIDER_FOOTER_KEY } from '@/lib/api/service-config';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    Bell,
    Building2,
    Loader2,
    Megaphone,
    PackageX,
    Plug,
    RefreshCw,
    Save,
    Server,
    Settings,
    Shield,
    Warehouse,
    X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────── */

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

interface WarehouseItem {
    id: string;
    name: string;
    address: string;
    isDefault: boolean;
    itemCount: number;
}

interface AutoReorderConfig {
    enabled: boolean;
    defaultThreshold: number;
    defaultReorderQty: number;
    supplierLeadDays: number;
}

interface StockAlertConfig {
    lowStockThreshold: number;
    outOfStockAlertEnabled: boolean;
    emailNotifications: boolean;
    dashboardAlerts: boolean;
}

type TabKey = 'connectors' | 'config' | 'warehouses' | 'auto-reorder' | 'stock-alerts' | 'documents';

/* ─── Helpers ────────────────────────────────────────────────────────── */

// Platform pages are owner-only. A tenant admin / inventory_admin is NOT a platform owner;
// only the is_platform_owner claim, the superuser role, or the codevertex tenant (via the
// server-returned tenant slug, not the URL) qualifies. See isPlatformOwner().
function isAdmin(user: UserProfile | null): boolean {
    return isPlatformOwner(user);
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function PlatformPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabKey>('connectors');

    useEffect(() => {
        if (user && !isAdmin(user)) {
            router.replace(`/${orgSlug}`);
        }
    }, [user, orgSlug, router]);

    /* ── Existing: Connectors ───────────────────────────────────────── */

    const { data: connectors } = useQuery<SupplierConnector[]>({
        queryKey: ['platform', 'connectors', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/platform/connectors`),
        enabled: isAdmin(user),
        placeholderData: [],
    });

    /* ── Existing: System Config ────────────────────────────────────── */

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

    /* ── Warehouses ─────────────────────────────────────────────────── */

    const { data: warehouses } = useQuery<WarehouseItem[]>({
        queryKey: ['platform', 'warehouses', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/platform/warehouses`),
        enabled: isAdmin(user),
        placeholderData: [],
    });

    /* ── Auto-Reorder Config ────────────────────────────────────────── */

    const { data: autoReorder } = useQuery<AutoReorderConfig>({
        queryKey: ['platform', 'auto-reorder', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/platform/auto-reorder`),
        enabled: isAdmin(user),
        placeholderData: { enabled: false, defaultThreshold: 10, defaultReorderQty: 50, supplierLeadDays: 3 },
    });

    const [reorderForm, setReorderForm] = useState<AutoReorderConfig>({
        enabled: false, defaultThreshold: 10, defaultReorderQty: 50, supplierLeadDays: 3,
    });

    useEffect(() => {
        if (autoReorder) setReorderForm(autoReorder);
    }, [autoReorder]);

    const reorderMutation = useMutation({
        mutationFn: (payload: AutoReorderConfig) =>
            apiClient.put('/api/v1/platform/auto-reorder', payload),
        onSuccess: () => {
            toast.success('Auto-reorder config saved');
            queryClient.invalidateQueries({ queryKey: ['platform', 'auto-reorder'] });
        },
        onError: () => toast.error('Failed to save auto-reorder config'),
    });

    /* ── Stock Alert Config ─────────────────────────────────────────── */

    const { data: stockAlerts } = useQuery<StockAlertConfig>({
        queryKey: ['platform', 'stock-alerts', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/platform/stock-alerts`),
        enabled: isAdmin(user),
        placeholderData: { lowStockThreshold: 15, outOfStockAlertEnabled: true, emailNotifications: true, dashboardAlerts: true },
    });

    const [alertForm, setAlertForm] = useState<StockAlertConfig>({
        lowStockThreshold: 15, outOfStockAlertEnabled: true, emailNotifications: true, dashboardAlerts: true,
    });

    useEffect(() => {
        if (stockAlerts) setAlertForm(stockAlerts);
    }, [stockAlerts]);

    const alertMutation = useMutation({
        mutationFn: (payload: StockAlertConfig) =>
            apiClient.put('/api/v1/platform/stock-alerts', payload),
        onSuccess: () => {
            toast.success('Stock alert config saved');
            queryClient.invalidateQueries({ queryKey: ['platform', 'stock-alerts'] });
        },
        onError: () => toast.error('Failed to save stock alert config'),
    });

    /* ── Guard ──────────────────────────────────────────────────────── */

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

    const tabs: { key: TabKey; label: string; icon: typeof Plug }[] = [
        { key: 'connectors', label: 'Connectors', icon: Plug },
        { key: 'config', label: 'System Config', icon: Settings },
        { key: 'warehouses', label: 'Warehouses', icon: Warehouse },
        { key: 'auto-reorder', label: 'Auto-Reorder', icon: RefreshCw },
        { key: 'stock-alerts', label: 'Stock Alerts', icon: Bell },
        { key: 'documents', label: 'Documents', icon: Megaphone },
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <div className="flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold tracking-tight">Platform Admin</h1>
                </div>
                <p className="text-muted-foreground mt-1">Connectors, warehouses, stock alerts, and system configuration</p>
            </div>

            {/* ─── Tab Bar ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-1 border-b border-border pb-px">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "px-4 py-2 rounded-t-lg text-sm font-medium transition-all",
                                activeTab === tab.key
                                    ? "bg-card border border-b-0 border-border text-foreground -mb-px"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className="h-4 w-4 inline mr-1.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ─── Connectors Tab ──────────────────────────────────────── */}
            {activeTab === 'connectors' && (
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
            )}

            {/* ─── System Config Tab ───────────────────────────────────── */}
            {activeTab === 'config' && (
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
            )}

            {/* ─── Warehouses Tab ──────────────────────────────────────── */}
            {activeTab === 'warehouses' && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Warehouse className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Warehouses</h2>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {(warehouses?.length ?? 0) === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                                <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No warehouses configured yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {warehouses?.map((wh) => (
                                    <div key={wh.id} className="flex items-center justify-between px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-10 w-10 rounded-lg flex items-center justify-center border",
                                                wh.isDefault ? "bg-primary/10 text-primary border-primary/20" : "bg-accent border-border text-muted-foreground"
                                            )}>
                                                <Warehouse className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-sm">{wh.name}</p>
                                                    {wh.isDefault && <Badge variant="success">Default</Badge>}
                                                </div>
                                                <p className="text-xs text-muted-foreground">{wh.address}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium">{wh.itemCount.toLocaleString()}</p>
                                            <p className="text-xs text-muted-foreground">items</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ─── Auto-Reorder Config Tab ─────────────────────────────── */}
            {activeTab === 'auto-reorder' && (
                <Card className="max-w-2xl">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <RefreshCw className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Auto-Reorder Configuration</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Automatically generate purchase orders when stock drops below configured thresholds.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={(e) => { e.preventDefault(); reorderMutation.mutate(reorderForm); }}
                            className="space-y-5"
                        >
                            <label className={cn(
                                "flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-all",
                                reorderForm.enabled ? "border-primary/30 bg-primary/5" : "border-border"
                            )}>
                                <input
                                    type="checkbox"
                                    checked={reorderForm.enabled}
                                    onChange={(e) => setReorderForm({ ...reorderForm, enabled: e.target.checked })}
                                    className="h-5 w-5 rounded border-input accent-primary"
                                />
                                <div>
                                    <p className="text-sm font-medium">Enable Auto-Reorder</p>
                                    <p className="text-xs text-muted-foreground">Purchase orders will be created automatically when stock is low.</p>
                                </div>
                            </label>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Default Threshold (units)</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={reorderForm.defaultThreshold}
                                        onChange={(e) => setReorderForm({ ...reorderForm, defaultThreshold: Number(e.target.value) })}
                                        disabled={!reorderForm.enabled}
                                    />
                                    <p className="text-xs text-muted-foreground">Reorder when stock falls below this level.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Default Reorder Quantity</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={reorderForm.defaultReorderQty}
                                        onChange={(e) => setReorderForm({ ...reorderForm, defaultReorderQty: Number(e.target.value) })}
                                        disabled={!reorderForm.enabled}
                                    />
                                    <p className="text-xs text-muted-foreground">How many units to reorder.</p>
                                </div>
                            </div>

                            <div className="space-y-2 max-w-xs">
                                <label className="text-sm font-medium">Supplier Lead Time (days)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={reorderForm.supplierLeadDays}
                                    onChange={(e) => setReorderForm({ ...reorderForm, supplierLeadDays: Number(e.target.value) })}
                                    disabled={!reorderForm.enabled}
                                />
                                <p className="text-xs text-muted-foreground">Average days for supplier delivery.</p>
                            </div>

                            <Button type="submit" disabled={reorderMutation.isPending}>
                                <Save className="h-4 w-4 mr-2" />
                                {reorderMutation.isPending ? 'Saving...' : 'Save Auto-Reorder Config'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* ─── Stock Alerts Tab ────────────────────────────────────── */}
            {activeTab === 'stock-alerts' && (
                <Card className="max-w-2xl">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Stock Alert Configuration</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configure thresholds and notification preferences for stock-level alerts.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={(e) => { e.preventDefault(); alertMutation.mutate(alertForm); }}
                            className="space-y-5"
                        >
                            <div className="space-y-2 max-w-xs">
                                <label className="text-sm font-medium">Low Stock Threshold (units)</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={alertForm.lowStockThreshold}
                                    onChange={(e) => setAlertForm({ ...alertForm, lowStockThreshold: Number(e.target.value) })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Items with stock at or below this number trigger a low-stock alert.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm font-medium">Alert Types</p>

                                <label className={cn(
                                    "flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-all",
                                    alertForm.outOfStockAlertEnabled ? "border-red-500/30 bg-red-500/5" : "border-border"
                                )}>
                                    <input
                                        type="checkbox"
                                        checked={alertForm.outOfStockAlertEnabled}
                                        onChange={(e) => setAlertForm({ ...alertForm, outOfStockAlertEnabled: e.target.checked })}
                                        className="h-4 w-4 rounded border-input accent-primary"
                                    />
                                    <div className="flex items-center gap-2">
                                        <PackageX className="h-5 w-5 text-red-500" />
                                        <div>
                                            <p className="text-sm font-medium">Out-of-Stock Alerts</p>
                                            <p className="text-xs text-muted-foreground">Get notified when items reach zero stock.</p>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm font-medium">Notification Channels</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={alertForm.emailNotifications}
                                            onChange={(e) => setAlertForm({ ...alertForm, emailNotifications: e.target.checked })}
                                            className="h-4 w-4 rounded border-input accent-primary"
                                        />
                                        <span className="text-sm">Email notifications</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={alertForm.dashboardAlerts}
                                            onChange={(e) => setAlertForm({ ...alertForm, dashboardAlerts: e.target.checked })}
                                            className="h-4 w-4 rounded border-input accent-primary"
                                        />
                                        <span className="text-sm">Dashboard alerts</span>
                                    </label>
                                </div>
                            </div>

                            <Button type="submit" disabled={alertMutation.isPending}>
                                <Save className="h-4 w-4 mr-2" />
                                {alertMutation.isPending ? 'Saving...' : 'Save Alert Config'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* ─── Documents Tab ───────────────────────────────────────── */}
            {activeTab === 'documents' && <ProviderFooterTab />}
        </div>
    );
}

/* ─── Documents — Provider Footer ───────────────────────────────────────
 * The "Developed & maintained by CodeVertex" line printed on purchase orders and reports.
 * Platform default + per-tenant override, platform-owner only — never a tenant self-service
 * setting (that's what distinguishes serviceConfigApi's *Admin methods from listTenant/upsertTenant). */

const PROVIDER_FOOTER_TENANTS_URL =
    (process.env.NEXT_PUBLIC_AUTH_API_URL ||
        process.env.NEXT_PUBLIC_SSO_URL ||
        'https://sso.codevertexafrica.com') + '/api/v1/admin/tenants';

interface PlatformTenantOption {
    id: string;
    name: string;
    slug: string;
}

function ProviderFooterTab() {
    const accessToken = useAuthStore((s) => s.session?.accessToken);
    const [platformEnabled, setPlatformEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [tenants, setTenants] = useState<PlatformTenantOption[]>([]);
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [overrideValue, setOverrideValue] = useState<'true' | 'false' | null>(null);
    const [overrideLoading, setOverrideLoading] = useState(false);
    const [overrideSaving, setOverrideSaving] = useState(false);

    const loadPlatformDefault = () => {
        serviceConfigApi
            .listPlatform()
            .then((configs) => {
                const entry = configs.find((c) => c.config_key === PROVIDER_FOOTER_KEY);
                setPlatformEnabled(entry ? entry.config_value === 'true' : true);
            })
            .catch(() => setPlatformEnabled(true))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadPlatformDefault();
        if (!accessToken) return;
        fetch(`${PROVIDER_FOOTER_TENANTS_URL}?limit=200`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((json) => {
                const list = Array.isArray(json) ? json : json.data ?? json.tenants ?? [];
                setTenants((list as PlatformTenantOption[]).filter((t) => t.id && t.slug));
            })
            .catch(() => setTenants([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    const handleTogglePlatform = () => {
        setSaving(true);
        serviceConfigApi
            .upsertPlatform(
                PROVIDER_FOOTER_KEY,
                platformEnabled ? 'false' : 'true',
                'Show the CodeVertex platform advertisement footer on generated documents',
            )
            .then(() => {
                loadPlatformDefault();
                toast.success('Platform default saved');
            })
            .catch(async (e) => toast.error(await apiErrorMessage(e, 'Failed to save platform default')))
            .finally(() => setSaving(false));
    };

    const loadOverride = (tenantID: string) => {
        if (!tenantID) { setOverrideValue(null); return; }
        setOverrideLoading(true);
        serviceConfigApi
            .listTenantOverridesAdmin(tenantID)
            .then((configs) => {
                const entry = configs.find((c) => c.config_key === PROVIDER_FOOTER_KEY);
                setOverrideValue(entry ? (entry.config_value as 'true' | 'false') : null);
            })
            .catch(() => setOverrideValue(null))
            .finally(() => setOverrideLoading(false));
    };

    const handleSelectTenant = (id: string) => {
        setSelectedTenantId(id);
        loadOverride(id);
    };

    const setOverride = (value: 'true' | 'false') => {
        if (!selectedTenantId) return;
        setOverrideSaving(true);
        serviceConfigApi
            .upsertTenantOverrideAdmin(selectedTenantId, PROVIDER_FOOTER_KEY, value)
            .then(() => {
                loadOverride(selectedTenantId);
                toast.success('Tenant override saved');
            })
            .catch(async (e) => toast.error(await apiErrorMessage(e, 'Failed to save tenant override')))
            .finally(() => setOverrideSaving(false));
    };

    const clearOverride = () => {
        if (!selectedTenantId) return;
        setOverrideSaving(true);
        serviceConfigApi
            .deleteTenantOverrideAdmin(selectedTenantId, PROVIDER_FOOTER_KEY)
            .then(() => {
                loadOverride(selectedTenantId);
                toast.success('Tenant override cleared — reverted to platform default');
            })
            .catch(async (e) => toast.error(await apiErrorMessage(e, 'Failed to clear tenant override')))
            .finally(() => setOverrideSaving(false));
    };

    const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

    return (
        <Card className="max-w-2xl">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Provider Footer</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    The &quot;Developed &amp; maintained by CodeVertex&quot; line printed on purchase
                    orders and reports. Shows by default unless turned off — platform-wide or for one
                    specific tenant.
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-sm font-medium">Platform default</p>
                            <p className="text-xs text-muted-foreground">Applies to every tenant with no override.</p>
                        </div>
                        <Button variant="outline" size="sm" disabled={saving} onClick={handleTogglePlatform}>
                            {platformEnabled ? 'Shown — click to hide' : 'Hidden — click to show'}
                        </Button>
                    </div>
                )}

                <div className="border-t border-border pt-5 space-y-3">
                    <div>
                        <p className="text-sm font-medium">Tenant exception</p>
                        <p className="text-xs text-muted-foreground">
                            Grant one tenant an override that differs from the platform default.
                        </p>
                    </div>
                    <select
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        value={selectedTenantId}
                        onChange={(e) => handleSelectTenant(e.target.value)}
                    >
                        <option value="">Select a tenant…</option>
                        {tenants.map((t) => (
                            <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                        ))}
                    </select>

                    {selectedTenantId && (
                        <div className="rounded-lg border border-border p-3 space-y-2">
                            {overrideLoading ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading override…
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-muted-foreground">
                                        {selectedTenant?.name}:{' '}
                                        {overrideValue != null
                                            ? `override — footer ${overrideValue === 'true' ? 'shown' : 'hidden'}`
                                            : `no override — inherits platform default (${platformEnabled ? 'shown' : 'hidden'})`}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" disabled={overrideSaving} onClick={() => setOverride('true')}>
                                            Show for this tenant
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={overrideSaving} onClick={() => setOverride('false')}>
                                            Hide for this tenant
                                        </Button>
                                        {overrideValue != null && (
                                            <Button size="sm" variant="ghost" disabled={overrideSaving} onClick={clearOverride}>
                                                <X className="h-3.5 w-3.5 mr-1" /> Clear override
                                            </Button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
