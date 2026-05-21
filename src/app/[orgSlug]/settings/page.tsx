'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useAuthStore } from '@/store/auth';
import { userHasPermission } from '@/lib/auth/permissions';
import type { UserProfile as AuthUserProfile } from '@/lib/auth/types';
import {
  useInventorySettings,
  useUpdateInventorySettings,
  useUpdateInventoryModules,
} from '@/hooks/useInventorySettings';
import { apiClient } from '@/lib/api/client';
import {
  Bell,
  BookOpen,
  ChefHat,
  Globe,
  Layers,
  Link2,
  Loader2,
  Lock,
  Package,
  Save,
  Settings,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Tab = 'general' | 'stock' | 'modules' | 'integrations' | 'platform';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'stock', label: 'Stock & Thresholds', icon: BookOpen },
  { id: 'modules', label: 'Modules', icon: Layers },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'platform', label: 'Platform', icon: ShieldCheck },
];

const inputClass = 'w-full bg-accent/10 border border-border rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed';
const labelClass = 'text-xs font-bold text-muted-foreground uppercase tracking-wider';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
        ${checked ? 'bg-primary' : 'bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// General tab
// ══════════════════════════════════════════════════════════════════════════════

function GeneralTab({ orgSlug }: { orgSlug: string }) {
  const { data: settings, isLoading } = useInventorySettings(orgSlug);
  const update = useUpdateInventorySettings(orgSlug);
  const user = useAuthStore((s) => s.user);
  const canEdit = userHasPermission(user as unknown as AuthUserProfile, ['inventory.settings.change', 'inventory.settings.manage']);

  const [form, setForm] = useState({
    notificationEmail: '',
    defaultWarehouseId: '',
    enableLowStockNotifications: true,
    enableExpiryNotifications: true,
    expiryWarningDays: 30,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        notificationEmail: settings.notification_email ?? '',
        defaultWarehouseId: settings.default_warehouse_id ?? '',
        enableLowStockNotifications: settings.enable_low_stock_notifications,
        enableExpiryNotifications: settings.enable_expiry_notifications,
        expiryWarningDays: settings.expiry_warning_days,
      });
    }
  }, [settings]);

  const handleSave = () => {
    update.mutate({
      notification_email: form.notificationEmail || null,
      default_warehouse_id: form.defaultWarehouseId || null,
      enable_low_stock_notifications: form.enableLowStockNotifications,
      enable_expiry_notifications: form.enableExpiryNotifications,
      expiry_warning_days: form.expiryWarningDays,
    });
  };

  if (isLoading) return (
    <div className="h-40 flex items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Notifications</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={labelClass}>Notification Email</label>
              <input
                type="email"
                value={form.notificationEmail}
                onChange={(e) => setForm((f) => ({ ...f, notificationEmail: e.target.value }))}
                disabled={!canEdit}
                placeholder="alerts@example.com"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Expiry Warning (days before)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={form.expiryWarningDays}
                onChange={(e) => setForm((f) => ({ ...f, expiryWarningDays: parseInt(e.target.value) || 30 }))}
                disabled={!canEdit}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          {[
            { key: 'enableLowStockNotifications' as const, label: 'Low Stock Alerts', desc: 'Send alerts when stock drops below the threshold.' },
            { key: 'enableExpiryNotifications' as const, label: 'Expiry Alerts', desc: 'Send alerts when items are approaching their expiry date.' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-accent/10 border border-border">
              <div>
                <h4 className="text-sm font-bold">{item.label}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Toggle
                checked={form[item.key]}
                onChange={(v) => setForm((f) => ({ ...f, [item.key]: v }))}
                disabled={!canEdit}
              />
            </div>
          ))}

          <div className="flex items-center justify-end gap-3">
            {!canEdit && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> View only
              </p>
            )}
            <Button onClick={handleSave} disabled={!canEdit || update.isPending} className="gap-2 px-8 shadow-lg shadow-primary/10">
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Stock & Thresholds tab
// ══════════════════════════════════════════════════════════════════════════════

