'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { TaxCodeCombobox } from '@/components/inventory/TaxCodeCombobox';
import { useAuthStore } from '@/store/auth';
import { userHasPermission, isPlatformOwner as checkPlatformOwner } from '@/lib/auth/permissions';
import type { UserProfile as AuthUserProfile } from '@/lib/auth/types';
import {
  useInventorySettings,
  useUpdateInventorySettings,
  useUpdateInventoryModules,
} from '@/hooks/useInventorySettings';
import { apiClient } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChefHat,
  FileText,
  Globe,
  Layers,
  Link2,
  Loader2,
  Lock,
  Package,
  Percent,
  Save,
  Settings,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useDocumentSequences, useUpdateDocumentSequence } from '@/hooks/useDocumentSequences';
import { DOC_TYPE_LABELS, DATE_FORMATS, type DocumentSequence } from '@/lib/api/document-sequences';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Tab = 'general' | 'stock' | 'modules' | 'tax' | 'documents' | 'integrations' | 'platform';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'stock', label: 'Stock & Thresholds', icon: BookOpen },
  { id: 'modules', label: 'Modules', icon: Layers },
  { id: 'tax', label: 'Tax & Compliance', icon: Percent },
  { id: 'documents', label: 'Documents', icon: FileText },
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
  const canEdit = userHasPermission(user as unknown as AuthUserProfile, ['inventory.settings.change', 'inventory.settings.manage']) || checkPlatformOwner(user);

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
  const canEdit = userHasPermission(user as unknown as AuthUserProfile, ['inventory.settings.change', 'inventory.settings.manage']) || checkPlatformOwner(user);

  const [form, setForm] = useState({
    lowStockPct: 20,
    criticalStockPct: 5,
    defaultReorderLevel: 10,
    defaultTargetMargin: 30,
    costingMethod: 'wavg' as 'wavg' | 'fifo' | 'lifo' | 'fefo',
    enableLotTracking: false,
    enableExpiryTracking: false,
    purchaseOrderApprovalRequired: false,
    autoAdjustOnTransfer: true,
  });
  const [unitDefaults, setUnitDefaults] = useState<Record<string, number>>({});
  const [newUnitAbbr, setNewUnitAbbr] = useState('');
  const [newUnitLevel, setNewUnitLevel] = useState('');

  useEffect(() => {
    if (settings) {
      setForm({
        lowStockPct: settings.low_stock_threshold_pct,
        criticalStockPct: settings.critical_stock_threshold_pct,
        defaultReorderLevel: settings.default_reorder_level,
        defaultTargetMargin: settings.default_target_margin_percent ?? 30,
        costingMethod: settings.costing_method ?? 'wavg',
        enableLotTracking: settings.enable_lot_tracking,
        enableExpiryTracking: settings.enable_expiry_tracking,
        purchaseOrderApprovalRequired: settings.purchase_order_approval_required,
        autoAdjustOnTransfer: settings.auto_adjust_on_transfer,
      });
      setUnitDefaults(settings.unit_reorder_defaults ?? {});
    }
  }, [settings]);

  const handleSave = () => {
    update.mutate({
      low_stock_threshold_pct: form.lowStockPct,
      critical_stock_threshold_pct: form.criticalStockPct,
      default_reorder_level: form.defaultReorderLevel,
      default_target_margin_percent: form.defaultTargetMargin,
      costing_method: form.costingMethod,
      unit_reorder_defaults: unitDefaults,
      enable_lot_tracking: form.enableLotTracking,
      enable_expiry_tracking: form.enableExpiryTracking,
      purchase_order_approval_required: form.purchaseOrderApprovalRequired,
      auto_adjust_on_transfer: form.autoAdjustOnTransfer,
    } as Parameters<typeof update.mutate>[0]);
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
              <label className={labelClass}>Default Reorder Level (fallback)</label>
              <input
                type="number"
                min={0}
                value={form.defaultReorderLevel}
                onChange={(e) => setForm((f) => ({ ...f, defaultReorderLevel: parseInt(e.target.value) || 10 }))}
                disabled={!canEdit}
                className={`${inputClass} font-mono`}
              />
              <p className="text-xs text-muted-foreground">Global fallback when no unit-specific default applies.</p>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Default Target Margin %</label>
              <input
                type="number"
                min={0}
                max={99}
                step={1}
                value={form.defaultTargetMargin}
                onChange={(e) => setForm((f) => ({ ...f, defaultTargetMargin: parseFloat(e.target.value) || 30 }))}
                disabled={!canEdit}
                className={`${inputClass} font-mono`}
              />
              <p className="text-xs text-muted-foreground">Used in recipe costing: suggested_price = cost ÷ (1 − margin%). Food cost target = 100% − margin%.</p>
            </div>
          </div>

          {/* Per-unit reorder defaults */}
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Reorder Defaults by Unit</label>
              <p className="text-xs text-muted-foreground mt-1">
                Minimum quantity to reorder per unit type. Applied when an item has no explicit reorder level configured.
                New ingredients are auto-seeded from this table on creation.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Object.entries(unitDefaults).map(([abbr, qty]) => (
                <div key={abbr} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">{abbr}</label>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setUnitDefaults((prev) => { const n = { ...prev }; delete n[abbr]; return n; })}
                        className="text-muted-foreground hover:text-destructive text-xs"
                        title="Remove unit default"
                      >✕</button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(e) => setUnitDefaults((prev) => ({ ...prev, [abbr]: parseInt(e.target.value) || 0 }))}
                    disabled={!canEdit}
                    className={`${inputClass} font-mono`}
                  />
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Unit abbr (e.g. kg)"
                  value={newUnitAbbr}
                  onChange={(e) => setNewUnitAbbr(e.target.value)}
                  className={`${inputClass} w-32`}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Level"
                  value={newUnitLevel}
                  onChange={(e) => setNewUnitLevel(e.target.value)}
                  className={`${inputClass} w-24`}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!newUnitAbbr.trim()) return;
                    setUnitDefaults((prev) => ({ ...prev, [newUnitAbbr.trim().toLowerCase()]: parseInt(newUnitLevel) || 0 }));
                    setNewUnitAbbr('');
                    setNewUnitLevel('');
                  }}
                >
                  + Add Unit
                </Button>
              </div>
            )}
          </div>

          {/* Costing / consumption method */}
          <div className="space-y-2">
            <label className={labelClass}>Inventory Costing Method</label>
            <select
              value={form.costingMethod}
              onChange={(e) => setForm((f) => ({ ...f, costingMethod: e.target.value as 'wavg' | 'fifo' | 'lifo' | 'fefo' }))}
              disabled={!canEdit}
              className={`${inputClass} max-w-md`}
            >
              <option value="wavg">Weighted Average (no lot ordering)</option>
              <option value="fifo">FIFO — First In, First Out (oldest stock consumed first)</option>
              <option value="lifo">LIFO — Last In, First Out (newest stock consumed first)</option>
              <option value="fefo">FEFO — First Expired, First Out (earliest expiry consumed first)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Determines which lot is drawn down first on every sale/consumption and how stock is valued.
              FIFO/LIFO/FEFO require lot tracking; FEFO additionally needs expiry tracking. Weighted average uses item-level cost with no lot ordering.
            </p>
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
  const updateSettings = useUpdateInventorySettings(orgSlug);
  const user = useAuthStore((s) => s.user);
  const canEdit = userHasPermission(user as unknown as AuthUserProfile, ['inventory.settings.change', 'inventory.settings.manage']) || checkPlatformOwner(user);

  const [modules, setModules] = useState({
    lots_module_enabled: false,
    recipes_module_enabled: false,
    purchase_orders_enabled: true,
    supplier_management_enabled: true,
  });
  const [hosp, setHosp] = useState({
    enable_room_pricing: false,
    enable_facility_booking: false,
    enable_conference_packages: false,
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
      setHosp({
        enable_room_pricing: settings.enable_room_pricing,
        enable_facility_booking: settings.enable_facility_booking,
        enable_conference_packages: settings.enable_conference_packages,
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

  // Hospitality toggles persist via the settings PUT endpoint (not the modules PATCH).
  const hospToggle = (key: keyof typeof hosp) => async (value: boolean) => {
    setHosp((m) => ({ ...m, [key]: value }));
    setSaving(key);
    try {
      await updateSettings.mutateAsync({ [key]: value });
    } catch {
      setHosp((m) => ({ ...m, [key]: !value }));
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

      <div className="pt-2 pb-1">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hospitality</h3>
      </div>
      <ModuleCard
        icon={Building2}
        name="Room Pricing"
        description="Enable hotel room-type SERVICE items with nightly rate plans and occupancy-based pricing."
        checked={hosp.enable_room_pricing}
        onChange={hospToggle('enable_room_pricing')}
        disabled={!canEdit}
        saving={saving === 'enable_room_pricing'}
      />
      <ModuleCard
        icon={CalendarDays}
        name="Facility Booking"
        description="Enable facility/conference-hall SERVICE items with session-based rates."
        checked={hosp.enable_facility_booking}
        onChange={hospToggle('enable_facility_booking')}
        disabled={!canEdit}
        saving={saving === 'enable_facility_booking'}
      />
      <ModuleCard
        icon={BookOpen}
        name="Conference Packages"
        description="Enable conference/event bundle packages (DDR/RDR) with meals included."
        checked={hosp.enable_conference_packages}
        onChange={hospToggle('enable_conference_packages')}
        disabled={!canEdit}
        saving={saving === 'enable_conference_packages'}
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
    } catch (e) { toast.error(await apiErrorMessage(e, 'Failed to save')); }
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
// Documents tab — per-doc-type numbering (prefix / date / padding)
// ══════════════════════════════════════════════════════════════════════════════

function DocumentSequenceRow({ orgSlug, seq }: { orgSlug: string; seq: DocumentSequence }) {
  const update = useUpdateDocumentSequence(orgSlug);
  const [prefix, setPrefix] = useState(seq.prefix);
  const [separator, setSeparator] = useState(seq.separator || '-');
  const [dateFormat, setDateFormat] = useState(seq.date_format ?? '');
  const [padding, setPadding] = useState(String(seq.padding));

  // Live local preview mirrors the backend formatter.
  const preview = (() => {
    const parts: string[] = [];
    if (prefix.trim()) parts.push(prefix.trim());
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateMap: Record<string, string> = { YYMMDD: `${yy}${mm}${dd}`, YYYYMMDD: `${yyyy}${mm}${dd}`, MMYY: `${mm}${yy}`, YYYY: yyyy };
    if (dateFormat && dateMap[dateFormat]) parts.push(dateMap[dateFormat]);
    const n = (seq.current_val + 1).toString().padStart(Math.max(1, parseInt(padding, 10) || 1), '0');
    parts.push(n);
    return parts.join(separator || '-');
  })();

  function save() {
    update.mutate(
      { docType: seq.doc_type, data: { prefix: prefix.trim(), separator: separator || '-', date_format: dateFormat, padding: parseInt(padding, 10) || 6, reset_freq: seq.reset_freq } },
      { onSuccess: () => toast.success(`${DOC_TYPE_LABELS[seq.doc_type] ?? seq.doc_type} numbering updated`), onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update numbering')) },
    );
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm">{DOC_TYPE_LABELS[seq.doc_type] ?? seq.doc_type}</span>
        <span className="text-xs font-mono text-muted-foreground">Next: <span className="font-bold text-foreground">{preview}</span></span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelClass}>Prefix</label>
          <input className={inputClass} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="PO" />
        </div>
        <div>
          <label className={labelClass}>Separator</label>
          <input className={inputClass} value={separator} maxLength={3} onChange={(e) => setSeparator(e.target.value)} placeholder="-" />
        </div>
        <div>
          <label className={labelClass}>Date format</label>
          <select className={inputClass} value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
            {DATE_FORMATS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Padding</label>
          <input className={inputClass} type="number" min={1} max={12} value={padding} onChange={(e) => setPadding(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={update.isPending}>
          <Save className="h-4 w-4 mr-1.5" /> {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function DocumentsTab({ orgSlug }: { orgSlug: string }) {
  const { data: sequences, isLoading } = useDocumentSequences(orgSlug);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">Document Numbering</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Configure the number format for each document type (e.g. PO-260625-000001). Changes apply to newly created documents.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (sequences ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No document sequences configured yet.</p>
        ) : (
          (sequences ?? []).map((s) => <DocumentSequenceRow key={s.doc_type} orgSlug={orgSlug} seq={s} />)
        )}
      </CardContent>
    </Card>
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
// Tax & Compliance tab
// ══════════════════════════════════════════════════════════════════════════════

function TaxComplianceTab({ orgSlug }: { orgSlug: string }) {
  const { data: settings, isLoading } = useInventorySettings(orgSlug);
  const update = useUpdateInventorySettings(orgSlug);
  const user = useAuthStore((s) => s.user);
  const canEdit = userHasPermission(user as unknown as AuthUserProfile, ['inventory.settings.change', 'inventory.settings.manage']) || checkPlatformOwner(user);

  const [form, setForm] = useState({ pricesInclusiveOfTax: false, defaultTaxCode: '' });

  useEffect(() => {
    if (settings) {
      setForm({
        pricesInclusiveOfTax: settings.prices_inclusive_of_tax,
        defaultTaxCode: settings.default_tax_code ?? '',
      });
    }
  }, [settings]);

  const handleSave = () => {
    update.mutate({
      prices_inclusive_of_tax: form.pricesInclusiveOfTax,
      default_tax_code: form.defaultTaxCode.trim(),
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
            <Percent className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Tax &amp; Compliance</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-accent/10 border border-border">
            <div className="pr-4">
              <h4 className="text-sm font-bold">Prices are inclusive of tax (VAT)</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, item selling prices are treated as VAT-inclusive and the tax portion is
                computed backwards from the price. Applies to new and existing items across POS and online
                ordering. Leave off to add VAT on top of net prices.
              </p>
            </div>
            <Toggle
              checked={form.pricesInclusiveOfTax}
              onChange={(v) => setForm((f) => ({ ...f, pricesInclusiveOfTax: v }))}
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2 max-w-xs">
            <label className={labelClass}>Default Tax Code</label>
            <TaxCodeCombobox
              orgSlug={orgSlug}
              value={form.defaultTaxCode}
              onChange={(code) => setForm((f) => ({ ...f, defaultTaxCode: code }))}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              KRA/eTIMS tax code applied to items that don&apos;t specify one. Options are synced from
              treasury-api (the platform source of truth) — no rate is stored here.
            </p>
          </div>

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
// Root page
// ══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const user = useAuthStore((s) => s.user);
  // Owner-only: derived from the server profile (is_platform_owner / superuser / server
  // tenant slug), never the URL orgSlug, so a tenant admin can't see the Platform tab.
  const isPlatformOwner = checkPlatformOwner(user);

  const visibleTabs = TABS.filter((t) => t.id !== 'platform' || isPlatformOwner);

  return (
    <div className="p-4 sm:p-8 space-y-6">
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
        {activeTab === 'tax' && <TaxComplianceTab orgSlug={orgSlug} />}
        {activeTab === 'documents' && <DocumentsTab orgSlug={orgSlug} />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'platform' && isPlatformOwner && <PlatformTab />}
      </div>
    </div>
  );
}