function StockTab({ orgSlug }: { orgSlug: string }) {
  const { data: settings, isLoading } = useInventorySettings(orgSlug);
  const update = useUpdateInventorySettings(orgSlug);
  const user = useAuthStore((s) => s.user);
  const canEdit = userHasPermission(user as unknown as AuthUserProfile, ['inventory.settings.change', 'inventory.settings.manage']);

  const [form, setForm] = useState({
    lowStockPct: 20,
    criticalStockPct: 5,
    defaultReorderLevel: 10,
    enableLotTracking: false,
    enableExpiryTracking: false,
    purchaseOrderApprovalRequired: false,
    autoAdjustOnTransfer: true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        lowStockPct: settings.low_stock_threshold_pct,
        criticalStockPct: settings.critical_stock_threshold_pct,
        defaultReorderLevel: settings.default_reorder_level,
        enableLotTracking: settings.enable_lot_tracking,
        enableExpiryTracking: settings.enable_expiry_tracking,
        purchaseOrderApprovalRequired: settings.purchase_order_approval_required,
        autoAdjustOnTransfer: settings.auto_adjust_on_transfer,
      });
    }
  }, [settings]);

  const handleSave = () => {
    update.mutate({
      low_stock_threshold_pct: form.lowStockPct,
      critical_stock_threshold_pct: form.criticalStockPct,
      default_reorder_level: form.defaultReorderLevel,
      enable_lot_tracking: form.enableLotTracking,
      enable_expiry_tracking: form.enableExpiryTracking,
      purchase_order_approval_required: form.purchaseOrderApprovalRequired,
      auto_adjust_on_transfer: form.autoAdjustOnTransfer,
    });
  };

  if (isLoading) return (
    <div className="h-40 flex items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Stock Thresholds</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className={labelClass}>Low Stock (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.lowStockPct}
                onChange={(e) => setForm((f) => ({ ...f, lowStockPct: parseFloat(e.target.value) || 20 }))}
                disabled={!canEdit}
                className={`${inputClass} font-mono`}
              />
              <p className="text-xs text-muted-foreground">Below this % of max capacity triggers a low-stock alert.</p>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Critical Stock (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.criticalStockPct}
                onChange={(e) => setForm((f) => ({ ...f, criticalStockPct: parseFloat(e.target.value) || 5 }))}
                disabled={!canEdit}
                className={`${inputClass} font-mono`}
              />
              <p className="text-xs text-muted-foreground">Below this % triggers a critical / urgent alert.</p>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Default Reorder Level (units)</label>
              <input
                type="number"
                min={0}
                value={form.defaultReorderLevel}
                onChange={(e) => setForm((f) => ({ ...f, defaultReorderLevel: parseInt(e.target.value) || 10 }))}
                disabled={!canEdit}
                className={`${inputClass} font-mono`}
              />
              <p className="text-xs text-muted-foreground">Default reorder point applied to new items.</p>
            </div>
          </div>

          {[
            { key: 'enableLotTracking' as const, label: 'Lot / Batch Tracking', desc: 'Track inventory by lot/batch numbers for traceability.' },
            { key: 'enableExpiryTracking' as const, label: 'Expiry Date Tracking', desc: 'Track expiry dates and enforce FEFO (First Expired, First Out).' },
            { key: 'purchaseOrderApprovalRequired' as const, label: 'Purchase Order Approval Required', desc: 'Require manager approval before a PO can be issued.' },
            { key: 'autoAdjustOnTransfer' as const, label: 'Auto-Adjust Stock on Transfer', desc: 'Automatically deduct source and credit destination on transfer completion.' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-accent/10 border border-border">
              <div>
                <h4 className="text-sm font-bold">{item.label}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Toggle
                checked={form[item.key]}
                onChange={(v) => setForm((f) => ({ ...f, [item.key]: v }))}
                disabled={!canEdit}
              />
            </div>
          ))}

          <div className="flex items-center justify-end gap-3">
            {!canEdit && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> View only
              </p>
            )}
            <Button onClick={handleSave} disabled={!canEdit || update.isPending} className="gap-2 px-8 shadow-lg shadow-primary/10">
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Modules tab
// ══════════════════════════════════════════════════════════════════════════════

interface ModuleCardProps {
  icon: React.ElementType;
  name: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  saving?: boolean;
}

function ModuleCard({ icon: Icon, name, description, checked, onChange, disabled, saving }: ModuleCardProps) {
  return (
    <div className={`flex items-start gap-4 p-5 rounded-2xl border transition-colors ${checked ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${checked ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold">{name}</h4>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled || saving} />
    </div>
  );
}

function ModulesTab({ orgSlug }: { orgSlug: string }) {
  const { data: settings, isLoading } = useInventorySettings(orgSlug);
  const updateModules = useUpdateInventoryModules(orgSlug);
  const user = useAuthStore((s) => s.user);
  const canEdit = userHasPermission(user as unknown as AuthUserProfile, ['inventory.settings.change', 'inventory.settings.manage']) || !!(user as any)?.isSuperUser;

  const [modules, setModules] = useState({
    lots_module_enabled: false,
    recipes_module_enabled: false,
    purchase_orders_enabled: true,
    supplier_management_enabled: true,
  });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setModules({
        lots_module_enabled: settings.lots_module_enabled,
        recipes_module_enabled: settings.recipes_module_enabled,
        purchase_orders_enabled: settings.purchase_orders_enabled,
        supplier_management_enabled: settings.supplier_management_enabled,
      });
    }
  }, [settings]);

  const toggle = (key: keyof typeof modules) => async (value: boolean) => {
    setModules((m) => ({ ...m, [key]: value }));
    setSaving(key);
    try {
      await updateModules.mutateAsync({ [key]: value });
    } catch {
      setModules((m) => ({ ...m, [key]: !value }));
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) return (
    <div className="h-40 flex items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
  );

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 text-amber-800 dark:text-amber-300 text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          Module configuration requires admin permissions.
        </div>
      )}
      <ModuleCard
        icon={Layers}
        name="Lots & Batches"
        description="Enable lot/batch number tracking for full traceability from receipt to sale."
        checked={modules.lots_module_enabled}
        onChange={toggle('lots_module_enabled')}
        disabled={!canEdit}
        saving={saving === 'lots_module_enabled'}
      />
      <ModuleCard
        icon={ChefHat}
        name="Recipes / Bill of Materials"
        description="Define recipes and BOMs so production/sales automatically consume component stock."
        checked={modules.recipes_module_enabled}
        onChange={toggle('recipes_module_enabled')}
        disabled={!canEdit}
        saving={saving === 'recipes_module_enabled'}
      />
      <ModuleCard
        icon={Package}
        name="Purchase Orders"
        description="Manage and issue purchase orders to suppliers directly from the inventory system."
        checked={modules.purchase_orders_enabled}
        onChange={toggle('purchase_orders_enabled')}
        disabled={!canEdit}
        saving={saving === 'purchase_orders_enabled'}
      />
      <ModuleCard
        icon={Truck}
        name="Supplier Management"
        description="Maintain a supplier directory with contacts, pricing, and performance tracking."
        checked={modules.supplier_management_enabled}
        onChange={toggle('supplier_management_enabled')}
        disabled={!canEdit}
        saving={saving === 'supplier_management_enabled'}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Integrations tab
// ══════════════════════════════════════════════════════════════════════════════

const AUTH_API_URL_DEFAULT = process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://sso.codevertexitsolutions.com';
const INV_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://inventoryapi.codevertexitsolutions.com';

function IntegrationsTab() {
  const [authApiUrl, setAuthApiUrl] = useState(AUTH_API_URL_DEFAULT);
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [saving, setSaving] = useState(false);

  const testConnection = async () => {
    setTestStatus('loading');
    try {
      const res = await fetch(`${authApiUrl}/healthz`);
      setTestStatus(res.ok ? 'ok' : 'fail');
    } catch { setTestStatus('fail'); }
  };

  const handleSave = async () => {
    if (!allowedOrigins.trim()) { toast.success('No changes to save'); return; }
    setSaving(true);
    try {
      await apiClient.put('/api/v1/admin/config/allowed_origins', { config_value: allowedOrigins, config_type: 'string' });
      toast.success('Saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">S2S Auth</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className={labelClass}>Auth-API URL</label>
            <div className="flex gap-3">
              <input value={authApiUrl} onChange={(e) => setAuthApiUrl(e.target.value)} className={`${inputClass} flex-1`} />
              <Button type="button" size="sm" onClick={testConnection} disabled={testStatus === 'loading'}>
                {testStatus === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Test'}
              </Button>
            </div>
            {testStatus === 'ok' && <p className="text-xs text-green-600">Connection successful</p>}
            {testStatus === 'fail' && <p className="text-xs text-red-600">Connection failed</p>}
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Inventory API URL</label>
            <input value={INV_API_URL} readOnly className={`${inputClass} opacity-60 cursor-not-allowed`} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">CORS</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className={labelClass}>Allowed Origins</label>
            <input value={allowedOrigins} onChange={(e) => setAllowedOrigins(e.target.value)} placeholder="https://app.example.com" className={inputClass} />
            <p className="text-xs text-muted-foreground">Comma-separated list of allowed CORS origins.</p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Platform tab
// ══════════════════════════════════════════════════════════════════════════════

function PlatformTab() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">Platform Configuration</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Platform-level settings such as service config, license keys, and infrastructure defaults.
          These settings affect all tenants and require platform admin access.
        </p>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Root page
// ══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const user = useAuthStore((s) => s.user);
  const isPlatformOwner = !!user?.isPlatformOwner || orgSlug === 'codevertex';

  const visibleTabs = TABS.filter((t) => t.id !== 'platform' || isPlatformOwner);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Inventory Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage stock thresholds, notifications, modules, and integrations.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-2xl bg-muted/50 border border-border overflow-x-auto scrollbar-hide">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === 'general' && <GeneralTab orgSlug={orgSlug} />}
        {activeTab === 'stock' && <StockTab orgSlug={orgSlug} />}
        {activeTab === 'modules' && <ModulesTab orgSlug={orgSlug} />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'platform' && isPlatformOwner && <PlatformTab />}
      </div>
    </div>
  );
}
